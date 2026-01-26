/**
 * YouTube Player Module
 * Wraps the YouTube IFrame API
 */

const YouTubePlayer = (function() {
    let player = null;
    let isReady = false;
    let videoId = null;
    let duration = 0;
    let currentTime = 0;
    let playbackRate = 1;

    // Callbacks
    let onReadyCallback = null;
    let onStateChangeCallback = null;
    let onErrorCallback = null;

    // YouTube player states
    const PlayerState = {
        UNSTARTED: -1,
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5
    };

    // Load YouTube IFrame API
    function loadAPI() {
        return new Promise((resolve, reject) => {
            if (window.YT && window.YT.Player) {
                resolve();
                return;
            }

            window.onYouTubeIframeAPIReady = () => {
                resolve();
            };

            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.onerror = () => reject(new Error('Failed to load YouTube API'));
            document.head.appendChild(script);
        });
    }

    // Extract video ID from various YouTube URL formats
    function extractVideoId(url) {
        if (!url) return null;

        // Handle direct video ID
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
            return url;
        }

        const patterns = [
            // Standard watch URL
            /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/,
            // Short URL
            /youtu\.be\/([a-zA-Z0-9_-]{11})/,
            // Embed URL
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
            // YouTube Music
            /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
            // Shorts
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    // Initialize player
    async function init(containerId) {
        await loadAPI();

        return new Promise((resolve, reject) => {
            player = new YT.Player(containerId, {
                height: '100%',
                width: '100%',
                playerVars: {
                    'playsinline': 1,
                    'controls': 1,
                    'rel': 0,
                    'modestbranding': 1,
                    'enablejsapi': 1,
                    'origin': window.location.origin
                },
                events: {
                    'onReady': (event) => {
                        isReady = true;
                        if (onReadyCallback) onReadyCallback();
                        resolve(player);
                    },
                    'onStateChange': (event) => {
                        if (onStateChangeCallback) {
                            onStateChangeCallback(event.data);
                        }
                    },
                    'onError': (event) => {
                        const errorMessages = {
                            2: 'Invalid video ID',
                            5: 'HTML5 player error',
                            100: 'Video not found or private',
                            101: 'Video cannot be embedded',
                            150: 'Video cannot be embedded'
                        };
                        const message = errorMessages[event.data] || `Unknown error: ${event.data}`;
                        if (onErrorCallback) onErrorCallback(message);
                    }
                }
            });
        });
    }

    // Load a video by URL or ID
    function loadVideo(urlOrId, startMuted = true) {
        const id = extractVideoId(urlOrId);
        if (!id) {
            throw new Error('Invalid YouTube URL or video ID');
        }

        videoId = id;

        if (player && isReady) {
            player.cueVideoById(id);
            if (startMuted) {
                player.mute();
            }
            return id;
        }

        throw new Error('Player not ready');
    }

    // Play video
    function play() {
        if (player && isReady) {
            player.playVideo();
        }
    }

    // Pause video
    function pause() {
        if (player && isReady) {
            player.pauseVideo();
        }
    }

    // Stop video
    function stop() {
        if (player && isReady) {
            player.stopVideo();
        }
    }

    // Seek to position (seconds)
    function seek(seconds, allowSeekAhead = true) {
        if (player && isReady) {
            player.seekTo(seconds, allowSeekAhead);
        }
    }

    // Mute
    function mute() {
        if (player && isReady) {
            player.mute();
        }
    }

    // Unmute
    function unmute() {
        if (player && isReady) {
            player.unMute();
        }
    }

    // Set volume (0-100)
    function setVolume(volume) {
        if (player && isReady) {
            player.setVolume(volume);
        }
    }

    // Set playback rate
    function setPlaybackRate(rate) {
        if (player && isReady) {
            player.setPlaybackRate(rate);
            playbackRate = rate;
        }
    }

    // Get available playback rates
    function getAvailablePlaybackRates() {
        if (player && isReady) {
            return player.getAvailablePlaybackRates();
        }
        return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    }

    // Get current playback rate
    function getPlaybackRate() {
        if (player && isReady) {
            return player.getPlaybackRate();
        }
        return playbackRate;
    }

    // Get current time (seconds)
    function getCurrentTime() {
        if (player && isReady) {
            return player.getCurrentTime() || 0;
        }
        return 0;
    }

    // Get duration (seconds)
    function getDuration() {
        if (player && isReady) {
            return player.getDuration() || 0;
        }
        return 0;
    }

    // Get player state
    function getState() {
        if (player && isReady) {
            return player.getPlayerState();
        }
        return PlayerState.UNSTARTED;
    }

    // Check if playing
    function isPlaying() {
        return getState() === PlayerState.PLAYING;
    }

    // Check if paused
    function isPaused() {
        return getState() === PlayerState.PAUSED;
    }

    // Check if muted
    function isMuted() {
        if (player && isReady) {
            return player.isMuted();
        }
        return true;
    }

    // Format time for display
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Set callbacks
    function onReady(callback) {
        onReadyCallback = callback;
    }

    function onStateChange(callback) {
        onStateChangeCallback = callback;
    }

    function onError(callback) {
        onErrorCallback = callback;
    }

    // Destroy player
    function destroy() {
        if (player) {
            player.destroy();
            player = null;
            isReady = false;
            videoId = null;
        }
    }

    // Getters
    function getVideoId() {
        return videoId;
    }

    function getIsReady() {
        return isReady;
    }

    return {
        init,
        loadVideo,
        extractVideoId,
        play,
        pause,
        stop,
        seek,
        mute,
        unmute,
        setVolume,
        setPlaybackRate,
        getAvailablePlaybackRates,
        getPlaybackRate,
        getCurrentTime,
        getDuration,
        getState,
        isPlaying,
        isPaused,
        isMuted,
        formatTime,
        onReady,
        onStateChange,
        onError,
        destroy,
        getVideoId,
        getIsReady,
        PlayerState
    };
})();
