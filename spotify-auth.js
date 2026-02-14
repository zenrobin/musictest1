/**
 * Spotify Authentication Module
 * Uses OAuth 2.0 with PKCE flow (no client secret required)
 */

const SpotifyAuth = (function() {
    const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
    const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

    // Scopes needed for playback and data access
    const SCOPES = [
        'streaming',
        'user-read-email',
        'user-read-private',
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'playlist-read-private',
        'playlist-read-collaborative'
    ].join(' ');

    let clientId = null;
    let accessToken = null;
    let refreshToken = null;
    let tokenExpiry = null;
    let codeVerifier = null;

    // Generate random string for PKCE
    function generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return values.reduce((acc, x) => acc + possible[x % possible.length], '');
    }

    // Generate code challenge from verifier
    async function generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }

    // Get redirect URI (current page URL without hash/query)
    function getRedirectUri() {
        return window.location.origin + window.location.pathname;
    }

    // Initialize with client ID
    function init(id) {
        clientId = id;
        localStorage.setItem('spotify_client_id', id);

        // Check for existing tokens
        const storedToken = localStorage.getItem('spotify_access_token');
        const storedExpiry = localStorage.getItem('spotify_token_expiry');
        const storedRefresh = localStorage.getItem('spotify_refresh_token');

        if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
            accessToken = storedToken;
            tokenExpiry = parseInt(storedExpiry);
            refreshToken = storedRefresh;
            return true;
        }

        return false;
    }

    // Start authorization flow
    async function authorize() {
        if (!clientId) {
            throw new Error('Client ID not set');
        }

        // Generate and store code verifier
        codeVerifier = generateRandomString(64);
        localStorage.setItem('spotify_code_verifier', codeVerifier);

        const codeChallenge = await generateCodeChallenge(codeVerifier);

        const params = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: getRedirectUri(),
            scope: SCOPES,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            state: generateRandomString(16)
        });

        // Store state for verification
        localStorage.setItem('spotify_auth_state', params.get('state'));

        // Redirect to Spotify auth
        window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
    }

    // Handle callback from Spotify
    async function handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
            throw new Error(`Authorization error: ${error}`);
        }

        if (!code) {
            return false; // No callback to handle
        }

        // Verify state
        const storedState = localStorage.getItem('spotify_auth_state');
        if (state !== storedState) {
            throw new Error('State mismatch - possible CSRF attack');
        }

        // Get stored code verifier
        const verifier = localStorage.getItem('spotify_code_verifier');
        if (!verifier) {
            throw new Error('Code verifier not found');
        }

        // Get stored client ID
        clientId = localStorage.getItem('spotify_client_id');
        if (!clientId) {
            throw new Error('Client ID not found');
        }

        // Exchange code for tokens
        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: clientId,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: getRedirectUri(),
                code_verifier: verifier
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Token error: ${errorData.error_description || errorData.error}`);
        }

        const data = await response.json();

        // Store tokens
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000);

        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_refresh_token', refreshToken);
        localStorage.setItem('spotify_token_expiry', tokenExpiry.toString());

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Clean up auth state
        localStorage.removeItem('spotify_auth_state');
        localStorage.removeItem('spotify_code_verifier');

        return true;
    }

    // Refresh access token
    async function refreshAccessToken() {
        if (!refreshToken || !clientId) {
            throw new Error('Cannot refresh - missing refresh token or client ID');
        }

        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: clientId,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            // Token refresh failed, need to re-authenticate
            logout();
            throw new Error('Token refresh failed - please re-authenticate');
        }

        const data = await response.json();

        accessToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000);

        if (data.refresh_token) {
            refreshToken = data.refresh_token;
            localStorage.setItem('spotify_refresh_token', refreshToken);
        }

        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_token_expiry', tokenExpiry.toString());

        return accessToken;
    }

    // Get valid access token (refreshes if needed)
    async function getAccessToken() {
        if (!accessToken) {
            return null;
        }

        // Refresh if token expires in less than 5 minutes
        if (tokenExpiry && Date.now() > tokenExpiry - 300000) {
            await refreshAccessToken();
        }

        return accessToken;
    }

    // Make authenticated API request
    async function apiRequest(endpoint, options = {}) {
        const token = await getAccessToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const url = endpoint.startsWith('http')
            ? endpoint
            : `https://api.spotify.com/v1${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });

        if (response.status === 401) {
            // Token might be invalid, try to refresh
            await refreshAccessToken();
            return apiRequest(endpoint, options);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        // Handle empty responses
        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    // Get current user profile
    async function getUserProfile() {
        return apiRequest('/me');
    }

    // Logout
    function logout() {
        accessToken = null;
        refreshToken = null;
        tokenExpiry = null;

        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expiry');
    }

    // Check if authenticated
    function isAuthenticated() {
        return !!accessToken;
    }

    return {
        init,
        authorize,
        handleCallback,
        getAccessToken,
        apiRequest,
        getUserProfile,
        logout,
        isAuthenticated,
        getRedirectUri
    };
})();
