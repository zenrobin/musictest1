/**
 * Apple Music Authentication Module
 * Uses MusicKit JS for Apple Music integration
 */

const AppleMusicAuth = (function() {
    let musicKitInstance = null;
    let isConfigured = false;
    let developerToken = null;

    // Load MusicKit JS
    function loadMusicKit() {
        return new Promise((resolve, reject) => {
            if (window.MusicKit) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
            script.setAttribute('data-web-components', '');
            script.async = true;

            script.onload = () => {
                // Wait for MusicKit to be ready
                document.addEventListener('musickitloaded', () => {
                    resolve();
                }, { once: true });

                // Fallback if event already fired
                if (window.MusicKit) {
                    resolve();
                }
            };

            script.onerror = () => reject(new Error('Failed to load MusicKit JS'));
            document.head.appendChild(script);
        });
    }

    // Initialize with developer token
    async function init(token) {
        if (!token) {
            throw new Error('Developer token is required');
        }

        developerToken = token;
        localStorage.setItem('apple_music_token', token);

        await loadMusicKit();

        try {
            musicKitInstance = await MusicKit.configure({
                developerToken: token,
                app: {
                    name: 'Spotify + Video Sync Playground',
                    build: '1.0.0'
                }
            });

            isConfigured = true;
            return true;
        } catch (error) {
            console.error('MusicKit configuration error:', error);
            throw new Error('Failed to configure MusicKit: ' + error.message);
        }
    }

    // Authorize user
    async function authorize() {
        if (!musicKitInstance) {
            throw new Error('MusicKit not initialized');
        }

        try {
            const musicUserToken = await musicKitInstance.authorize();
            localStorage.setItem('apple_music_user_token', musicUserToken);
            return musicUserToken;
        } catch (error) {
            console.error('Authorization error:', error);
            throw new Error('Failed to authorize: ' + error.message);
        }
    }

    // Check if authorized
    function isAuthorized() {
        return musicKitInstance?.isAuthorized ?? false;
    }

    // Get MusicKit instance
    function getInstance() {
        return musicKitInstance;
    }

    // Logout
    async function logout() {
        if (musicKitInstance) {
            try {
                await musicKitInstance.unauthorize();
            } catch (e) {
                console.log('Logout error:', e);
            }
        }
        localStorage.removeItem('apple_music_user_token');
    }

    // Check if configured
    function getIsConfigured() {
        return isConfigured;
    }

    // Load saved token
    function loadSavedToken() {
        return localStorage.getItem('apple_music_token');
    }

    return {
        init,
        authorize,
        isAuthorized,
        getInstance,
        logout,
        getIsConfigured,
        loadSavedToken
    };
})();
