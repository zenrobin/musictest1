/**
 * Main Application
 * Ties together Spotify, YouTube, and Sync functionality
 */

(function() {
    // DOM Elements - Config
    const clientIdInput = document.getElementById('client-id');
    const redirectUriDisplay = document.getElementById('redirect-uri');
    const saveConfigBtn = document.getElementById('save-config');
    const authBtn = document.getElementById('auth-btn');
    const authStatus = document.getElementById('auth-status');
    const userInfo = document.getElementById('user-info');

    // DOM Elements - Playground
    const playground = document.getElementById('playground');
    const configSection = document.getElementById('config-section');

    // DOM Elements - Search
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');

    // DOM Elements - Selected Track
    const selectedTrackEl = document.getElementById('selected-track');
    const trackArt = document.getElementById('track-art');
    const trackName = document.getElementById('track-name');
    const trackArtist = document.getElementById('track-artist');
    const trackAlbum = document.getElementById('track-album');

    // DOM Elements - Audio Features
    const audioFeaturesEl = document.getElementById('audio-features');

    // DOM Elements - Player Status
    const playerStatusText = document.getElementById('player-status-text');

    // DOM Elements - YouTube
    const youtubeUrlInput = document.getElementById('youtube-url');
    const loadVideoBtn = document.getElementById('load-video-btn');
    const videoPlaceholder = document.getElementById('video-placeholder');
    const speedControls = document.getElementById('speed-controls');
    const speedButtons = document.querySelectorAll('.speed-btn');
    const customSpeedInput = document.getElementById('custom-speed-input');
    const applyCustomSpeedBtn = document.getElementById('apply-custom-speed');

    // DOM Elements - Sync Controls
    const syncPlayBtn = document.getElementById('sync-play');
    const syncPauseBtn = document.getElementById('sync-pause');
    const syncStopBtn = document.getElementById('sync-stop');
    const spotifySyncStatus = document.getElementById('spotify-sync-status');
    const videoSyncStatus = document.getElementById('video-sync-status');
    const offsetValue = document.getElementById('offset-value');
    const offsetMinusBtn = document.getElementById('offset-minus');
    const offsetPlusBtn = document.getElementById('offset-plus');

    // DOM Elements - Progress
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    // DOM Elements - API Explorer
    const rawTrackData = document.getElementById('raw-track-data');
    const rawAudioFeatures = document.getElementById('raw-audio-features');
    const rawAudioAnalysis = document.getElementById('raw-audio-analysis');

    // State
    let isAuthenticated = false;

    // Initialize application
    async function init() {
        // Display redirect URI
        redirectUriDisplay.textContent = window.location.origin + window.location.pathname;

        // Load saved client ID
        const savedClientId = localStorage.getItem('spotify_client_id');
        if (savedClientId) {
            clientIdInput.value = savedClientId;
            authBtn.disabled = false;
        }

        // Check for OAuth callback
        const hasCallback = await handleAuthCallback();

        // If not a callback, check for existing session
        if (!hasCallback && savedClientId) {
            const hasValidSession = SpotifyAuth.init(savedClientId);
            if (hasValidSession) {
                await completeAuthentication();
            }
        }

        // Set up event listeners
        setupEventListeners();

        // Initialize YouTube player
        try {
            await YouTubePlayer.init('youtube-player');
            console.log('YouTube player initialized');
        } catch (error) {
            console.error('Failed to initialize YouTube player:', error);
        }

        // Initialize sync controller
        SyncController.init();
        setupSyncListeners();
    }

    // Handle OAuth callback
    async function handleAuthCallback() {
        try {
            const handled = await SpotifyAuth.handleCallback();
            if (handled) {
                await completeAuthentication();
                return true;
            }
        } catch (error) {
            console.error('Auth callback error:', error);
            showError('Authentication failed: ' + error.message);
        }
        return false;
    }

    // Complete authentication and initialize player
    async function completeAuthentication() {
        try {
            // Get user profile
            const profile = await SpotifyAuth.getUserProfile();
            userInfo.textContent = `Connected as ${profile.display_name || profile.id}`;
            authStatus.classList.remove('hidden');
            authStatus.querySelector('.status-dot').classList.add('online');
            authBtn.textContent = 'Disconnect';
            authBtn.classList.remove('btn-primary');
            authBtn.classList.add('btn-danger');

            // Show playground
            playground.classList.remove('hidden');
            isAuthenticated = true;

            // Initialize Spotify player
            await initSpotifyPlayer();

        } catch (error) {
            console.error('Error completing authentication:', error);
            showError('Failed to complete authentication: ' + error.message);
        }
    }

    // Initialize Spotify Player
    async function initSpotifyPlayer() {
        try {
            playerStatusText.textContent = 'Initializing player...';

            SpotifyPlayer.onReady((deviceId) => {
                playerStatusText.textContent = 'Player ready (Premium required for playback)';
                document.querySelector('#player-status .status-dot').classList.remove('offline');
                document.querySelector('#player-status .status-dot').classList.add('online');
                updateSyncControls();
            });

            SpotifyPlayer.onError((type, message) => {
                playerStatusText.textContent = `Error: ${message}`;
                if (type === 'account') {
                    playerStatusText.textContent = 'Spotify Premium required for playback';
                }
            });

            SpotifyPlayer.onStateChange((state) => {
                // Update any real-time displays if needed
            });

            await SpotifyPlayer.init(() => SpotifyAuth.getAccessToken());

        } catch (error) {
            console.error('Failed to initialize Spotify player:', error);
            playerStatusText.textContent = 'Failed to initialize player';
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        // Save config
        saveConfigBtn.addEventListener('click', () => {
            const clientId = clientIdInput.value.trim();
            if (clientId) {
                localStorage.setItem('spotify_client_id', clientId);
                authBtn.disabled = false;
                showSuccess('Configuration saved!');
            } else {
                showError('Please enter a Client ID');
            }
        });

        // Auth button
        authBtn.addEventListener('click', () => {
            if (isAuthenticated) {
                // Disconnect
                SpotifyAuth.logout();
                SpotifyPlayer.disconnect();
                playground.classList.add('hidden');
                authStatus.classList.add('hidden');
                authBtn.textContent = 'Connect to Spotify';
                authBtn.classList.remove('btn-danger');
                authBtn.classList.add('btn-primary');
                isAuthenticated = false;
            } else {
                // Connect
                const clientId = clientIdInput.value.trim();
                if (!clientId) {
                    showError('Please enter a Client ID first');
                    return;
                }
                SpotifyAuth.init(clientId);
                SpotifyAuth.authorize();
            }
        });

        // Search
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });

        // Load video
        loadVideoBtn.addEventListener('click', loadVideo);
        youtubeUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadVideo();
        });

        // Speed controls
        speedButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                setVideoSpeed(speed);
                updateSpeedButtons(speed);
            });
        });

        applyCustomSpeedBtn.addEventListener('click', () => {
            const speed = parseFloat(customSpeedInput.value);
            if (speed >= 0.1 && speed <= 2) {
                setVideoSpeed(speed);
                updateSpeedButtons(speed);
            }
        });

        // Sync controls
        syncPlayBtn.addEventListener('click', async () => {
            try {
                await SyncController.playBoth();
                updatePlaybackButtons(true);
            } catch (error) {
                showError('Failed to start sync playback: ' + error.message);
            }
        });

        syncPauseBtn.addEventListener('click', async () => {
            await SyncController.pauseBoth();
            updatePlaybackButtons(false);
        });

        syncStopBtn.addEventListener('click', async () => {
            await SyncController.stopBoth();
            updatePlaybackButtons(false);
            progressBar.style.width = '0%';
            currentTimeEl.textContent = '0:00';
        });

        // Offset controls
        offsetMinusBtn.addEventListener('click', () => {
            const current = SyncController.getOffset();
            SyncController.setOffset(current - 500);
            offsetValue.textContent = `${(SyncController.getOffset() / 1000).toFixed(1)}s`;
        });

        offsetPlusBtn.addEventListener('click', () => {
            const current = SyncController.getOffset();
            SyncController.setOffset(current + 500);
            offsetValue.textContent = `${(SyncController.getOffset() / 1000).toFixed(1)}s`;
        });
    }

    // Set up sync listeners
    function setupSyncListeners() {
        SyncController.onSyncStateChange((state) => {
            spotifySyncStatus.textContent = state.spotifyReady ? 'Ready' : 'Not ready';
            spotifySyncStatus.className = `sync-state ${state.spotifyReady ? 'ready' : ''}`;

            videoSyncStatus.textContent = state.videoReady ? 'Ready' : 'Not loaded';
            videoSyncStatus.className = `sync-state ${state.videoReady ? 'ready' : ''}`;

            updateSyncControls();
        });

        SyncController.onProgress((progress) => {
            const percent = (progress.currentTime / progress.duration) * 100;
            progressBar.style.width = `${Math.min(percent, 100)}%`;
            currentTimeEl.textContent = formatTime(progress.currentTime);
            totalTimeEl.textContent = formatTime(progress.duration);
        });
    }

    // Perform search
    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        searchResults.innerHTML = '<p class="loading">Searching...</p>';
        searchResults.classList.remove('hidden');

        try {
            const tracks = await SpotifyPlayer.search(query);

            if (tracks.length === 0) {
                searchResults.innerHTML = '<p class="no-results">No results found</p>';
                return;
            }

            searchResults.innerHTML = tracks.map(track => `
                <div class="search-result-item" data-uri="${track.uri}" data-id="${track.id}">
                    <img src="${track.album.images[2]?.url || track.album.images[0]?.url || ''}" alt="">
                    <div class="result-info">
                        <span class="result-name">${escapeHtml(track.name)}</span>
                        <span class="result-artist">${escapeHtml(track.artists.map(a => a.name).join(', '))}</span>
                    </div>
                    <span class="result-duration">${SpotifyPlayer.formatDuration(track.duration_ms)}</span>
                </div>
            `).join('');

            // Add click handlers
            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => selectTrack(item.dataset.id, item.dataset.uri));
            });

        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = `<p class="error">Search failed: ${error.message}</p>`;
        }
    }

    // Select a track
    async function selectTrack(trackId, trackUri) {
        try {
            // Get track details
            const track = await SpotifyPlayer.getTrack(trackId);

            // Update UI
            trackArt.src = track.album.images[0]?.url || '';
            trackName.textContent = track.name;
            trackArtist.textContent = track.artists.map(a => a.name).join(', ');
            trackAlbum.textContent = track.album.name;
            selectedTrackEl.classList.remove('hidden');

            // Update raw data display
            rawTrackData.textContent = JSON.stringify(track, null, 2);

            // Get and display audio features
            const features = await SpotifyPlayer.getAudioFeatures(trackId);
            const formatted = SpotifyPlayer.formatAudioFeatures(features);

            if (formatted) {
                document.getElementById('feature-bpm').textContent = formatted.bpm;
                document.getElementById('feature-key').textContent = formatted.key;
                document.getElementById('feature-energy').textContent = `${formatted.energy}%`;
                document.getElementById('bar-energy').style.width = `${formatted.energy}%`;
                document.getElementById('feature-dance').textContent = `${formatted.danceability}%`;
                document.getElementById('bar-dance').style.width = `${formatted.danceability}%`;
                document.getElementById('feature-valence').textContent = `${formatted.valence}%`;
                document.getElementById('bar-valence').style.width = `${formatted.valence}%`;
                document.getElementById('feature-acoustic').textContent = `${formatted.acousticness}%`;
                document.getElementById('bar-acoustic').style.width = `${formatted.acousticness}%`;
                document.getElementById('feature-instrumental').textContent = `${formatted.instrumentalness}%`;
                document.getElementById('bar-instrumental').style.width = `${formatted.instrumentalness}%`;
                document.getElementById('feature-loudness').textContent = `${formatted.loudness} dB`;
                document.getElementById('feature-duration').textContent = formatted.duration;
                document.getElementById('feature-time-sig').textContent = formatted.timeSignature;

                audioFeaturesEl.classList.remove('hidden');
            }

            rawAudioFeatures.textContent = JSON.stringify(features, null, 2);

            // Get audio analysis (summarized)
            try {
                const analysis = await SpotifyPlayer.getAudioAnalysis(trackId);
                rawAudioAnalysis.textContent = JSON.stringify({
                    track: analysis.track,
                    bars_count: analysis.bars?.length,
                    beats_count: analysis.beats?.length,
                    sections_count: analysis.sections?.length,
                    segments_count: analysis.segments?.length,
                    tatums_count: analysis.tatums?.length,
                    // Include first few sections as sample
                    sections_sample: analysis.sections?.slice(0, 3)
                }, null, 2);
            } catch (e) {
                rawAudioAnalysis.textContent = 'Audio analysis not available';
            }

            // Update sync controller
            SyncController.setTrack({ ...track, uri: trackUri });

            // Hide search results
            searchResults.classList.add('hidden');

        } catch (error) {
            console.error('Error selecting track:', error);
            showError('Failed to load track details: ' + error.message);
        }
    }

    // Load YouTube video
    function loadVideo() {
        const url = youtubeUrlInput.value.trim();
        if (!url) {
            showError('Please enter a YouTube URL');
            return;
        }

        try {
            const videoId = YouTubePlayer.loadVideo(url, true);
            videoPlaceholder.classList.add('hidden');
            speedControls.classList.remove('hidden');
            SyncController.setVideoLoaded(true);
            showSuccess('Video loaded!');
        } catch (error) {
            showError('Failed to load video: ' + error.message);
        }
    }

    // Set video speed
    function setVideoSpeed(speed) {
        SyncController.setVideoSpeed(speed);
    }

    // Update speed buttons active state
    function updateSpeedButtons(speed) {
        speedButtons.forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
        });
        customSpeedInput.value = speed;
    }

    // Update sync controls based on state
    function updateSyncControls() {
        const canSync = SyncController.isReadyToSync();
        syncPlayBtn.disabled = !canSync;
        syncPauseBtn.disabled = !canSync;
        syncStopBtn.disabled = !canSync;
    }

    // Update playback buttons
    function updatePlaybackButtons(isPlaying) {
        syncPlayBtn.disabled = isPlaying;
        syncPauseBtn.disabled = !isPlaying;
    }

    // Format time (ms to mm:ss)
    function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show error message
    function showError(message) {
        // Simple alert for now - could be improved with toast notifications
        alert('Error: ' + message);
    }

    // Show success message
    function showSuccess(message) {
        // Simple alert for now
        console.log('Success:', message);
    }

    // Start the application
    init();
})();
