# Wim Hof Breathing — Architecture Documentation

## Overview

A synchronized web application for group breathing exercises using the Wim Hof method. Built as a single-page application (SPA) with React, using Firebase Realtime Database for synchronization and Web Audio API for audio playback.

---

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: React Context + Custom Hooks
- **Backend**: Firebase Realtime Database (serverless)
- **Audio**: HTML5 Audio with Media Session API for iOS lock screen support
- **Voice Chat**: WebRTC with Firebase signaling
- **Styling**: CSS with CSS Variables (dark/light themes)

---

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── BreathingCircle  # Animated breathing visualization
│   ├── CountdownOverlay # 3-2-1 countdown display
│   ├── GlobalOnlineIndicator # Total users online
│   ├── Icons            # SVG icon components
│   ├── LanguageSwitcher # EN/RU language toggle
│   ├── ParticipantList  # Voice chat participants
│   ├── PhaseOverlay     # Breathe/Hold/Pause display
│   ├── PresetSelector   # Audio preset selection
│   ├── ThemeToggle      # Dark/light mode
│   ├── TopBar           # Navigation header
│   ├── VoiceChatButton  # Mic toggle button
│   └── WelcomeModal     # Initial setup screen
│
├── context/
│   └── AppContext       # Global app state (language, audio unlock)
│
├── firebase/
│   └── config           # Firebase initialization
│
├── hooks/               # Custom React hooks (modular)
│   ├── useAudioPlayback # HTML5 Audio with iOS support
│   ├── useClientId      # Persistent anonymous ID
│   ├── useCountdown     # Timer utilities
│   ├── usePhaseCues     # Breathing phase tracking
│   ├── usePresence      # Firebase presence management
│   ├── useServerTime    # Server time synchronization
│   ├── useTogetherRoom  # Together room state & actions
│   ├── useVoiceChat     # WebRTC voice chat
│   └── index            # Re-exports all hooks
│
├── pages/               # Route components
│   ├── RoomListPage     # Home screen with room selection
│   ├── SoloRoomPage     # Solo practice mode
│   ├── TogetherLobbyPage# Preset selection for Together
│   └── TogetherRoomPage # Synchronized group sessions
│
├── styles/
│   ├── global.css       # Design tokens, layouts, components
│   └── breathing-circle.css # Circle animation styles
│
├── types/
│   └── index            # TypeScript type definitions
│
├── utils/
│   ├── constants        # All magic numbers & config values
│   ├── helpers          # Utility functions
│   ├── mediaSession     # iOS lock screen integration
│   ├── phaseCues        # Phase cue parsing
│   └── randomNames      # Voice chat name generator
│
├── App.tsx              # Root component with routing
└── main.tsx             # Entry point

public/
└── audio/               # Audio files (mp3 + json cues)
    ├── ru_4rounds.mp3
    ├── ru_4rounds.json
    ├── en_4rounds.mp3
    ├── en_4rounds.json
    └── ...
```

---

## Firebase Data Structure

```json
{
  "presence": {
    "<clientId>": {
      "online": true,
      "lastSeen": 1234567890123
    }
  },
  "rooms": {
    "together": {
      "<presetId>": {
        "status": "idle | countdown | playing",
        "startTimestamp": 1234567890123,
        "online": {
          "<clientId>": {
            "joinedAt": 1234567890123,
            "isReady": false,
            "voiceName": "{\"adj\":5,\"noun\":12}",
            "isVoiceEnabled": false,
            "isMuted": false
          }
        }
      }
    }
  }
}
```

### Design Decisions

1. **No server-side scheduling** — Session timing is calculated client-side using Firebase server time offset
2. **Presence via `onDisconnect()`** — Automatic cleanup when users disconnect
3. **Heartbeat for stale detection** — Clients update `joinedAt` every minute; entries older than 5 minutes are cleaned up
4. **Atomic updates** — Room status changes use Firebase transactions where needed

---

## Key Patterns

### 1. Server Time Synchronization

All clients sync to Firebase server time to ensure coordinated session starts:

```typescript
// useServerTime hook
const offsetRef = ref(db, '.info/serverTimeOffset');
onValue(offsetRef, (snap) => {
  const offset = snap.val() || 0;
  // serverTime = Date.now() + offset
});
```

### 2. Audio Playback (iOS Compatible)

Uses HTML5 Audio instead of Web Audio API to support background playback:

```typescript
// HTML5 Audio continues playing when iOS screen locks
const audio = new Audio();
audio.playsInline = true;
audio.src = audioUrl;

// Media Session for lock screen controls
navigator.mediaSession.metadata = new MediaMetadata({...});
```

### 3. Presence Management

Robust presence with automatic cleanup:

```typescript
// Register presence
set(myRef, { joinedAt: Date.now(), voiceName: ... });

// Auto-remove on disconnect
onDisconnect(myRef).remove();

// Periodic heartbeat keeps presence fresh
setInterval(() => update(myRef, { joinedAt: Date.now() }), 60000);
```

### 4. Voice Chat (WebRTC)

Peer-to-peer audio using Firebase for signaling:

```typescript
// Signaling path: rooms/{roomId}/voiceSignaling/{fromId}_{toId}
// Contains: offer, answer, iceCandidates

// ICE servers for NAT traversal
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};
```

---

## Constants & Configuration

All magic numbers are centralized in `src/utils/constants.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `SLOT_INTERVAL_MS` | 30 min | Auto-session interval |
| `COUNTDOWN_DURATION_MS` | 3s | Pre-session countdown |
| `SINGLE_USER_WAIT_MS` | 3s | Solo user start delay |
| `MAX_SESSION_DURATION_MS` | 20 min | Stale session threshold |
| `AUTO_EXIT_DELAY_MS` | 10s | Post-session auto-redirect |
| `LATE_JOIN_WINDOW_MS` | 18s | Late join cutoff |
| `PRESENCE_MAX_AGE_MS` | 5 min | Stale presence threshold |
| `MAX_VOICE_PARTICIPANTS` | 8 | Voice chat limit |

---

## Room Types

### Solo Room (`/solo/`)
- Local-only, no Firebase sync
- User selects preset and starts immediately
- Supports pause/resume

### Together Room (`/room/:presetId`)
- Firebase-synchronized sessions
- Ready-up system: all users click "Ready" to start
- Single user: 3-second delay then auto-start
- Late join: users can join within 36 seconds of session start
- Voice chat support (up to 8 participants)

---

## Session Flow (Together Room)

```
1. User enters room → registers presence
2. User clicks "Ready" → isReady = true
3. All ready (or single user + 3s delay) → status = 'countdown', startTimestamp set
4. Countdown 3-2-1 displayed
5. startTimestamp reached → audio plays, status effectively 'playing'
6. Audio ends → show "session ended", reset room after 10s
```

---

## Error Handling

- **Stale sessions**: Auto-reset if session duration exceeds 20 minutes
- **Abandoned sessions**: Reset if room has 0 users or 1 user not playing after 5s
- **Audio errors**: Graceful fallback, error logged to console
- **Voice chat errors**: Display error message, allow retry

---

## Mobile Considerations

### iOS
- Audio unlock via muted play/pause on first user gesture
- Media Session API for lock screen metadata
- `playsInline` attribute for audio elements
- PWA manifest for home screen add

### Android
- Standard Web Audio support
- Media Session for notification controls

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# Type check and build
npm run build

# Preview production build
npm run preview
```

---

## Firebase Security Rules

```json
{
  "rules": {
    "presence": {
      "$clientId": {
        ".read": true,
        ".write": true
      }
    },
    "rooms": {
      "$roomType": {
        "$roomId": {
          ".read": true,
          "online": {
            "$clientId": {
              ".write": true
            }
          },
          "status": { ".write": true },
          "startTimestamp": { ".write": true },
          "voiceSignaling": {
            "$signalingId": {
              ".write": true
            }
          }
        }
      }
    }
  }
}
```

---

## Future Considerations

1. **Authentication** — Optional sign-in for persistent identity
2. **Session history** — Track completed sessions
3. **Custom audio upload** — User-provided breathing guides
4. **Advanced sync** — Handle clock drift during long sessions
5. **Analytics** — Usage patterns and session completion rates
