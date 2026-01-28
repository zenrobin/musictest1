# Music + Video Sync Playground

A web-based playground to explore music streaming APIs (Spotify and Apple Music) and synchronize music playback with YouTube videos.

**[Live Demo](https://yourusername.github.io/musictest1/)** (replace with your GitHub Pages URL)

## Features

### Multi-Provider Support
Switch between **Spotify** and **Apple Music** with a simple tab interface. Each provider has its own configuration and authentication.

### Spotify Integration
- **OAuth 2.0 with PKCE** - Secure authentication without exposing client secrets
- **Music Search** - Search Spotify's catalog for any track
- **Rich Audio Features** - View detailed track analysis including:
  - BPM (Tempo)
  - Musical Key
  - Energy, Danceability, Valence
  - Acousticness, Instrumentalness
  - Loudness, Time Signature
- **Web Playback SDK** - Control playback directly in the browser (requires Spotify Premium)

### Apple Music Integration
- **MusicKit JS** - Official Apple Music web SDK
- **Music Search** - Search Apple Music's catalog
- **Basic Track Info** - Album, artist, duration
- **Web Playback** - Play music directly (requires Apple Music subscription)

> **Note:** Apple Music API doesn't provide detailed audio analysis (BPM, key, energy, etc.) like Spotify does.

### YouTube Integration
- **Video Embedding** - Load any YouTube video by URL
- **Playback Speed Control** - Adjust video speed from 0.25x to 2x
- **Muted Playback** - Video plays muted while your music provider plays audio

### Synchronized Playback
- **Universal Play/Pause/Stop** - Control both players simultaneously
- **Timing Offset** - Adjust sync offset to align music with video
- **Progress Tracking** - Visual progress bar and time display

## Deploy to GitHub Pages

This app works entirely client-side and is ready for GitHub Pages deployment.

### Quick Deploy

1. Fork or clone this repository
2. Go to your repo's **Settings** > **Pages**
3. Under "Source", select **Deploy from a branch**
4. Choose **main** (or master) branch and **/ (root)** folder
5. Click **Save**
6. Your site will be live at `https://yourusername.github.io/repo-name/`

### Important: Update Redirect URIs

After deploying, update your music provider settings:

**For Spotify:**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app > Edit Settings
3. Add your GitHub Pages URL to Redirect URIs:
   ```
   https://yourusername.github.io/repo-name/
   ```

**For Apple Music:**
Your Developer Token will work on any domain, but ensure your Apple Developer account is active.

## Local Development

### Option A: Python Simple Server
```bash
cd musictest1
python -m http.server 8000
```
Open `http://localhost:8000`

### Option B: Node.js
```bash
npx serve .
```

### Option C: VS Code Live Server
Right-click `index.html` > "Open with Live Server"

## Setup Guide

### Spotify Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in and click **Create App**
3. Fill in:
   - App Name: `Music Video Sync` (or any name)
   - Redirect URI: Your deployment URL (e.g., `http://localhost:8000/` or GitHub Pages URL)
4. Copy your **Client ID**
5. In the playground, paste your Client ID and click **Connect to Spotify**

### Apple Music Setup

Apple Music requires more setup but provides a different experience:

1. You need an [Apple Developer Account](https://developer.apple.com/) ($99/year)
2. Create a MusicKit identifier and private key
3. Generate a Developer Token (JWT) - [Apple's Guide](https://developer.apple.com/documentation/applemusicapi/getting_keys_and_creating_tokens)
4. Paste the token in the playground

> **Tip:** Developer tokens are valid for up to 6 months. You'll need to regenerate them periodically.

## Usage

### Search and Select Music
1. Choose your provider (Spotify or Apple Music)
2. Connect/authenticate with your account
3. Search for a song and click to select it
4. View audio features (Spotify) or track info (Apple Music)

### Load a YouTube Video
1. Paste any YouTube URL (supports standard, short, and embed URLs)
2. Click **Load Video**
3. Optionally adjust playback speed

### Synchronized Playback
1. Select a track from your music provider
2. Load a YouTube video
3. Click **Play Both** to start synchronized playback
4. Use offset controls if music and video are out of sync
5. Use **Pause Both** or **Stop & Reset** to control playback

## Audio Features Explained (Spotify Only)

| Feature | Description |
|---------|-------------|
| **BPM (Tempo)** | Beats per minute - the speed of the track |
| **Key** | Musical key (C, D, E, etc.) and mode (Major/Minor) |
| **Energy** | Intensity and activity level (0-100%) |
| **Danceability** | How suitable for dancing (0-100%) |
| **Valence** | Musical positivity/happiness (0-100%) |
| **Acousticness** | Confidence the track is acoustic (0-100%) |
| **Instrumentalness** | Likelihood of no vocals (0-100%) |
| **Loudness** | Overall loudness in decibels (dB) |
| **Time Signature** | Beats per measure (e.g., 4/4) |

## Limitations

- **Spotify Premium Required** - Web Playback SDK needs Premium
- **Apple Music Subscription Required** - For full playback
- **Apple Developer Account** - Required for Apple Music ($99/year)
- **Some Videos Restricted** - Some YouTube videos don't allow embedding

## Files

```
musictest1/
├── index.html           # Main HTML structure
├── styles.css           # Styling
├── app.js               # Main application logic
├── spotify-auth.js      # Spotify OAuth PKCE authentication
├── spotify-player.js    # Spotify Web Playback SDK wrapper
├── apple-music-auth.js  # Apple Music MusicKit authentication
├── apple-music-player.js # Apple Music MusicKit player
├── youtube-player.js    # YouTube IFrame API wrapper
├── sync-controller.js   # Provider-agnostic sync logic
└── README.md            # This file
```

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Future Enhancements (Phase 2)

- Custom video upload for more control
- Beat detection and automatic sync alignment
- Multiple track queueing
- Scene markers and bookmarks
- Export sync configurations
- SoundCloud integration
