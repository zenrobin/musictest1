/**
 * Spotify Player Module
 * Wraps the Spotify Web Playback SDK
 */

const SpotifyPlayer = (function() {
    let player = null;
    let deviceId = null;
    let isReady = false;
    let currentTrack = null;
    let isPaused = true;
    let position = 0;
    let duration = 0;

    // Callbacks
    let onReadyCallback = null;
    let onErrorCallback = null;
    let onStateChangeCallback = null;

    // Musical key mapping
    const KEY_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
    const MODE_NAMES = ['Minor', 'Major'];

    // Load Spotify SDK script
    function loadSDK() {
        return new Promise((resolve, reject) => {
            if (window.Spotify) {
                resolve();
                return;
            }

            window.onSpotifyWebPlaybackSDKReady = () => {
                resolve();
            };

            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.onerror = () => reject(new Error('Failed to load Spotify SDK'));
            document.head.appendChild(script);
        });
    }

    // Initialize player
    async function init(getTokenCallback) {
        await loadSDK();

        player = new Spotify.Player({
            name: 'Spotify + Video Sync Playground',
            getOAuthToken: async (cb) => {
                const token = await getTokenCallback();
                cb(token);
            },
            volume: 0.5
        });

        // Error handling
        player.addListener('initialization_error', ({ message }) => {
            console.error('Initialization error:', message);
            if (onErrorCallback) onErrorCallback('init', message);
        });

        player.addListener('authentication_error', ({ message }) => {
            console.error('Authentication error:', message);
            if (onErrorCallback) onErrorCallback('auth', message);
        });

        player.addListener('account_error', ({ message }) => {
            console.error('Account error:', message);
            if (onErrorCallback) onErrorCallback('account', message);
        });

        player.addListener('playback_error', ({ message }) => {
            console.error('Playback error:', message);
            if (onErrorCallback) onErrorCallback('playback', message);
        });

        // Ready
        player.addListener('ready', ({ device_id }) => {
            console.log('Spotify player ready with device ID:', device_id);
            deviceId = device_id;
            isReady = true;
            if (onReadyCallback) onReadyCallback(device_id);
        });

        // Not ready
        player.addListener('not_ready', ({ device_id }) => {
            console.log('Device has gone offline:', device_id);
            isReady = false;
        });

        // State changes
        player.addListener('player_state_changed', (state) => {
            if (!state) return;

            currentTrack = state.track_window?.current_track;
            isPaused = state.paused;
            position = state.position;
            duration = state.duration;

            if (onStateChangeCallback) {
                onStateChangeCallback({
                    track: currentTrack,
                    paused: isPaused,
                    position: position,
                    duration: duration
                });
            }
        });

        // Connect
        const connected = await player.connect();
        if (!connected) {
            throw new Error('Failed to connect to Spotify');
        }

        return player;
    }

    // Search for tracks
    async function search(query, limit = 10) {
        const params = new URLSearchParams({
            q: query,
            type: 'track',
            limit: limit.toString()
        });

        const data = await SpotifyAuth.apiRequest(`/search?${params}`);
        return data.tracks.items;
    }

    // Get track details
    async function getTrack(trackId) {
        return SpotifyAuth.apiRequest(`/tracks/${trackId}`);
    }

    // Get audio features (BPM, key, energy, etc.)
    async function getAudioFeatures(trackId) {
        return SpotifyAuth.apiRequest(`/audio-features/${trackId}`);
    }

    // Get detailed audio analysis
    async function getAudioAnalysis(trackId) {
        return SpotifyAuth.apiRequest(`/audio-analysis/${trackId}`);
    }

    // Play a track
    async function play(trackUri, positionMs = 0) {
        if (!deviceId) {
            throw new Error('Player not ready');
        }

        await SpotifyAuth.apiRequest(`/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [trackUri],
                position_ms: positionMs
            })
        });
    }

    // Pause playback
    async function pause() {
        if (!deviceId) {
            throw new Error('Player not ready');
        }

        await SpotifyAuth.apiRequest(`/me/player/pause?device_id=${deviceId}`, {
            method: 'PUT'
        });
    }

    // Resume playback
    async function resume() {
        if (!deviceId) {
            throw new Error('Player not ready');
        }

        await SpotifyAuth.apiRequest(`/me/player/play?device_id=${deviceId}`, {
            method: 'PUT'
        });
    }

    // Seek to position
    async function seek(positionMs) {
        if (!deviceId) {
            throw new Error('Player not ready');
        }

        // position_ms must be an integer
        const position = Math.round(positionMs);
        await SpotifyAuth.apiRequest(`/me/player/seek?device_id=${deviceId}&position_ms=${position}`, {
            method: 'PUT'
        });
    }

    // Set volume (0-100)
    async function setVolume(volumePercent) {
        if (player) {
            await player.setVolume(volumePercent / 100);
        }
    }

    // Get current state
    async function getState() {
        if (!player) return null;
        return player.getCurrentState();
    }

    // Format audio features for display
    function formatAudioFeatures(features) {
        if (!features) return null;

        return {
            bpm: Math.round(features.tempo),
            key: features.key >= 0 ? `${KEY_NAMES[features.key]} ${MODE_NAMES[features.mode]}` : 'Unknown',
            energy: Math.round(features.energy * 100),
            danceability: Math.round(features.danceability * 100),
            valence: Math.round(features.valence * 100),
            acousticness: Math.round(features.acousticness * 100),
            instrumentalness: Math.round(features.instrumentalness * 100),
            loudness: features.loudness.toFixed(1),
            duration: formatDuration(features.duration_ms),
            durationMs: features.duration_ms,
            timeSignature: `${features.time_signature}/4`
        };
    }

    // Format duration in mm:ss
    function formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Set callbacks
    function onReady(callback) {
        onReadyCallback = callback;
    }

    function onError(callback) {
        onErrorCallback = callback;
    }

    function onStateChange(callback) {
        onStateChangeCallback = callback;
    }

    // Disconnect player
    function disconnect() {
        if (player) {
            player.disconnect();
            player = null;
            deviceId = null;
            isReady = false;
        }
    }

    // Getters
    function getDeviceId() {
        return deviceId;
    }

    function getIsReady() {
        return isReady;
    }

    function getCurrentTrack() {
        return currentTrack;
    }

    function getIsPaused() {
        return isPaused;
    }

    function getPosition() {
        return position;
    }

    function getDuration() {
        return duration;
    }

    return {
        init,
        search,
        getTrack,
        getAudioFeatures,
        getAudioAnalysis,
        play,
        pause,
        resume,
        seek,
        setVolume,
        getState,
        formatAudioFeatures,
        formatDuration,
        onReady,
        onError,
        onStateChange,
        disconnect,
        getDeviceId,
        getIsReady,
        getCurrentTrack,
        getIsPaused,
        getPosition,
        getDuration
    };
})();
