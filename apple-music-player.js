/**
 * Apple Music Player Module
 * Wraps MusicKit JS playback functionality
 */

const AppleMusicPlayer = (function() {
    let isReady = false;
    let currentTrack = null;
    let isPaused = true;
    let position = 0;
    let duration = 0;

    // Callbacks
    let onReadyCallback = null;
    let onErrorCallback = null;
    let onStateChangeCallback = null;

    // Musical key mapping (Apple uses different format)
    const KEY_NAMES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

    // Initialize player
    async function init() {
        const music = AppleMusicAuth.getInstance();
        if (!music) {
            throw new Error('MusicKit not initialized');
        }

        // Set up event listeners
        music.addEventListener('playbackStateDidChange', handlePlaybackStateChange);
        music.addEventListener('nowPlayingItemDidChange', handleNowPlayingChange);
        music.addEventListener('playbackTimeDidChange', handleTimeChange);

        isReady = true;
        if (onReadyCallback) onReadyCallback();

        return music;
    }

    // Handle playback state changes
    function handlePlaybackStateChange(event) {
        const music = AppleMusicAuth.getInstance();
        const state = music.playbackState;

        // MusicKit states: none, loading, playing, paused, stopped, ended, seeking
        isPaused = state !== MusicKit.PlaybackStates.playing;

        if (onStateChangeCallback) {
            onStateChangeCallback({
                track: currentTrack,
                paused: isPaused,
                position: position,
                duration: duration
            });
        }
    }

    // Handle now playing changes
    function handleNowPlayingChange(event) {
        const music = AppleMusicAuth.getInstance();
        currentTrack = music.nowPlayingItem;
        if (currentTrack) {
            duration = (currentTrack.playbackDuration || currentTrack.attributes?.durationInMillis) || 0;
        }
    }

    // Handle time changes
    function handleTimeChange(event) {
        const music = AppleMusicAuth.getInstance();
        position = (music.currentPlaybackTime || 0) * 1000; // Convert to ms
        duration = (music.currentPlaybackDuration || 0) * 1000;
    }

    // Search for tracks
    async function search(query, limit = 10) {
        const music = AppleMusicAuth.getInstance();
        if (!music) throw new Error('MusicKit not initialized');

        try {
            const results = await music.api.music(`/v1/catalog/us/search`, {
                term: query,
                types: ['songs'],
                limit: limit
            });

            const songs = results.data.results.songs?.data || [];

            // Transform to common format
            return songs.map(song => ({
                id: song.id,
                uri: song.id, // Apple Music uses IDs
                name: song.attributes.name,
                artists: [{ name: song.attributes.artistName }],
                album: {
                    name: song.attributes.albumName,
                    images: [
                        { url: song.attributes.artwork?.url?.replace('{w}x{h}', '300x300') || '' }
                    ]
                },
                duration_ms: song.attributes.durationInMillis,
                preview_url: song.attributes.previews?.[0]?.url,
                _raw: song
            }));
        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }

    // Get track details
    async function getTrack(trackId) {
        const music = AppleMusicAuth.getInstance();
        if (!music) throw new Error('MusicKit not initialized');

        try {
            const result = await music.api.music(`/v1/catalog/us/songs/${trackId}`);
            const song = result.data.data[0];

            return {
                id: song.id,
                uri: song.id,
                name: song.attributes.name,
                artists: [{ name: song.attributes.artistName }],
                album: {
                    name: song.attributes.albumName,
                    images: [
                        { url: song.attributes.artwork?.url?.replace('{w}x{h}', '300x300') || '' }
                    ]
                },
                duration_ms: song.attributes.durationInMillis,
                _raw: song
            };
        } catch (error) {
            console.error('Get track error:', error);
            throw error;
        }
    }

    // Get audio features (Apple Music has limited data compared to Spotify)
    async function getAudioFeatures(trackId) {
        // Apple Music doesn't provide the same level of audio analysis as Spotify
        // Return what we can get from the track metadata
        const music = AppleMusicAuth.getInstance();
        if (!music) return null;

        try {
            const result = await music.api.music(`/v1/catalog/us/songs/${trackId}`);
            const song = result.data.data[0];
            const attrs = song.attributes;

            return {
                // Apple provides some genre info but not detailed audio features
                duration_ms: attrs.durationInMillis,
                genre: attrs.genreNames?.[0] || 'Unknown',
                isExplicit: attrs.contentRating === 'explicit',
                releaseDate: attrs.releaseDate,
                // These would need Apple's internal APIs which aren't public
                tempo: null,
                key: null,
                energy: null,
                danceability: null,
                valence: null,
                acousticness: null,
                instrumentalness: null,
                loudness: null,
                time_signature: null,
                _note: 'Apple Music does not provide detailed audio analysis like Spotify'
            };
        } catch (error) {
            console.error('Get audio features error:', error);
            return null;
        }
    }

    // Get audio analysis (not available in Apple Music)
    async function getAudioAnalysis(trackId) {
        return {
            _note: 'Audio analysis is not available through Apple Music API'
        };
    }

    // Play a track
    async function play(trackId, positionMs = 0) {
        const music = AppleMusicAuth.getInstance();
        if (!music) throw new Error('MusicKit not initialized');

        try {
            await music.setQueue({ song: trackId });
            if (positionMs > 0) {
                await music.seekToTime(positionMs / 1000);
            }
            await music.play();
        } catch (error) {
            console.error('Play error:', error);
            throw error;
        }
    }

    // Pause playback
    async function pause() {
        const music = AppleMusicAuth.getInstance();
        if (!music) throw new Error('MusicKit not initialized');

        try {
            await music.pause();
        } catch (error) {
            console.error('Pause error:', error);
            throw error;
        }
    }

    // Resume playback
    async function resume() {
        const music = AppleMusicAuth.getInstance();
        if (!music) throw new Error('MusicKit not initialized');

        try {
            await music.play();
        } catch (error) {
            console.error('Resume error:', error);
            throw error;
        }
    }

    // Seek to position
    async function seek(positionMs) {
        const music = AppleMusicAuth.getInstance();
        if (!music) throw new Error('MusicKit not initialized');

        try {
            await music.seekToTime(positionMs / 1000);
        } catch (error) {
            console.error('Seek error:', error);
            throw error;
        }
    }

    // Set volume (0-100)
    async function setVolume(volumePercent) {
        const music = AppleMusicAuth.getInstance();
        if (music) {
            music.volume = volumePercent / 100;
        }
    }

    // Get current state
    async function getState() {
        const music = AppleMusicAuth.getInstance();
        if (!music) return null;

        return {
            paused: isPaused,
            position: position,
            duration: duration,
            track: currentTrack
        };
    }

    // Format audio features for display
    function formatAudioFeatures(features) {
        if (!features) return null;

        return {
            bpm: features.tempo ? Math.round(features.tempo) : 'N/A',
            key: features.key || 'N/A',
            energy: features.energy ? Math.round(features.energy * 100) : 'N/A',
            danceability: features.danceability ? Math.round(features.danceability * 100) : 'N/A',
            valence: features.valence ? Math.round(features.valence * 100) : 'N/A',
            acousticness: features.acousticness ? Math.round(features.acousticness * 100) : 'N/A',
            instrumentalness: features.instrumentalness ? Math.round(features.instrumentalness * 100) : 'N/A',
            loudness: features.loudness ? features.loudness.toFixed(1) : 'N/A',
            duration: formatDuration(features.duration_ms),
            durationMs: features.duration_ms,
            timeSignature: features.time_signature ? `${features.time_signature}/4` : 'N/A',
            genre: features.genre || 'Unknown',
            _limited: true
        };
    }

    // Format duration in mm:ss
    function formatDuration(ms) {
        if (!ms) return '0:00';
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
        const music = AppleMusicAuth.getInstance();
        if (music) {
            music.removeEventListener('playbackStateDidChange', handlePlaybackStateChange);
            music.removeEventListener('nowPlayingItemDidChange', handleNowPlayingChange);
            music.removeEventListener('playbackTimeDidChange', handleTimeChange);
        }
        isReady = false;
    }

    // Getters
    function getDeviceId() {
        return 'apple-music-web';
    }

    function getIsReady() {
        return isReady && AppleMusicAuth.isAuthorized();
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
