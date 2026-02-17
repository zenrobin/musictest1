/**
 * Music + Video Sync Playground
 * Main Application - Refactored UI
 */

(function() {
    // State
    let currentProvider = 'spotify';
    let isAuthenticated = false;
    let isPlaying = false;
    let hasStartedPlaying = false; // Track if we've started at least once
    let selectedTrack = null;
    let searchResultsCache = {};
    let fadeOnEnd = true;
    let currentDuration = 0; // Track total duration for seeking
    let isDragging = false;

    // Spotify Top 50 Global playlist ID for random songs
    const TOP_PLAYLIST_ID = '37i9dQZEVXbMDoHDwVN2tF';

    // DOM Elements - Header
    const connectionStatus = document.getElementById('connection-status');
    const connectionText = document.getElementById('connection-text');
    const settingsBtn = document.getElementById('settings-btn');
    const versionDisplay = document.getElementById('version-display');

    // DOM Elements - Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const providerTabs = document.querySelectorAll('.provider-tab');
    const configSpotify = document.getElementById('config-spotify');
    const configApple = document.getElementById('config-apple');
    const redirectUriDisplay = document.getElementById('redirect-uri');

    // Spotify config elements
    const spotifyClientIdInput = document.getElementById('spotify-client-id');
    const spotifySaveConfigBtn = document.getElementById('spotify-save-config');
    const spotifyAuthBtn = document.getElementById('spotify-auth-btn');
    const spotifyAuthStatus = document.getElementById('spotify-auth-status');
    const spotifyUserInfo = document.getElementById('spotify-user-info');
    const spotifyDisconnectBtn = document.getElementById('spotify-disconnect');

    // Apple config elements
    const appleDevTokenInput = document.getElementById('apple-dev-token');
    const appleSaveConfigBtn = document.getElementById('apple-save-config');
    const appleAuthBtn = document.getElementById('apple-auth-btn');
    const appleAuthStatus = document.getElementById('apple-auth-status');
    const appleUserInfo = document.getElementById('apple-user-info');
    const appleDisconnectBtn = document.getElementById('apple-disconnect');

    // DOM Elements - Video
    const videoPresetSelect = document.getElementById('video-preset-select');
    const youtubeUrlInput = document.getElementById('youtube-url');
    const loadVideoBtn = document.getElementById('load-video-btn');
    const videoPlaceholder = document.getElementById('video-placeholder');

    // DOM Elements - Song Picker
    const currentSongDisplay = document.getElementById('current-song-display');
    const randomSongBtn = document.getElementById('random-song-btn');
    const toggleSearchBtn = document.getElementById('toggle-search-btn');
    const searchPanel = document.getElementById('search-panel');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    const selectedTrackMini = document.getElementById('selected-track-mini');
    const trackArtMini = document.getElementById('track-art-mini');
    const trackNameMini = document.getElementById('track-name-mini');
    const trackArtistMini = document.getElementById('track-artist-mini');
    const clearTrackBtn = document.getElementById('clear-track-btn');

    // DOM Elements - Playback
    const mainPlayBtn = document.getElementById('main-play-btn');
    const stopResetBtn = document.getElementById('stop-reset-btn');
    const progressBarContainer = document.querySelector('.progress-bar-container');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    // DOM Elements - Tools
    const offsetMinusBtn = document.getElementById('offset-minus');
    const offsetPlusBtn = document.getElementById('offset-plus');
    const offsetValue = document.getElementById('offset-value');
    const speedButtons = document.querySelectorAll('.speed-btn');
    const customSpeedInput = document.getElementById('custom-speed-input');
    const applyCustomSpeedBtn = document.getElementById('apply-custom-speed');
    const fadeOnEndCheckbox = document.getElementById('fade-on-end');

    // DOM Elements - Audio Analyzer
    const audioCanvas = document.getElementById('audio-canvas');
    const analyzerStatus = document.getElementById('analyzer-status');
    const detectedBPM = document.getElementById('detected-bpm');
    const beatIndicator = document.getElementById('beat-indicator');
    const beatSensitivity = document.getElementById('beat-sensitivity');

    // DOM Elements - API Explorer
    const rawTrackData = document.getElementById('raw-track-data');
    const rawAudioFeatures = document.getElementById('raw-audio-features');

    // Get current player
    function getCurrentPlayer() {
        return currentProvider === 'spotify' ? SpotifyPlayer : AppleMusicPlayer;
    }

    // Initialize
    async function init() {
        // Display version
        if (versionDisplay && typeof VERSION !== 'undefined') {
            versionDisplay.textContent = VERSION.getDisplayString();
        }

        // Display redirect URI
        if (redirectUriDisplay) {
            redirectUriDisplay.textContent = window.location.origin + window.location.pathname;
        }

        // Load saved config
        loadSavedConfig();

        // Check for OAuth callback
        await handleAuthCallback();

        // Setup event listeners
        setupEventListeners();

        // Initialize YouTube
        try {
            await YouTubePlayer.init('youtube-player');
            YouTubePlayer.onStateChange(handleVideoStateChange);
        } catch (e) {
            console.error('YouTube init failed:', e);
        }

        // Initialize sync controller
        SyncController.init();
        SyncController.onProgress(handleProgress);

        // Setup audio analyzer
        setupAudioAnalyzer();

        // Show settings if not connected
        if (!isAuthenticated) {
            showSettings();
        }

        updateUI();
    }

    // Load saved configuration
    function loadSavedConfig() {
        const savedProvider = localStorage.getItem('preferred_provider') || 'spotify';
        switchProvider(savedProvider);

        // Spotify
        const savedSpotifyId = localStorage.getItem('spotify_client_id');
        if (savedSpotifyId) {
            spotifyClientIdInput.value = savedSpotifyId;
            spotifyAuthBtn.disabled = false;
        }

        // Apple
        const savedAppleToken = localStorage.getItem('apple_music_token');
        if (savedAppleToken) {
            appleDevTokenInput.value = savedAppleToken;
            appleAuthBtn.disabled = false;
        }
    }

    // Handle OAuth callback
    async function handleAuthCallback() {
        try {
            const handled = await SpotifyAuth.handleCallback();
            if (handled) {
                currentProvider = 'spotify';
                await completeSpotifyAuth();
            }
        } catch (e) {
            console.error('Auth callback error:', e);
        }

        // Check existing sessions
        const savedSpotifyId = localStorage.getItem('spotify_client_id');
        if (savedSpotifyId && SpotifyAuth.init(savedSpotifyId)) {
            await completeSpotifyAuth();
        }
    }

    // Complete Spotify authentication
    async function completeSpotifyAuth() {
        try {
            const profile = await SpotifyAuth.getUserProfile();
            spotifyUserInfo.textContent = profile.display_name || profile.id;
            spotifyAuthStatus.classList.remove('hidden');
            spotifyAuthBtn.classList.add('hidden');
            spotifySaveConfigBtn.classList.add('hidden');

            isAuthenticated = true;
            await initSpotifyPlayer();
            updateConnectionStatus();
            hideSettings();
        } catch (e) {
            console.error('Spotify auth error:', e);
        }
    }

    // Initialize Spotify player
    async function initSpotifyPlayer() {
        try {
            SpotifyPlayer.onReady(() => {
                updateUI();
                // Spotify SDK creates AudioContext on ready — start analyzer
                tryStartAnalyzer();
            });
            SpotifyPlayer.onError((type, msg) => {
                console.error('Spotify error:', type, msg);
            });
            await SpotifyPlayer.init(() => SpotifyAuth.getAccessToken());
        } catch (e) {
            console.error('Spotify player init error:', e);
        }
    }

    // Switch provider
    function switchProvider(provider) {
        currentProvider = provider;
        localStorage.setItem('preferred_provider', provider);

        providerTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.provider === provider);
        });

        configSpotify.classList.toggle('hidden', provider !== 'spotify');
        configApple.classList.toggle('hidden', provider !== 'apple');

        SyncController.setProvider(provider);
        updateConnectionStatus();
    }

    // Update connection status
    function updateConnectionStatus() {
        const connected = currentProvider === 'spotify'
            ? SpotifyAuth.isAuthenticated()
            : AppleMusicAuth.isAuthorized();

        isAuthenticated = connected;
        connectionStatus.classList.toggle('connected', connected);
        connectionStatus.classList.toggle('disconnected', !connected);

        if (connected) {
            connectionText.textContent = currentProvider === 'spotify' ? 'Spotify' : 'Apple Music';
        } else {
            connectionText.textContent = 'Not connected';
        }
    }

    // Show/hide settings modal
    function showSettings() {
        settingsModal.classList.remove('hidden');
    }

    function hideSettings() {
        settingsModal.classList.add('hidden');
    }

    // Setup event listeners
    function setupEventListeners() {
        // Settings
        settingsBtn.addEventListener('click', showSettings);
        closeSettingsBtn.addEventListener('click', hideSettings);
        settingsModal.querySelector('.modal-backdrop').addEventListener('click', hideSettings);

        // Provider tabs
        providerTabs.forEach(tab => {
            tab.addEventListener('click', () => switchProvider(tab.dataset.provider));
        });

        // Spotify config
        spotifySaveConfigBtn.addEventListener('click', () => {
            const id = spotifyClientIdInput.value.trim();
            if (id) {
                localStorage.setItem('spotify_client_id', id);
                spotifyAuthBtn.disabled = false;
            }
        });

        spotifyAuthBtn.addEventListener('click', () => {
            const id = spotifyClientIdInput.value.trim();
            if (id) {
                SpotifyAuth.init(id);
                SpotifyAuth.authorize();
            }
        });

        spotifyDisconnectBtn.addEventListener('click', () => {
            SpotifyAuth.logout();
            SpotifyPlayer.disconnect();
            spotifyAuthStatus.classList.add('hidden');
            spotifyAuthBtn.classList.remove('hidden');
            spotifySaveConfigBtn.classList.remove('hidden');
            isAuthenticated = false;
            updateConnectionStatus();
        });

        // Apple config
        appleSaveConfigBtn.addEventListener('click', async () => {
            const token = appleDevTokenInput.value.trim();
            if (token) {
                try {
                    await AppleMusicAuth.init(token);
                    localStorage.setItem('apple_music_token', token);
                    appleAuthBtn.disabled = false;
                } catch (e) {
                    alert('Invalid token: ' + e.message);
                }
            }
        });

        appleAuthBtn.addEventListener('click', async () => {
            try {
                await AppleMusicAuth.authorize();
                appleUserInfo.textContent = 'Connected';
                appleAuthStatus.classList.remove('hidden');
                appleAuthBtn.classList.add('hidden');
                appleSaveConfigBtn.classList.add('hidden');
                isAuthenticated = true;
                await AppleMusicPlayer.init();
                updateConnectionStatus();
                hideSettings();
            } catch (e) {
                alert('Auth failed: ' + e.message);
            }
        });

        appleDisconnectBtn.addEventListener('click', async () => {
            await AppleMusicAuth.logout();
            AppleMusicPlayer.disconnect();
            appleAuthStatus.classList.add('hidden');
            appleAuthBtn.classList.remove('hidden');
            appleSaveConfigBtn.classList.remove('hidden');
            isAuthenticated = false;
            updateConnectionStatus();
        });

        // Video
        videoPresetSelect.addEventListener('change', () => {
            const url = videoPresetSelect.value;
            if (url) {
                youtubeUrlInput.value = url;
                loadVideo(url);
            }
        });

        loadVideoBtn.addEventListener('click', () => loadVideo(youtubeUrlInput.value));
        youtubeUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadVideo(youtubeUrlInput.value);
        });

        // Song picker
        toggleSearchBtn.addEventListener('click', () => {
            searchPanel.classList.toggle('hidden');
        });

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });

        randomSongBtn.addEventListener('click', loadRandomSong);
        clearTrackBtn.addEventListener('click', clearSelectedTrack);

        // Playback
        mainPlayBtn.addEventListener('click', togglePlayback);
        stopResetBtn.addEventListener('click', stopAndReset);

        // Progress bar scrubbing
        progressBarContainer.addEventListener('click', handleScrub);
        progressBarContainer.addEventListener('mousedown', startDragging);
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDragging);

        // Touch support for mobile
        progressBarContainer.addEventListener('touchstart', startDragging);
        document.addEventListener('touchmove', handleDrag);
        document.addEventListener('touchend', stopDragging);

        // Tools
        offsetMinusBtn.addEventListener('click', () => adjustOffset(-500));
        offsetPlusBtn.addEventListener('click', () => adjustOffset(500));

        speedButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                setVideoSpeed(speed);
            });
        });

        applyCustomSpeedBtn.addEventListener('click', () => {
            const speed = parseFloat(customSpeedInput.value);
            if (speed >= 0.25 && speed <= 2) {
                setVideoSpeed(speed);
            }
        });

        fadeOnEndCheckbox.addEventListener('change', () => {
            fadeOnEnd = fadeOnEndCheckbox.checked;
        });

        // Audio analyzer sensitivity
        beatSensitivity.addEventListener('input', () => {
            AudioAnalyzer.setSensitivity(beatSensitivity.value / 10);
        });
    }

    // Setup audio analyzer
    function setupAudioAnalyzer() {
        // Set canvas resolution to match display size
        if (audioCanvas) {
            const rect = audioCanvas.getBoundingClientRect();
            audioCanvas.width = rect.width * (window.devicePixelRatio || 1);
            audioCanvas.height = rect.height * (window.devicePixelRatio || 1);
        }

        // Start analyzer — it will begin producing data once AudioContext is captured
        AudioAnalyzer.onBeat((beat) => {
            // Flash beat indicator
            beatIndicator.classList.add('pulse');
            setTimeout(() => beatIndicator.classList.remove('pulse'), 100);

            // Update BPM display
            if (beat.bpm > 0) {
                detectedBPM.textContent = beat.bpm;
            }
        });

        AudioAnalyzer.onAnalysis((analysis) => {
            // Update status when we're getting data
            if (analysis.overall > 0 && analyzerStatus) {
                analyzerStatus.classList.add('active');
            }
        });

        // Try to start — may not have AudioContext yet
        AudioAnalyzer.start(audioCanvas);

        // Also try to start when music begins playing
        const origToggle = togglePlayback;
    }

    // Try starting the audio analyzer (called after Spotify connects)
    function tryStartAnalyzer() {
        if (AudioAnalyzer.hasCapturedContext()) {
            AudioAnalyzer.start(audioCanvas);
            if (analyzerStatus) {
                analyzerStatus.textContent = 'Listening...';
            }
        }
    }

    // Load video
    function loadVideo(url) {
        if (!url) return;
        try {
            YouTubePlayer.loadVideo(url, true);
            videoPlaceholder.classList.add('hidden');
            SyncController.setVideoLoaded(true);
            updateUI();
        } catch (e) {
            alert('Failed to load video: ' + e.message);
        }
    }

    // Perform search
    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query || !isAuthenticated) return;

        searchResults.innerHTML = '<p class="loading">Searching...</p>';
        searchResults.classList.remove('hidden');

        try {
            const tracks = await getCurrentPlayer().search(query);
            if (tracks.length === 0) {
                searchResults.innerHTML = '<p class="no-results">No results found</p>';
                return;
            }

            searchResultsCache = {};
            tracks.forEach(t => searchResultsCache[t.id] = t);

            searchResults.innerHTML = tracks.map(track => `
                <div class="search-result-item" data-id="${track.id}" data-uri="${track.uri}">
                    <img src="${track.album?.images?.[0]?.url || ''}" alt="">
                    <div class="result-info">
                        <span class="result-name">${escapeHtml(track.name)}</span>
                        <span class="result-artist">${escapeHtml(track.artists?.map(a => a.name).join(', ') || '')}</span>
                    </div>
                    <span class="result-duration">${getCurrentPlayer().formatDuration(track.duration_ms)}</span>
                </div>
            `).join('');

            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => selectTrack(item.dataset.id, item.dataset.uri));
            });
        } catch (e) {
            searchResults.innerHTML = `<p class="error">Search failed: ${e.message}</p>`;
        }
    }

    // Select track
    function selectTrack(trackId, trackUri) {
        const track = searchResultsCache[trackId];
        if (!track) return;

        selectedTrack = { ...track, uri: trackUri, id: trackId };

        // Update mini display
        trackArtMini.src = track.album?.images?.[0]?.url || '';
        trackNameMini.textContent = track.name;
        trackArtistMini.textContent = track.artists?.map(a => a.name).join(', ') || '';
        selectedTrackMini.classList.remove('hidden');

        // Update header
        currentSongDisplay.textContent = track.name;

        // Hide search
        searchPanel.classList.add('hidden');
        searchResults.classList.add('hidden');

        // Update sync controller
        SyncController.setTrack(selectedTrack);

        // Reset BPM for new track
        AudioAnalyzer.resetBPM();
        detectedBPM.textContent = '--';

        // Update API explorer
        rawTrackData.textContent = JSON.stringify(track, null, 2);

        updateUI();
    }

    // Clear selected track
    function clearSelectedTrack() {
        selectedTrack = null;
        hasStartedPlaying = false; // Reset so next play starts fresh
        selectedTrackMini.classList.add('hidden');
        currentSongDisplay.textContent = 'No song selected';
        SyncController.setTrack(null);
        rawTrackData.textContent = 'No track selected';
        rawAudioFeatures.textContent = 'No track selected';
        updateUI();
    }

    // Load random song from top playlist
    async function loadRandomSong() {
        if (!isAuthenticated || currentProvider !== 'spotify') {
            alert('Random song requires Spotify connection');
            return;
        }

        randomSongBtn.disabled = true;
        randomSongBtn.textContent = 'Loading...';

        try {
            const playlist = await SpotifyAuth.apiRequest(`/playlists/${TOP_PLAYLIST_ID}/tracks?limit=50`);
            const tracks = playlist.items.map(item => item.track).filter(t => t);

            if (tracks.length > 0) {
                const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
                searchResultsCache[randomTrack.id] = randomTrack;
                selectTrack(randomTrack.id, randomTrack.uri);
            }
        } catch (e) {
            console.error('Failed to load random song:', e);
            alert('Failed to load random song');
        }

        randomSongBtn.disabled = false;
        randomSongBtn.innerHTML = '&#127922; Random';
    }

    // Toggle playback
    async function togglePlayback() {
        if (!SyncController.isReadyToSync()) return;

        if (isPlaying) {
            await SyncController.pauseBoth();
            isPlaying = false;
        } else {
            // Resume if we've already started, otherwise start fresh
            if (hasStartedPlaying) {
                await SyncController.resumeBoth();
            } else {
                await SyncController.playBoth();
                hasStartedPlaying = true;
            }
            isPlaying = true;
        }

        updatePlayButton();
    }

    // Stop and reset
    async function stopAndReset() {
        isPlaying = false;
        hasStartedPlaying = false; // Reset so next play starts fresh

        // Pause YouTube (don't use stop() as it can trigger auto-play on seek)
        YouTubePlayer.pause();
        YouTubePlayer.seek(0);

        // Stop and reset Spotify/Apple Music
        const player = getCurrentPlayer();
        try {
            await player.pause();
            await player.seek(0);
        } catch (e) {
            console.log('Stop error:', e);
        }

        // Reset progress
        progressBar.style.width = '0%';
        currentTimeEl.textContent = '0:00';

        // Stop sync controller tracking
        SyncController.stopBoth();

        updatePlayButton();
    }

    // Calculate position from mouse/touch event
    function getPositionFromEvent(e) {
        const rect = progressBarContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return percent * currentDuration;
    }

    // Handle scrub click
    async function handleScrub(e) {
        if (!SyncController.isReadyToSync() || currentDuration === 0) return;

        const positionMs = getPositionFromEvent(e);
        await SyncController.seekBoth(positionMs);
        hasStartedPlaying = true; // Mark as started so play resumes from here
    }

    // Start dragging
    function startDragging(e) {
        if (!SyncController.isReadyToSync() || currentDuration === 0) return;
        isDragging = true;
        e.preventDefault();
    }

    // Handle drag
    async function handleDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const positionMs = getPositionFromEvent(e);
        const percent = (positionMs / currentDuration) * 100;
        progressBar.style.width = `${percent}%`;
        currentTimeEl.textContent = formatTime(positionMs);
    }

    // Stop dragging
    async function stopDragging(e) {
        if (!isDragging) return;
        isDragging = false;

        const positionMs = getPositionFromEvent(e.changedTouches ? e.changedTouches[0] : e);
        await SyncController.seekBoth(positionMs);
        hasStartedPlaying = true;
    }

    // Update play button state
    function updatePlayButton() {
        const playIcon = mainPlayBtn.querySelector('.play-icon');
        const playLabel = mainPlayBtn.querySelector('.btn-label');

        if (isPlaying) {
            mainPlayBtn.classList.add('playing');
            playIcon.innerHTML = '&#10074;&#10074;';
            playLabel.textContent = 'Pause';
        } else {
            mainPlayBtn.classList.remove('playing');
            playIcon.innerHTML = '&#9654;';
            playLabel.textContent = 'Play';
        }
    }

    // Handle video state change
    function handleVideoStateChange(state) {
        // Video ended
        if (state === YouTubePlayer.PlayerState.ENDED) {
            isPlaying = false;
            updatePlayButton();

            if (fadeOnEnd) {
                fadeOutMusic();
            } else {
                // Immediately stop music if fade is off
                getCurrentPlayer().pause().catch(console.error);
            }
        }
    }

    // Fade out music
    async function fadeOutMusic() {
        const player = getCurrentPlayer();
        const steps = 10;
        const duration = 2000;
        const interval = duration / steps;

        for (let i = steps; i >= 0; i--) {
            await player.setVolume(i * 10);
            await new Promise(r => setTimeout(r, interval));
        }

        await player.pause();
        await player.setVolume(50); // Reset volume
    }

    // Handle progress updates
    function handleProgress(data) {
        currentDuration = data.duration; // Store for seeking
        const percent = (data.currentTime / data.duration) * 100;
        progressBar.style.width = `${Math.min(percent, 100)}%`;
        currentTimeEl.textContent = formatTime(data.currentTime);
        totalTimeEl.textContent = formatTime(data.duration);
    }

    // Adjust timing offset
    function adjustOffset(delta) {
        const current = SyncController.getOffset();
        SyncController.setOffset(current + delta);
        offsetValue.textContent = `${(SyncController.getOffset() / 1000).toFixed(1)}s`;
    }

    // Set video speed
    function setVideoSpeed(speed) {
        SyncController.setVideoSpeed(speed);
        speedButtons.forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
        });
        customSpeedInput.value = speed;
    }

    // Update UI state
    function updateUI() {
        const canPlay = SyncController.isReadyToSync();
        mainPlayBtn.disabled = !canPlay;
        stopResetBtn.disabled = !canPlay;

        // Update random button state
        randomSongBtn.disabled = !isAuthenticated || currentProvider !== 'spotify';
    }

    // Format time
    function formatTime(ms) {
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // Start
    init();
})();
