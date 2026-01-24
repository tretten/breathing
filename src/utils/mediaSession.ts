// src/utils/mediaSession.ts
// ============================================================================
// Media Session API Integration for iOS Lock Screen Support
// ============================================================================

export interface MediaSessionConfig {
  title: string;
  artist: string;
  album?: string;
  artwork?: MediaImage[];
}

// Default artwork as inline SVG data URL (breathing circle icon)
const DEFAULT_ARTWORK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1a1a1a"/>
  <circle cx="256" cy="256" r="180" fill="none" stroke="#4a9eff" stroke-width="8" opacity="0.3"/>
  <circle cx="256" cy="256" r="140" fill="none" stroke="#4a9eff" stroke-width="6" opacity="0.5"/>
  <circle cx="256" cy="256" r="100" fill="none" stroke="#4a9eff" stroke-width="4" opacity="0.7"/>
  <circle cx="256" cy="256" r="60" fill="#4a9eff" opacity="0.9"/>
</svg>
`.trim();

const DEFAULT_ARTWORK_DATA_URL = `data:image/svg+xml,${encodeURIComponent(DEFAULT_ARTWORK_SVG)}`;

const DEFAULT_ARTWORK: MediaImage[] = [
  { src: DEFAULT_ARTWORK_DATA_URL, sizes: "512x512", type: "image/svg+xml" },
];

/**
 * Check if Media Session API is supported
 */
export function isMediaSessionSupported(): boolean {
  return "mediaSession" in navigator;
}

/**
 * Set up Media Session metadata for lock screen display
 */
export function setupMediaSession(config: MediaSessionConfig): void {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: config.title,
      artist: config.artist,
      album: config.album || "Wim Hof Breathing",
      artwork: config.artwork || DEFAULT_ARTWORK,
    });
  } catch (e) {
    console.warn("Failed to set media session metadata:", e);
  }
}

/**
 * Set up Media Session action handlers
 */
export function setupMediaSessionHandlers(handlers: {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSeekBackward?: (details: MediaSessionActionDetails) => void;
  onSeekForward?: (details: MediaSessionActionDetails) => void;
  onSeekTo?: (details: MediaSessionActionDetails) => void;
}): () => void {
  if (!isMediaSessionSupported()) return () => {};

  const actionHandlers: Array<
    [MediaSessionAction, MediaSessionActionHandler | null]
  > = [
    ["play", handlers.onPlay || null],
    ["pause", handlers.onPause || null],
    ["stop", handlers.onStop || null],
    ["seekbackward", handlers.onSeekBackward || null],
    ["seekforward", handlers.onSeekForward || null],
    ["seekto", handlers.onSeekTo || null],
  ];

  // Set up handlers
  for (const [action, handler] of actionHandlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {
      console.warn(`Failed to set media session handler for ${action}:`, e);
    }
  }

  // Return cleanup function
  return () => {
    for (const [action] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

/**
 * Update Media Session playback state
 */
export function updateMediaSessionPlaybackState(
  state: MediaSessionPlaybackState,
): void {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.playbackState = state;
  } catch (e) {
    console.warn("Failed to update media session playback state:", e);
  }
}

/**
 * Update Media Session position state (for seek bar on lock screen)
 */
export function updateMediaSessionPositionState(
  duration: number,
  position: number,
  playbackRate: number = 1,
): void {
  if (!isMediaSessionSupported()) return;
  if (!navigator.mediaSession.setPositionState) return;

  try {
    // Only set position state if we have valid values
    if (duration > 0 && position >= 0 && position <= duration) {
      navigator.mediaSession.setPositionState({
        duration,
        position,
        playbackRate,
      });
    }
  } catch (e) {
    console.warn("Failed to update media session position state:", e);
  }
}

/**
 * Clear Media Session (call when playback ends)
 */
export function clearMediaSession(): void {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
    if (navigator.mediaSession.setPositionState) {
      navigator.mediaSession.setPositionState();
    }
  } catch (e) {
    console.warn("Failed to clear media session:", e);
  }
}

/**
 * Get localized session title based on preset
 */
export function getSessionTitle(
  presetId: string | null,
  language: "en" | "ru",
): string {
  if (!presetId) {
    return language === "ru" ? "Дыхание по Виму Хофу" : "Wim Hof Breathing";
  }

  const roundMatch = presetId.match(/(\d+)rounds/);
  const rounds = roundMatch ? roundMatch[1] : "4";

  if (language === "ru") {
    return `Дыхание • ${rounds} раунда`;
  }
  return `Breathing • ${rounds} rounds`;
}

/**
 * Get localized artist name
 */
export function getArtistName(language: "en" | "ru"): string {
  return language === "ru" ? "Breathing Room" : "Breathing Room";
}
