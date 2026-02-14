/**
 * Main Application
 * Supports both Spotify and Apple Music providers
 */

(function() {
    // Current provider state
    let currentProvider = 'spotify'; // 'spotify' or 'apple'
    let isAuthenticated = false;

    // Provider-specific player references
    const providers = {
        spotify: {
            auth: null, // SpotifyAuth
            player: null, // SpotifyPlayer
            name: 'Spotify'
        },
        apple: {
            auth: null, // AppleMusicAuth
            player: null, // AppleMusicPlayer
            name: 'Apple Music'
        }
    };

    // Get current player module
    function getCurrentPlayer() {
        return currentProvider === 'spotify' ? SpotifyPlayer : AppleMusicPlayer;
    }

    // Get current auth module
    function getCurrentAuth() {
        return currentProvider === 'spotify' ? SpotifyAuth : AppleMusicAuth;
    }

    // DOM Elements - Provider Tabs
    const providerTabs = document.querySelectorAll('.provider-tab');

    // DOM Elements - Spotify Config
    const configSpotify = document.getElementById('config-spotify');
    const spotifyClientIdInput = document.getElementById('spotify-client-id');
    const spotifySaveConfigBtn = document.getElementById('spotify-save-config');
    const spotifyAuthBtn = document.getElementById('spotify-auth-btn');
    const spotifyAuthStatus = document.getElementById('spotify-auth-status');
    const spotifyUserInfo = document.getElementById('spotify-user-info');
    const redirectUriDisplay = document.getElementById('redirect-uri');

    // DOM Elements - Apple Config
    const configApple = document.getElementById('config-apple');
    const appleDevTokenInput = document.getElementById('apple-dev-token');
    const appleSaveConfigBtn = document.getElementById('apple-save-config');
    const appleAuthBtn = document.getElementById('apple-auth-btn');
    const appleAuthStatus = document.getElementById('apple-auth-status');
    const appleUserInfo = document.getElementById('apple-user-info');

    // DOM Elements - Playground
    const playground = document.getElementById('playground');
    const musicSectionTitle = document.getElementById('music-section-title');
    const audioFeaturesNote = document.getElementById('audio-features-note');
    const premiumNote = document.getElementById('premium-note');
    const musicSyncLabel = document.getElementById('music-sync-label');

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
    const musicSyncStatus = document.getElementById('music-sync-status');
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

    // Cache for search results (to avoid re-fetching)
    let searchResultsCache = {};

    // Initialize application
    async function init() {
        // Display version
        const versionDisplay = document.getElementById('version-display');
        if (versionDisplay && typeof VERSION !== 'undefined') {
            versionDisplay.textContent = VERSION.getDisplayString();
        }

        // Display redirect URI
        redirectUriDisplay.textContent = window.location.origin + window.location.pathname;

        // Load saved configurations
        loadSavedConfigs();

        // Check for Spotify OAuth callback
        const hasSpotifyCallback = await handleSpotifyAuthCallback();

        // If not a callback, check for existing Spotify session
        if (!hasSpotifyCallback) {
            const savedSpotifyClientId = localStorage.getItem('spotify_client_id');
            if (savedSpotifyClientId) {
                spotifyClientIdInput.value = savedSpotifyClientId;
                spotifyAuthBtn.disabled = false;
                const hasValidSession = SpotifyAuth.init(savedSpotifyClientId);
                if (hasValidSession) {
                    await completeSpotifyAuth();
                }
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

    // Load saved configurations
    function loadSavedConfigs() {
        // Spotify
        const savedSpotifyId = localStorage.getItem('spotify_client_id');
        if (savedSpotifyId) {
            spotifyClientIdInput.value = savedSpotifyId;
            spotifyAuthBtn.disabled = false;
        }

        // Apple Music
        const savedAppleToken = localStorage.getItem('apple_music_token');
        if (savedAppleToken) {
            appleDevTokenInput.value = savedAppleToken;
            appleAuthBtn.disabled = false;
        }

        // Saved provider preference
        const savedProvider = localStorage.getItem('preferred_provider');
        if (savedProvider && (savedProvider === 'spotify' || savedProvider === 'apple')) {
            switchProvider(savedProvider);
        }
    }

    // Switch between providers
    function switchProvider(provider) {
        currentProvider = provider;
        localStorage.setItem('preferred_provider', provider);

        // Update tabs
        providerTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.provider === provider);
        });

        // Show/hide config sections
        configSpotify.classList.toggle('hidden', provider !== 'spotify');
        configApple.classList.toggle('hidden', provider !== 'apple');

        // Update UI labels
        const providerName = provider === 'spotify' ? 'Spotify' : 'Apple Music';
        musicSectionTitle.textContent = providerName;
        musicSyncLabel.textContent = `${providerName}:`;

        // Update premium note
        if (provider === 'apple') {
            premiumNote.textContent = 'Note: Playback requires an Apple Music subscription';
            audioFeaturesNote.classList.remove('hidden');
        } else {
            premiumNote.textContent = 'Note: Playback requires Spotify Premium';
            audioFeaturesNote.classList.add('hidden');
        }

        // Update sync controller with current provider
        SyncController.setProvider(provider);

        // Reset UI state when switching
        resetPlaygroundUI();

        // Check authentication status for new provider
        updateAuthStatus();
    }

    // Reset playground UI when switching providers
    function resetPlaygroundUI() {
        selectedTrackEl.classList.add('hidden');
        audioFeaturesEl.classList.add('hidden');
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
        rawTrackData.textContent = 'No track selected';
        rawAudioFeatures.textContent = 'No track selected';
        rawAudioAnalysis.textContent = 'No track selected';
        SyncController.setTrack(null);
    }

    // Update authentication status display
    function updateAuthStatus() {
        if (currentProvider === 'spotify') {
            isAuthenticated = SpotifyAuth.isAuthenticated();
            playground.classList.toggle('hidden', !isAuthenticated);
        } else {
            isAuthenticated = AppleMusicAuth.isAuthorized();
            playground.classList.toggle('hidden', !isAuthenticated);
        }
        updateSyncControls();
    }

    // Handle Spotify OAuth callback
    async function handleSpotifyAuthCallback() {
        try {
            const handled = await SpotifyAuth.handleCallback();
            if (handled) {
                currentProvider = 'spotify';
                switchProvider('spotify');
                await completeSpotifyAuth();
                return true;
            }
        } catch (error) {
            console.error('Spotify auth callback error:', error);
            showError('Spotify authentication failed: ' + error.message);
        }
        return false;
    }

    // Complete Spotify authentication
    async function completeSpotifyAuth() {
        try {
            const profile = await SpotifyAuth.getUserProfile();
            spotifyUserInfo.textContent = `Connected as ${profile.display_name || profile.id}`;
            spotifyAuthStatus.classList.remove('hidden');
            spotifyAuthStatus.querySelector('.status-dot').classList.add('online');
            spotifyAuthBtn.textContent = 'Disconnect';
            spotifyAuthBtn.classList.remove('btn-primary');
            spotifyAuthBtn.classList.add('btn-danger');

            playground.classList.remove('hidden');
            isAuthenticated = true;

            await initSpotifyPlayer();
        } catch (error) {
            console.error('Error completing Spotify auth:', error);
            showError('Failed to complete Spotify authentication: ' + error.message);
        }
    }

    // Initialize Spotify Player
    async function initSpotifyPlayer() {
        try {
            playerStatusText.textContent = 'Initializing Spotify player...';

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

            await SpotifyPlayer.init(() => SpotifyAuth.getAccessToken());
        } catch (error) {
            console.error('Failed to initialize Spotify player:', error);
            playerStatusText.textContent = 'Failed to initialize player';
        }
    }

    // Complete Apple Music authentication
    async function completeAppleAuth() {
        try {
            await AppleMusicAuth.authorize();
            appleUserInfo.textContent = 'Connected to Apple Music';
            appleAuthStatus.classList.remove('hidden');
            appleAuthStatus.querySelector('.status-dot').classList.add('online');
            appleAuthBtn.textContent = 'Disconnect';
            appleAuthBtn.classList.remove('btn-primary');
            appleAuthBtn.classList.add('btn-danger');

            playground.classList.remove('hidden');
            isAuthenticated = true;

            await initAppleMusicPlayer();
        } catch (error) {
            console.error('Error completing Apple Music auth:', error);
            showError('Failed to complete Apple Music authentication: ' + error.message);
        }
    }

    // Initialize Apple Music Player
    async function initAppleMusicPlayer() {
        try {
            playerStatusText.textContent = 'Initializing Apple Music player...';

            AppleMusicPlayer.onReady(() => {
                playerStatusText.textContent = 'Player ready';
                document.querySelector('#player-status .status-dot').classList.remove('offline');
                document.querySelector('#player-status .status-dot').classList.add('online');
                updateSyncControls();
            });

            AppleMusicPlayer.onError((message) => {
                playerStatusText.textContent = `Error: ${message}`;
            });

            await AppleMusicPlayer.init();
        } catch (error) {
            console.error('Failed to initialize Apple Music player:', error);
            playerStatusText.textContent = 'Failed to initialize player';
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        // Provider tabs
        providerTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchProvider(tab.dataset.provider);
            });
        });

        // Spotify config
        spotifySaveConfigBtn.addEventListener('click', () => {
            const clientId = spotifyClientIdInput.value.trim();
            if (clientId) {
                localStorage.setItem('spotify_client_id', clientId);
                spotifyAuthBtn.disabled = false;
                showSuccess('Spotify configuration saved!');
            } else {
                showError('Please enter a Client ID');
            }
        });

        spotifyAuthBtn.addEventListener('click', async () => {
            if (SpotifyAuth.isAuthenticated()) {
                SpotifyAuth.logout();
                SpotifyPlayer.disconnect();
                playground.classList.add('hidden');
                spotifyAuthStatus.classList.add('hidden');
                spotifyAuthBtn.textContent = 'Connect to Spotify';
                spotifyAuthBtn.classList.remove('btn-danger');
                spotifyAuthBtn.classList.add('btn-primary');
                isAuthenticated = false;
                playerStatusText.textContent = 'Player not ready';
                document.querySelector('#player-status .status-dot').classList.remove('online');
                document.querySelector('#player-status .status-dot').classList.add('offline');
            } else {
                const clientId = spotifyClientIdInput.value.trim();
                if (!clientId) {
                    showError('Please enter a Client ID first');
                    return;
                }
                SpotifyAuth.init(clientId);
                SpotifyAuth.authorize();
            }
        });

        // Apple Music config
        appleSaveConfigBtn.addEventListener('click', async () => {
            const token = appleDevTokenInput.value.trim();
            if (token) {
                try {
                    await AppleMusicAuth.init(token);
                    localStorage.setItem('apple_music_token', token);
                    appleAuthBtn.disabled = false;
                    showSuccess('Apple Music configuration saved!');
                } catch (error) {
                    showError('Invalid token: ' + error.message);
                }
            } else {
                showError('Please enter a Developer Token');
            }
        });

        appleAuthBtn.addEventListener('click', async () => {
            if (AppleMusicAuth.isAuthorized()) {
                await AppleMusicAuth.logout();
                AppleMusicPlayer.disconnect();
                playground.classList.add('hidden');
                appleAuthStatus.classList.add('hidden');
                appleAuthBtn.textContent = 'Connect to Apple Music';
                appleAuthBtn.classList.remove('btn-danger');
                appleAuthBtn.classList.add('btn-primary');
                isAuthenticated = false;
                playerStatusText.textContent = 'Player not ready';
                document.querySelector('#player-status .status-dot').classList.remove('online');
                document.querySelector('#player-status .status-dot').classList.add('offline');
            } else {
                const token = appleDevTokenInput.value.trim();
                if (!token) {
                    showError('Please save your Developer Token first');
                    return;
                }
                if (!AppleMusicAuth.getIsConfigured()) {
                    await AppleMusicAuth.init(token);
                }
                await completeAppleAuth();
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
            musicSyncStatus.textContent = state.musicReady ? 'Ready' : 'Not ready';
            musicSyncStatus.className = `sync-state ${state.musicReady ? 'ready' : ''}`;

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

        const player = getCurrentPlayer();
        searchResults.innerHTML = '<p class="loading">Searching...</p>';
        searchResults.classList.remove('hidden');

        try {
            const tracks = await player.search(query);

            if (tracks.length === 0) {
                searchResults.innerHTML = '<p class="no-results">No results found</p>';
                return;
            }

            // Cache search results to avoid re-fetching
            searchResultsCache = {};
            tracks.forEach(track => {
                searchResultsCache[track.id] = track;
            });

            searchResults.innerHTML = tracks.map(track => `
                <div class="search-result-item" data-uri="${track.uri}" data-id="${track.id}">
                    <img src="${track.album.images[0]?.url || ''}" alt="">
                    <div class="result-info">
                        <span class="result-name">${escapeHtml(track.name)}</span>
                        <span class="result-artist">${escapeHtml(track.artists.map(a => a.name).join(', '))}</span>
                    </div>
                    <span class="result-duration">${player.formatDuration(track.duration_ms)}</span>
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
        const player = getCurrentPlayer();

        try {
            // Use cached track data from search results, or fetch if not available
            let track = searchResultsCache[trackId];
            if (!track) {
                try {
                    track = await player.getTrack(trackId);
                } catch (e) {
                    console.warn('Could not fetch track details:', e);
                    showError('Could not load track details. Please try searching again.');
                    return;
                }
            }

            // Update UI
            trackArt.src = track.album?.images?.[0]?.url || '';
            trackName.textContent = track.name;
            trackArtist.textContent = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
            trackAlbum.textContent = track.album?.name || 'Unknown Album';
            selectedTrackEl.classList.remove('hidden');

            // Update raw data display
            rawTrackData.textContent = JSON.stringify(track._raw || track, null, 2);

            // Try to get audio features (may fail for new Spotify apps - API deprecated Nov 2024)
            let features = null;
            let formatted = null;
            try {
                features = await player.getAudioFeatures(trackId);
                formatted = player.formatAudioFeatures(features);
            } catch (e) {
                console.warn('Audio features not available:', e.message);
                // Create basic features from track data
                features = {
                    duration_ms: track.duration_ms,
                    _note: 'Audio features API not available (deprecated for new apps Nov 2024)'
                };
                formatted = {
                    bpm: 'N/A',
                    key: 'N/A',
                    energy: 'N/A',
                    danceability: 'N/A',
                    valence: 'N/A',
                    acousticness: 'N/A',
                    instrumentalness: 'N/A',
                    loudness: 'N/A',
                    duration: player.formatDuration(track.duration_ms),
                    timeSignature: 'N/A',
                    _limited: true
                };
            }

            if (formatted) {
                document.getElementById('feature-bpm').textContent = formatted.bpm;
                document.getElementById('feature-key').textContent = formatted.key;

                const setFeature = (id, value, barId) => {
                    document.getElementById(id).textContent = typeof value === 'number' ? `${value}%` : value;
                    if (barId && typeof value === 'number') {
                        document.getElementById(barId).style.width = `${value}%`;
                    } else if (barId) {
                        document.getElementById(barId).style.width = '0%';
                    }
                };

                setFeature('feature-energy', formatted.energy, 'bar-energy');
                setFeature('feature-dance', formatted.danceability, 'bar-dance');
                setFeature('feature-valence', formatted.valence, 'bar-valence');
                setFeature('feature-acoustic', formatted.acousticness, 'bar-acoustic');
                setFeature('feature-instrumental', formatted.instrumentalness, 'bar-instrumental');

                document.getElementById('feature-loudness').textContent =
                    formatted.loudness !== 'N/A' ? `${formatted.loudness} dB` : 'N/A';
                document.getElementById('feature-duration').textContent = formatted.duration;
                document.getElementById('feature-time-sig').textContent = formatted.timeSignature;

                // Show note for limited data (Apple Music or deprecated Spotify API)
                audioFeaturesNote.classList.toggle('hidden', !formatted._limited);
                audioFeaturesEl.classList.remove('hidden');
            }

            rawAudioFeatures.textContent = JSON.stringify(features, null, 2);

            // Get audio analysis (Spotify only) - may also be deprecated
            if (currentProvider === 'spotify') {
                try {
                    const analysis = await player.getAudioAnalysis(trackId);
                    rawAudioAnalysis.textContent = JSON.stringify({
                        track: analysis.track,
                        bars_count: analysis.bars?.length,
                        beats_count: analysis.beats?.length,
                        sections_count: analysis.sections?.length,
                        segments_count: analysis.segments?.length,
                        tatums_count: analysis.tatums?.length,
                        sections_sample: analysis.sections?.slice(0, 3)
                    }, null, 2);
                } catch (e) {
                    rawAudioAnalysis.textContent = 'Audio analysis not available (API deprecated Nov 2024)';
                }
            } else {
                try {
                    const analysis = await player.getAudioAnalysis(trackId);
                    rawAudioAnalysis.textContent = JSON.stringify(analysis, null, 2);
                } catch (e) {
                    rawAudioAnalysis.textContent = 'Audio analysis not available';
                }
            }

            // Update sync controller
            SyncController.setTrack({ ...track, uri: trackUri, id: trackId });

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
            YouTubePlayer.loadVideo(url, true);
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
        console.error(message);
        alert('Error: ' + message);
    }

    // Show success message
    function showSuccess(message) {
        console.log('Success:', message);
    }

    // Start the application
    init();
})();
