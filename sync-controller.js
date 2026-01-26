/**
 * Sync Controller Module
 * Synchronizes Spotify and YouTube playback
 */

const SyncController = (function() {
    let selectedTrack = null;
    let trackUri = null;
    let isVideoLoaded = false;
    let isSyncing = false;
    let syncOffset = 0; // milliseconds, positive = music delayed, negative = video delayed
    let progressInterval = null;

    // Callbacks
    let onSyncStateChangeCallback = null;
    let onProgressCallback = null;

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
            if (isSyncing) {
                handleSpotifyStateChange(state);
            }
        });
    }

    // Handle YouTube state changes during sync
    function handleYouTubeStateChange(state) {
        // YouTube states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
        if (state === YouTubePlayer.PlayerState.ENDED) {
            // Video ended, stop Spotify too
            SpotifyPlayer.pause().catch(console.error);
            stopProgressTracking();
        }
    }

    // Handle Spotify state changes during sync
    function handleSpotifyStateChange(state) {
        if (state.paused && isSyncing) {
            // Spotify paused, might want to pause video too
            // But we let the user control this via sync controls
        }
    }

    // Set selected track
    function setTrack(track) {
        selectedTrack = track;
        trackUri = track?.uri || null;
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
        return selectedTrack && trackUri && isVideoLoaded && SpotifyPlayer.getIsReady();
    }

    // Update sync state and notify listeners
    function updateSyncState() {
        if (onSyncStateChangeCallback) {
            onSyncStateChangeCallback({
                spotifyReady: SpotifyPlayer.getIsReady() && !!selectedTrack,
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

        try {
            // Mute YouTube
            YouTubePlayer.mute();

            // Calculate starting positions based on offset
            let videoStartTime = 0;
            let spotifyStartTime = 0;

            if (syncOffset > 0) {
                // Positive offset: music starts later
                // Start video immediately, delay Spotify
                spotifyStartTime = syncOffset;
            } else if (syncOffset < 0) {
                // Negative offset: video starts later
                // Start Spotify immediately, delay video
                videoStartTime = Math.abs(syncOffset) / 1000; // Convert to seconds for YouTube
            }

            // Seek both to start positions
            YouTubePlayer.seek(videoStartTime);

            // Small delay to let YouTube seek, then start both
            await new Promise(resolve => setTimeout(resolve, 100));

            // Start video
            YouTubePlayer.play();

            // Start Spotify (at offset position if needed)
            await SpotifyPlayer.play(trackUri, spotifyStartTime);

            // Start progress tracking
            startProgressTracking();

        } catch (error) {
            isSyncing = false;
            throw error;
        }
    }

    // Pause both
    async function pauseBoth() {
        try {
            YouTubePlayer.pause();
            await SpotifyPlayer.pause();
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

        try {
            YouTubePlayer.play();
            await SpotifyPlayer.resume();
        } catch (error) {
            console.error('Error resuming:', error);
        }
    }

    // Stop both and reset
    async function stopBoth() {
        isSyncing = false;
        stopProgressTracking();

        try {
            YouTubePlayer.stop();
            YouTubePlayer.seek(0);
            await SpotifyPlayer.seek(0);
            await SpotifyPlayer.pause();
        } catch (error) {
            console.error('Error stopping:', error);
        }
    }

    // Start progress tracking
    function startProgressTracking() {
        stopProgressTracking(); // Clear any existing interval

        progressInterval = setInterval(() => {
            if (onProgressCallback) {
                const videoTime = YouTubePlayer.getCurrentTime();
                const videoDuration = YouTubePlayer.getDuration();
                const spotifyState = SpotifyPlayer.getPosition();
                const spotifyDuration = SpotifyPlayer.getDuration();

                // Use video as primary timeline (since it's what user sees)
                onProgressCallback({
                    currentTime: videoTime * 1000, // Convert to ms
                    duration: Math.max(videoDuration * 1000, spotifyDuration || 0),
                    videoTime: videoTime,
                    spotifyTime: spotifyState,
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

    return {
        init,
        setTrack,
        setVideoLoaded,
        setOffset,
        getOffset,
        isReadyToSync,
        playBoth,
        pauseBoth,
        resumeBoth,
        stopBoth,
        setVideoSpeed,
        getVideoSpeed,
        onSyncStateChange,
        onProgress,
        getIsSyncing,
        getSelectedTrack
    };
})();
