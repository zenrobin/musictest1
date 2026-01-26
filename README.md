# Spotify + Video Sync Playground

A web-based playground to explore the Spotify API and synchronize music playback with YouTube videos.

## Features

### Spotify Integration
- **OAuth 2.0 with PKCE** - Secure authentication without exposing client secrets
- **Music Search** - Search Spotify's catalog for any track
- **Audio Features** - View detailed track analysis including:
  - BPM (Tempo)
  - Musical Key
  - Energy level
  - Danceability
  - Valence (mood/positivity)
  - Acousticness
  - Instrumentalness
  - Loudness
  - Time Signature
- **Web Playback SDK** - Control playback directly in the browser (requires Spotify Premium)

### YouTube Integration
- **Video Embedding** - Load any YouTube video by URL
- **Playback Speed Control** - Adjust video speed from 0.25x to 2x
- **Muted Playback** - Video plays muted while Spotify provides audio

### Synchronized Playback
- **Universal Play/Pause/Stop** - Control both players simultaneously
- **Timing Offset** - Adjust sync offset to align music with video
- **Progress Tracking** - Visual progress bar and time display

## Setup

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create App"
4. Fill in the details:
   - App Name: `Video Sync Playground` (or any name)
   - App Description: `Test app for syncing music with video`
   - Redirect URI: `http://localhost:8000/` (or your hosting URL)
5. Check the agreement box and click "Create"
6. Copy your **Client ID** from the app settings

### 2. Configure Redirect URI

In your Spotify app settings, add your redirect URI. This should match exactly where you're hosting the app:
- Local development: `http://localhost:8000/`
- GitHub Pages: `https://yourusername.github.io/repo-name/`
- Other hosting: Your exact URL

### 3. Run the App

#### Option A: Python Simple Server
```bash
cd musictest1
python -m http.server 8000
```
Then open `http://localhost:8000`

#### Option B: Node.js (npx serve)
```bash
npx serve .
```

#### Option C: Live Server (VS Code)
Right-click `index.html` and select "Open with Live Server"

### 4. Connect Your Spotify Account

1. Enter your Spotify Client ID in the configuration section
2. Click "Save Configuration"
3. Click "Connect to Spotify"
4. Authorize the app with your Spotify account

## Usage

### Search and Select Music
1. Use the search bar to find a song
2. Click on a search result to select it
3. View the audio features and analysis data

### Load a YouTube Video
1. Paste a YouTube URL (supports standard, short, and embed URLs)
2. Click "Load Video"
3. Adjust playback speed if needed

### Synchronized Playback
1. Select a track from Spotify
2. Load a YouTube video
3. Click "Play Both" to start synchronized playback
4. Use "Pause Both" or "Stop & Reset" to control playback
5. Adjust the timing offset if the music and video are out of sync

## Audio Features Explained

| Feature | Description |
|---------|-------------|
| **BPM (Tempo)** | Beats per minute - the speed of the track |
| **Key** | The musical key (C, D, E, etc.) and mode (Major/Minor) |
| **Energy** | Intensity and activity level (0-100%) |
| **Danceability** | How suitable the track is for dancing (0-100%) |
| **Valence** | Musical positivity/happiness (0-100%) |
| **Acousticness** | Confidence the track is acoustic (0-100%) |
| **Instrumentalness** | Likelihood the track has no vocals (0-100%) |
| **Loudness** | Overall loudness in decibels (dB) |
| **Time Signature** | Beats per measure (e.g., 4/4) |

## Limitations

- **Spotify Premium Required**: The Web Playback SDK requires a Spotify Premium account for actual playback
- **Same Device**: Playback must occur on the same device as the browser
- **Browser Support**: Works best in Chrome, Firefox, and Edge
- **YouTube Restrictions**: Some videos may not allow embedding

## Files

```
musictest1/
├── index.html         # Main HTML structure
├── styles.css         # Styling
├── app.js             # Main application logic
├── spotify-auth.js    # Spotify OAuth PKCE authentication
├── spotify-player.js  # Spotify Web Playback SDK wrapper
├── youtube-player.js  # YouTube IFrame API wrapper
├── sync-controller.js # Synchronization logic
└── README.md          # This file
```

## Future Enhancements (Phase 2)

- Custom video upload support for more control
- Beat detection and automatic sync alignment
- Multiple track queueing
- Scene markers and bookmarks
- Export sync configurations
