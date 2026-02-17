/**
 * Audio Analyzer Module
 * Real-time audio analysis using multiple capture strategies.
 * Must be loaded BEFORE any audio SDK (Spotify, etc.).
 *
 * Strategy 1: Intercept AudioContext.connect() to tap into the audio graph
 * Strategy 2: Find <audio>/<video> elements and use captureStream()
 * Strategy 3: Intercept createMediaElementSource() to attach analyser
 */

const AudioAnalyzer = (function() {
    // Save originals before anything else runs
    const _AudioContext = window.AudioContext || window.webkitAudioContext;
    const _origConnect = AudioNode.prototype.connect;
    const _origCreateMES = _AudioContext ? _AudioContext.prototype.createMediaElementSource : null;

    // State
    let ownContext = null;      // Our own AudioContext for analysis
    let capturedContext = null;  // The SDK's AudioContext (if intercepted)
    let analyser = null;
    let frequencyData = null;
    let timeDomainData = null;
    let isActive = false;
    let animFrameId = null;
    let captureMethod = 'none';
    let statusCallback = null;
    let silenceFrames = 0;
    let hasReceivedAudio = false;
    const SILENCE_THRESHOLD = 5; // Consider it silence if overall energy < 5
    const SILENCE_FRAMES_WARNING = 120; // ~2 seconds at 60fps

    // Beat detection state
    let beatHistory = [];
    const BEAT_HISTORY_SIZE = 60;
    let lastBeatTime = 0;
    let beatThreshold = 1.4;
    let currentBPM = 0;
    let beatTimestamps = [];
    let onBeatCallback = null;
    let onAnalysisCallback = null;

    // Visualization
    let canvas = null;
    let ctx = null;

    // =========================================================
    // Strategy 1: Intercept AudioContext creation + connect()
    // =========================================================

    if (_AudioContext) {
        // Proxy the AudioContext constructor
        const handler = {
            construct(target, args) {
                const instance = Reflect.construct(target, args, target);
                if (!capturedContext) {
                    capturedContext = instance;
                    setupInterceptAnalyser(instance);
                    updateStatus('Captured AudioContext');
                }
                return instance;
            }
        };

        try {
            window.AudioContext = new Proxy(_AudioContext, handler);
            if (window.webkitAudioContext) {
                window.webkitAudioContext = new Proxy(_AudioContext, handler);
            }
        } catch (e) {
            // Proxy not supported, use function wrapper
            window.AudioContext = function(...args) {
                const instance = new _AudioContext(...args);
                if (!capturedContext) {
                    capturedContext = instance;
                    setupInterceptAnalyser(instance);
                }
                return instance;
            };
            window.AudioContext.prototype = _AudioContext.prototype;
        }

        // Intercept connect() to route audio through analyser
        AudioNode.prototype.connect = function(dest, outIdx, inIdx) {
            // Only intercept connections to the captured context's destination
            if (capturedContext && analyser &&
                dest === capturedContext.destination &&
                this !== analyser) {
                try {
                    _origConnect.call(this, analyser, outIdx);
                    if (captureMethod !== 'intercept') {
                        captureMethod = 'intercept';
                        updateStatus('Analyzing via AudioContext intercept');
                    }
                    return dest;
                } catch (e) {
                    // Fall through to original connect
                }
            }
            return _origConnect.call(this, dest, outIdx, inIdx);
        };

        // Intercept createMediaElementSource to tap into the audio
        if (_origCreateMES) {
            _AudioContext.prototype.createMediaElementSource = function(mediaElement) {
                const source = _origCreateMES.call(this, mediaElement);
                // Try to set up analysis from this source via Strategy 2
                tryMediaElementCapture(mediaElement);
                return source;
            };
        }
    }

    // Set up analyser on the intercepted context
    function setupInterceptAnalyser(context) {
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        timeDomainData = new Uint8Array(analyser.fftSize);

        // Connect analyser → destination (using original connect to avoid our intercept)
        _origConnect.call(analyser, context.destination);
    }

    // =========================================================
    // Strategy 2: Find audio/video elements and captureStream
    // =========================================================

    let mediaObserver = null;

    function startMediaObserver() {
        if (mediaObserver) return;

        // Check existing elements
        document.querySelectorAll('audio, video').forEach(el => tryMediaElementCapture(el));

        // Watch for new elements
        mediaObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                            tryMediaElementCapture(node);
                        }
                        // Also check children
                        node.querySelectorAll && node.querySelectorAll('audio, video').forEach(el => {
                            tryMediaElementCapture(el);
                        });
                    }
                }
            }
        });

        mediaObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    function tryMediaElementCapture(mediaElement) {
        if (captureMethod === 'stream' || captureMethod === 'intercept') return;

        try {
            if (typeof mediaElement.captureStream === 'function') {
                const stream = mediaElement.captureStream();
                if (!ownContext) {
                    ownContext = new _AudioContext();
                }
                const source = ownContext.createMediaStreamSource(stream);

                if (!analyser) {
                    analyser = ownContext.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.8;
                    frequencyData = new Uint8Array(analyser.frequencyBinCount);
                    timeDomainData = new Uint8Array(analyser.fftSize);
                }

                source.connect(analyser);
                captureMethod = 'stream';
                updateStatus('Analyzing via media stream capture');
            }
        } catch (e) {
            // captureStream may fail on DRM-protected content — expected
            updateStatus('Stream capture blocked (DRM), using intercept');
        }
    }

    // =========================================================
    // Strategy 3: Tab Audio Capture via getDisplayMedia
    // =========================================================

    let tabCaptureStream = null;

    async function captureTabAudio() {
        try {
            // Request tab audio capture - user will select which tab to share
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: false,  // We only want audio
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Check if audio track is present
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                // User might have shared screen without audio
                stream.getTracks().forEach(t => t.stop());
                updateStatus('No audio track - enable "Share tab audio" checkbox');
                return false;
            }

            // Stop any previous capture
            if (tabCaptureStream) {
                tabCaptureStream.getTracks().forEach(t => t.stop());
            }
            tabCaptureStream = stream;

            // Create our own AudioContext for analysis
            if (!ownContext) {
                ownContext = new _AudioContext();
            }

            // Resume context if suspended
            if (ownContext.state === 'suspended') {
                await ownContext.resume();
            }

            // Create source from the captured stream
            const source = ownContext.createMediaStreamSource(stream);

            // Create analyser if needed
            if (!analyser) {
                analyser = ownContext.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;
                frequencyData = new Uint8Array(analyser.frequencyBinCount);
                timeDomainData = new Uint8Array(analyser.fftSize);
            }

            // Connect source to analyser
            source.connect(analyser);

            captureMethod = 'tab-capture';
            hasReceivedAudio = false;
            silenceFrames = 0;
            updateStatus('Tab audio capture active');

            // Handle track ending (user stops sharing)
            audioTracks[0].onended = () => {
                updateStatus('Tab sharing ended');
                captureMethod = 'none';
                tabCaptureStream = null;
            };

            // Start analysis loop if not running
            if (!isActive) {
                isActive = true;
                beatHistory = [];
                beatTimestamps = [];
                analysisLoop();
            }

            return true;
        } catch (e) {
            if (e.name === 'NotAllowedError') {
                updateStatus('Tab capture cancelled');
            } else {
                updateStatus('Tab capture failed: ' + e.message);
                console.error('[AudioAnalyzer] Tab capture error:', e);
            }
            return false;
        }
    }

    function stopTabCapture() {
        if (tabCaptureStream) {
            tabCaptureStream.getTracks().forEach(t => t.stop());
            tabCaptureStream = null;
            captureMethod = 'none';
            updateStatus('Tab capture stopped');
        }
    }

    function isTabCaptureActive() {
        return captureMethod === 'tab-capture' && tabCaptureStream !== null;
    }

    // =========================================================
    // Public API
    // =========================================================

    function start(canvasElement) {
        canvas = canvasElement;
        if (canvas) {
            ctx = canvas.getContext('2d');
        }

        // Start media observer as fallback
        startMediaObserver();

        if (!analyser) {
            updateStatus('Waiting for audio context...');
            // Retry periodically until we get a context
            const retryInterval = setInterval(() => {
                if (analyser) {
                    clearInterval(retryInterval);
                    isActive = true;
                    analysisLoop();
                    return;
                }
                // Re-check media elements
                document.querySelectorAll('audio, video').forEach(el => tryMediaElementCapture(el));
            }, 1000);
            return false;
        }

        isActive = true;
        beatHistory = [];
        beatTimestamps = [];
        analysisLoop();
        return true;
    }

    function stop() {
        isActive = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    }

    // =========================================================
    // Analysis loop
    // =========================================================

    function analysisLoop() {
        if (!isActive || !analyser) return;

        analyser.getByteFrequencyData(frequencyData);
        analyser.getByteTimeDomainData(timeDomainData);

        const analysis = computeAnalysis();

        // Track if we're receiving actual audio
        if (analysis.overall > SILENCE_THRESHOLD) {
            silenceFrames = 0;
            if (!hasReceivedAudio) {
                hasReceivedAudio = true;
                updateStatus('Receiving audio data');
            }
        } else {
            silenceFrames++;
            if (silenceFrames === SILENCE_FRAMES_WARNING && captureMethod !== 'none') {
                updateStatus('No audio detected (DRM may block capture)');
            }
        }

        detectBeat();

        if (onAnalysisCallback) {
            onAnalysisCallback(analysis);
        }

        if (ctx && canvas) {
            drawVisualization(analysis);
        }

        animFrameId = requestAnimationFrame(analysisLoop);
    }

    function computeAnalysis() {
        const bands = getFrequencyBands();
        const overall = getOverallEnergy();

        return {
            bands,
            overall,
            bpm: currentBPM,
            isBeat: (Date.now() - lastBeatTime) < 100,
            frequencyData,
            timeDomainData
        };
    }

    function getFrequencyBands() {
        const binCount = frequencyData.length;
        const sampleRate = (capturedContext || ownContext || { sampleRate: 44100 }).sampleRate;
        const binWidth = sampleRate / (analyser.fftSize);

        function bandEnergy(startHz, endHz) {
            const startBin = Math.floor(startHz / binWidth);
            const endBin = Math.min(Math.ceil(endHz / binWidth), binCount - 1);
            let sum = 0;
            let count = 0;
            for (let i = startBin; i <= endBin; i++) {
                sum += frequencyData[i];
                count++;
            }
            return count > 0 ? sum / count : 0;
        }

        return {
            subBass: bandEnergy(20, 60),
            bass: bandEnergy(60, 250),
            lowMid: bandEnergy(250, 500),
            mid: bandEnergy(500, 2000),
            highMid: bandEnergy(2000, 4000),
            high: bandEnergy(4000, 20000)
        };
    }

    function getOverallEnergy() {
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
        }
        return sum / frequencyData.length;
    }

    // =========================================================
    // Beat detection
    // =========================================================

    function detectBeat() {
        const bands = getFrequencyBands();
        const bassEnergy = bands.subBass * 0.5 + bands.bass;
        const now = Date.now();

        beatHistory.push(bassEnergy);
        if (beatHistory.length > BEAT_HISTORY_SIZE) {
            beatHistory.shift();
        }

        if (beatHistory.length < 10) return;

        const avgEnergy = beatHistory.reduce((a, b) => a + b, 0) / beatHistory.length;

        if (bassEnergy > avgEnergy * beatThreshold && (now - lastBeatTime) > 200) {
            lastBeatTime = now;

            beatTimestamps.push(now);
            if (beatTimestamps.length > 20) {
                beatTimestamps.shift();
            }

            if (beatTimestamps.length >= 4) {
                const intervals = [];
                for (let i = 1; i < beatTimestamps.length; i++) {
                    intervals.push(beatTimestamps[i] - beatTimestamps[i - 1]);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const rawBPM = 60000 / avgInterval;
                if (rawBPM >= 40 && rawBPM <= 220) {
                    currentBPM = currentBPM === 0
                        ? Math.round(rawBPM)
                        : Math.round(currentBPM * 0.7 + rawBPM * 0.3);
                }
            }

            if (onBeatCallback) {
                onBeatCallback({ energy: bassEnergy, bpm: currentBPM, time: now });
            }
        }
    }

    // =========================================================
    // Visualization
    // =========================================================

    function drawVisualization(analysis) {
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);

        const isBeat = analysis.isBeat;
        const barCount = frequencyData.length;
        const barWidth = W / barCount;

        for (let i = 0; i < barCount; i++) {
            const value = frequencyData[i] / 255;
            const barHeight = value * H;

            let hue;
            if (i < barCount * 0.1) hue = 0;
            else if (i < barCount * 0.25) hue = 30;
            else if (i < barCount * 0.4) hue = 60;
            else if (i < barCount * 0.6) hue = 120;
            else if (i < barCount * 0.8) hue = 200;
            else hue = 280;

            const saturation = isBeat ? 100 : 80;
            const lightness = isBeat ? 60 : 45;

            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            ctx.fillRect(i * barWidth, H - barHeight, barWidth - 1, barHeight);
        }

        if (isBeat) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(0, 0, W, H);
        }

        // Band labels
        const bands = analysis.bands;
        const bandLabels = [
            { name: 'SUB', val: bands.subBass },
            { name: 'BASS', val: bands.bass },
            { name: 'LOW', val: bands.lowMid },
            { name: 'MID', val: bands.mid },
            { name: 'HIGH', val: bands.highMid },
            { name: 'AIR', val: bands.high }
        ];

        const bw = W / bandLabels.length;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        bandLabels.forEach((band, i) => {
            const x = bw * i + bw / 2;
            const level = Math.round(band.val / 255 * 100);
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(band.name, x, 12);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(`${level}%`, x, H - 4);
        });

        if (analysis.bpm > 0) {
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'right';
            ctx.fillStyle = isBeat ? '#1DB954' : 'rgba(255,255,255,0.8)';
            ctx.fillText(`${analysis.bpm} BPM`, W - 8, 14);
        }

        // Show capture method
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(captureMethod, 4, H - 4);
    }

    // =========================================================
    // Utilities
    // =========================================================

    function updateStatus(msg) {
        console.log('[AudioAnalyzer]', msg);
        if (statusCallback) statusCallback(msg);
    }

    function setSensitivity(value) {
        beatThreshold = Math.max(1.0, Math.min(2.5, value));
    }

    function onBeat(callback) { onBeatCallback = callback; }
    function onAnalysis(callback) { onAnalysisCallback = callback; }
    function onStatus(callback) { statusCallback = callback; }

    function hasCapturedContext() {
        return !!analyser;
    }

    function getCaptureMethod() {
        return captureMethod;
    }

    function getBPM() { return currentBPM; }

    function resetBPM() {
        currentBPM = 0;
        beatTimestamps = [];
        beatHistory = [];
    }

    return {
        start,
        stop,
        captureTabAudio,
        stopTabCapture,
        isTabCaptureActive,
        hasCapturedContext,
        getCaptureMethod,
        setSensitivity,
        onBeat,
        onAnalysis,
        onStatus,
        getBPM,
        resetBPM
    };
})();
