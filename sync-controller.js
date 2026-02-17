/**
 * Sync Controller Module
 * Synchronizes music (Spotify or Apple Music) and YouTube playback
 */

const SyncController = (function() {
    let currentProvider = 'spotify'; // 'spotify' or 'apple'
    let selectedTrack = null;
    let trackUri = null;
    let trackId = null;
    let isVideoLoaded = false;
    let isSyncing = false;
    let syncOffset = 0; // milliseconds, positive = music delayed, negative = video delayed
    let progressInterval = null;

    // Callbacks
    let onSyncStateChangeCallback = null;
    let onProgressCallback = null;

    // Get current music player
    function getMusicPlayer() {
        return currentProvider === 'spotify' ? SpotifyPlayer : AppleMusicPlayer;
    }

    // Set current provider
    function setProvider(provider) {
        currentProvider = provider;
        // Reset track when switching providers
        selectedTrack = null;
        trackUri = null;
        trackId = null;
        updateSyncState();
    }

    // Initialize sync controller
    function init() {
        // Set up YouTube state change listener
        YouTubePlayer.onStateChange((state) => {
            if (isSyncing) {
                handleYouTubeStateChange(state);
            }
        });

        // Set up Spotify state change listener
        SpotifyPlayer.onStateChange((state) => {
            if (isSyncing && currentProvider === 'spotify') {
                handleMusicStateChange(state);
            }
        });

        // Set up Apple Music state change listener
        AppleMusicPlayer.onStateChange((state) => {
            if (isSyncing && currentProvider === 'apple') {
                handleMusicStateChange(state);
            }
        });
    }

    // Handle YouTube state changes during sync
    function handleYouTubeStateChange(state) {
        // YouTube states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
        if (state === YouTubePlayer.PlayerState.ENDED) {
            // Video ended - stop tracking but don't pause music immediately.
            // App.js handles fade out or immediate stop.
            stopProgressTracking();
        }
    }

    // Handle music state changes during sync
    function handleMusicStateChange(state) {
        if (state.paused && isSyncing) {
            // Music paused, might want to pause video too
            // But we let the user control this via sync controls
        }
    }

    // Set selected track
    function setTrack(track) {
        selectedTrack = track;
        trackUri = track?.uri || null;
        trackId = track?.id || null;
        updateSyncState();
    }

    // Set video loaded state
    function setVideoLoaded(loaded) {
        isVideoLoaded = loaded;
        updateSyncState();
    }

    // Set sync offset (milliseconds)
    function setOffset(offsetMs) {
        syncOffset = offsetMs;
    }

    // Get sync offset
    function getOffset() {
        return syncOffset;
    }

    // Check if ready to sync
    function isReadyToSync() {
        const player = getMusicPlayer();
        const musicReady = player.getIsReady() && selectedTrack && (trackUri || trackId);
        return musicReady && isVideoLoaded;
    }

    // Update sync state and notify listeners
    function updateSyncState() {
        if (onSyncStateChangeCallback) {
            const player = getMusicPlayer();
            onSyncStateChangeCallback({
                musicReady: player.getIsReady() && !!selectedTrack,
                videoReady: isVideoLoaded,
                canSync: isReadyToSync()
            });
        }
    }

    // Play both synchronized
    async function playBoth() {
        if (!isReadyToSync()) {
            throw new Error('Not ready to sync - need both track and video');
        }

        isSyncing = true;
        const player = getMusicPlayer();

        try {
            // Mute YouTube
            YouTubePlayer.mute();

            // Calculate starting positions based on offset
            let videoStartTime = 0;
            let musicStartTime = 0;

            if (syncOffset > 0) {
                // Positive offset: music starts later
                // Start video immediately, delay music
                musicStartTime = syncOffset;
            } else if (syncOffset < 0) {
                // Negative offset: video starts later
                // Start music immediately, delay video
                videoStartTime = Math.abs(syncOffset) / 1000; // Convert to seconds for YouTube
            }

            // Seek both to start positions
            YouTubePlayer.seek(videoStartTime);

            // Small delay to let YouTube seek, then start both
            await new Promise(resolve => setTimeout(resolve, 100));

            // Start video
            YouTubePlayer.play();

            // Start music (at offset position if needed)
            // For Spotify, use URI; for Apple Music, use ID
            const trackIdentifier = currentProvider === 'spotify' ? trackUri : trackId;
            await player.play(trackIdentifier, musicStartTime);

            // Start progress tracking
            startProgressTracking();

        } catch (error) {
            isSyncing = false;
            throw error;
        }
    }

    // Pause both
    async function pauseBoth() {
        const player = getMusicPlayer();
        try {
            YouTubePlayer.pause();
            await player.pause();
        } catch (error) {
            console.error('Error pausing:', error);
        }
    }

    // Resume both from current position
    async function resumeBoth() {
        if (!isSyncing) {
            // If not in sync mode, just start fresh
            await playBoth();
            return;
        }

        const player = getMusicPlayer();
        try {
            YouTubePlayer.play();
            await player.resume();
        } catch (error) {
            console.error('Error resuming:', error);
        }
    }

    // Stop both and reset
    async function stopBoth() {
        isSyncing = false;
        stopProgressTracking();

        const player = getMusicPlayer();
        try {
            YouTubePlayer.pause();
            YouTubePlayer.seek(0);
            await player.seek(0);
            await player.pause();
        } catch (error) {
            console.error('Error stopping:', error);
        }
    }

    // Seek both to a specific position (in milliseconds based on video timeline)
    async function seekBoth(positionMs) {
        const player = getMusicPlayer();
        const videoPositionSec = positionMs / 1000;

        try {
            // Seek video
            YouTubePlayer.seek(videoPositionSec);

            // Seek music (accounting for offset, must be integer)
            const musicPositionMs = Math.max(0, Math.round(positionMs + syncOffset));
            await player.seek(musicPositionMs);
        } catch (error) {
            console.error('Error seeking:', error);
        }
    }

    // Start progress tracking
    function startProgressTracking() {
        stopProgressTracking(); // Clear any existing interval

        progressInterval = setInterval(() => {
            if (onProgressCallback) {
                const videoTime = YouTubePlayer.getCurrentTime();
                const videoDuration = YouTubePlayer.getDuration();
                const player = getMusicPlayer();
                const musicPosition = player.getPosition();

                // Use video duration as the scrubber timeline (video is primary)
                onProgressCallback({
                    currentTime: videoTime * 1000, // Convert to ms
                    duration: videoDuration * 1000, // Video duration only
                    videoTime: videoTime,
                    musicTime: musicPosition,
                    isPlaying: YouTubePlayer.isPlaying()
                });
            }
        }, 250); // Update 4 times per second
    }

    // Stop progress tracking
    function stopProgressTracking() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    // Set video playback speed
    function setVideoSpeed(rate) {
        YouTubePlayer.setPlaybackRate(rate);
    }

    // Get video playback speed
    function getVideoSpeed() {
        return YouTubePlayer.getPlaybackRate();
    }

    // Sync state change callback
    function onSyncStateChange(callback) {
        onSyncStateChangeCallback = callback;
    }

    // Progress callback
    function onProgress(callback) {
        onProgressCallback = callback;
    }

    // Get sync status
    function getIsSyncing() {
        return isSyncing;
    }

    // Get selected track
    function getSelectedTrack() {
        return selectedTrack;
    }

    // Get current provider
    function getProvider() {
        return currentProvider;
    }

    return {
        init,
        setProvider,
        getProvider,
        setTrack,
        setVideoLoaded,
        setOffset,
        getOffset,
        isReadyToSync,
        playBoth,
        pauseBoth,
        resumeBoth,
        stopBoth,
        seekBoth,
        setVideoSpeed,
        getVideoSpeed,
        onSyncStateChange,
        onProgress,
        getIsSyncing,
        getSelectedTrack
    };
})();
