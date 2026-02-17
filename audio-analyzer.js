/**
 * Audio Analyzer Module
 * Real-time audio analysis by intercepting the Web Audio API.
 * Must be loaded BEFORE any audio SDK (Spotify, etc.) so we can
 * capture the AudioContext they create.
 */

const AudioAnalyzer = (function() {
    // Saved references
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    const origConnect = AudioNode.prototype.connect;
    const origDisconnect = AudioNode.prototype.disconnect;

    // State
    let audioContext = null;
    let analyser = null;
    let frequencyData = null;
    let timeDomainData = null;
    let isActive = false;
    let animFrameId = null;

    // Beat detection state
    let beatHistory = [];
    const BEAT_HISTORY_SIZE = 60; // ~1 second at 60fps
    let lastBeatTime = 0;
    let beatThreshold = 1.4; // Energy must be 1.4x the average to count as beat
    let currentBPM = 0;
    let beatTimestamps = [];
    let onBeatCallback = null;
    let onAnalysisCallback = null;

    // Visualization
    let canvas = null;
    let ctx = null;

    // Intercept AudioContext creation to capture the context
    function PatchedAudioContext(...args) {
        const context = new OriginalAudioContext(...args);

        if (!audioContext) {
            audioContext = context;
            setupAnalyser(context);
            console.log('[AudioAnalyzer] Captured AudioContext');
        }

        return context;
    }

    // Copy prototype and static properties
    PatchedAudioContext.prototype = OriginalAudioContext.prototype;
    Object.setPrototypeOf(PatchedAudioContext, OriginalAudioContext);

    // Install the patch
    if (OriginalAudioContext) {
        window.AudioContext = PatchedAudioContext;
        if (window.webkitAudioContext) {
            window.webkitAudioContext = PatchedAudioContext;
        }
    }

    // Intercept connect() to route audio through our analyser
    AudioNode.prototype.connect = function(destination, outputIndex, inputIndex) {
        if (audioContext && analyser && destination === audioContext.destination) {
            // Route through analyser: source -> analyser -> destination
            try {
                origConnect.call(this, analyser, outputIndex);
                return destination;
            } catch (e) {
                // Fallback to direct connection
                return origConnect.call(this, destination, outputIndex, inputIndex);
            }
        }
        return origConnect.call(this, destination, outputIndex, inputIndex);
    };

    // Set up the analyser node
    function setupAnalyser(context) {
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        timeDomainData = new Uint8Array(analyser.fftSize);

        // Connect analyser to destination using the original connect
        origConnect.call(analyser, context.destination);
    }

    // Start analysis loop
    function start(canvasElement) {
        if (!analyser) {
            console.warn('[AudioAnalyzer] No AudioContext captured yet');
            return false;
        }

        canvas = canvasElement;
        if (canvas) {
            ctx = canvas.getContext('2d');
        }

        isActive = true;
        beatHistory = [];
        beatTimestamps = [];
        analysisLoop();
        return true;
    }

    // Stop analysis
    function stop() {
        isActive = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    }

    // Main analysis loop
    function analysisLoop() {
        if (!isActive || !analyser) return;

        analyser.getByteFrequencyData(frequencyData);
        analyser.getByteTimeDomainData(timeDomainData);

        // Beat detection
        detectBeat();

        // Compute analysis data
        const analysis = computeAnalysis();

        // Notify listeners
        if (onAnalysisCallback) {
            onAnalysisCallback(analysis);
        }

        // Draw visualization
        if (ctx && canvas) {
            drawVisualization(analysis);
        }

        animFrameId = requestAnimationFrame(analysisLoop);
    }

    // Compute analysis from frequency data
    function computeAnalysis() {
        const bands = getFrequencyBands();
        const overall = getOverallEnergy();

        return {
            bands,
            overall,
            bpm: currentBPM,
            isBeat: (Date.now() - lastBeatTime) < 100,
            frequencyData: frequencyData,
            timeDomainData: timeDomainData
        };
    }

    // Split frequency data into musical bands
    function getFrequencyBands() {
        const binCount = frequencyData.length; // 128 bins
        const sampleRate = audioContext ? audioContext.sampleRate : 44100;
        const binWidth = sampleRate / (analyser.fftSize);

        // Sub-bass: 20-60Hz, Bass: 60-250Hz, Low-mid: 250-500Hz,
        // Mid: 500-2kHz, High-mid: 2k-4kHz, High: 4k-20kHz
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

    // Get overall energy level (0-255)
    function getOverallEnergy() {
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
        }
        return sum / frequencyData.length;
    }

    // Beat detection based on bass energy spikes
    function detectBeat() {
        const bands = getFrequencyBands();
        const bassEnergy = bands.subBass * 0.5 + bands.bass;
        const now = Date.now();

        beatHistory.push(bassEnergy);
        if (beatHistory.length > BEAT_HISTORY_SIZE) {
            beatHistory.shift();
        }

        // Need enough history
        if (beatHistory.length < 10) return;

        // Calculate average bass energy
        const avgEnergy = beatHistory.reduce((a, b) => a + b, 0) / beatHistory.length;

        // Beat if current energy exceeds threshold * average
        // and enough time since last beat (minimum 200ms = 300 BPM max)
        if (bassEnergy > avgEnergy * beatThreshold && (now - lastBeatTime) > 200) {
            lastBeatTime = now;

            // Track beat timestamps for BPM calculation
            beatTimestamps.push(now);
            // Keep last 20 beats for BPM calculation
            if (beatTimestamps.length > 20) {
                beatTimestamps.shift();
            }

            // Calculate BPM from beat intervals
            if (beatTimestamps.length >= 4) {
                const intervals = [];
                for (let i = 1; i < beatTimestamps.length; i++) {
                    intervals.push(beatTimestamps[i] - beatTimestamps[i - 1]);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const rawBPM = 60000 / avgInterval;
                // Clamp to reasonable range
                if (rawBPM >= 40 && rawBPM <= 220) {
                    // Smooth the BPM value
                    currentBPM = currentBPM === 0
                        ? Math.round(rawBPM)
                        : Math.round(currentBPM * 0.7 + rawBPM * 0.3);
                }
            }

            if (onBeatCallback) {
                onBeatCallback({
                    energy: bassEnergy,
                    bpm: currentBPM,
                    time: now
                });
            }
        }
    }

    // Draw the visualization
    function drawVisualization(analysis) {
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);

        const isBeat = analysis.isBeat;

        // Draw frequency bars
        const barCount = frequencyData.length;
        const barWidth = W / barCount;

        for (let i = 0; i < barCount; i++) {
            const value = frequencyData[i] / 255;
            const barHeight = value * H;

            // Color based on frequency range
            let hue;
            if (i < barCount * 0.1) hue = 0;           // Sub-bass: red
            else if (i < barCount * 0.25) hue = 30;     // Bass: orange
            else if (i < barCount * 0.4) hue = 60;      // Low-mid: yellow
            else if (i < barCount * 0.6) hue = 120;     // Mid: green
            else if (i < barCount * 0.8) hue = 200;     // High-mid: blue
            else hue = 280;                              // High: purple

            const saturation = isBeat ? 100 : 80;
            const lightness = isBeat ? 60 : 45;

            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            ctx.fillRect(
                i * barWidth,
                H - barHeight,
                barWidth - 1,
                barHeight
            );
        }

        // Beat flash overlay
        if (isBeat) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(0, 0, W, H);
        }

        // Draw band levels as overlay text
        const bands = analysis.bands;
        const bandLabels = [
            { name: 'SUB', val: bands.subBass },
            { name: 'BASS', val: bands.bass },
            { name: 'LOW', val: bands.lowMid },
            { name: 'MID', val: bands.mid },
            { name: 'HIGH', val: bands.highMid },
            { name: 'AIR', val: bands.high }
        ];

        const bandWidth = W / bandLabels.length;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        bandLabels.forEach((band, i) => {
            const x = bandWidth * i + bandWidth / 2;
            const level = Math.round(band.val / 255 * 100);

            // Band label
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(band.name, x, 12);

            // Level value
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(`${level}%`, x, H - 4);
        });

        // BPM display in top-right
        if (analysis.bpm > 0) {
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'right';
            ctx.fillStyle = isBeat ? '#1DB954' : 'rgba(255,255,255,0.8)';
            ctx.fillText(`${analysis.bpm} BPM`, W - 8, 14);
        }
    }

    // Set beat detection sensitivity (1.0 = very sensitive, 2.0 = less sensitive)
    function setSensitivity(value) {
        beatThreshold = Math.max(1.0, Math.min(2.5, value));
    }

    // Callbacks
    function onBeat(callback) {
        onBeatCallback = callback;
    }

    function onAnalysis(callback) {
        onAnalysisCallback = callback;
    }

    // Check if we have a captured AudioContext
    function hasCapturedContext() {
        return !!audioContext && !!analyser;
    }

    function getBPM() {
        return currentBPM;
    }

    function resetBPM() {
        currentBPM = 0;
        beatTimestamps = [];
        beatHistory = [];
    }

    return {
        start,
        stop,
        hasCapturedContext,
        setSensitivity,
        onBeat,
        onAnalysis,
        getBPM,
        resetBPM
    };
})();
