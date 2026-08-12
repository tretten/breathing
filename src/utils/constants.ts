// src/utils/constants.ts
// ============================================================================
// Application Constants
// ============================================================================

// ============================================================================
// Time Constants
// ============================================================================

/** Countdown duration before session starts */
export const COUNTDOWN_DURATION_MS = 3000; // 3 seconds

/** Maximum session duration before considered stale */
export const MAX_SESSION_DURATION_MS = 60 * 60 * 1000; // 60 minutes

/** Window for late joining a session */
export const LATE_JOIN_WINDOW_MS = 36000; // 36 seconds

/** Presence max age before considered stale */
export const PRESENCE_MAX_AGE_MS = 2 * 60 * 1000; // 2 minutes

/** Heartbeat interval for presence */
export const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

/** Post-session chat duration after audio ends */
export const POST_SESSION_CHAT_MS = 10 * 60 * 1000; // 10 minutes

/** Audio sync check interval */
export const AUDIO_SYNC_INTERVAL_MS = 1000; // 1 second

/** Audio drift threshold before sync correction */
export const AUDIO_SYNC_THRESHOLD_S = 0.5; // 0.5 seconds

/** Play latency compensation for audio sync */
export const PLAY_LATENCY_COMPENSATION_S = 0.3; // 300ms

// ============================================================================
// Voice Chat Constants
// ============================================================================

/** Maximum participants in voice chat */
export const MAX_VOICE_PARTICIPANTS = 8;

/** Voice activity detection threshold */
export const VOICE_ACTIVITY_THRESHOLD = 0.01;

/** Voice activity check interval */
export const VOICE_ACTIVITY_CHECK_INTERVAL_MS = 100;

// ============================================================================
// Content Configuration
// ============================================================================

/** Base URL for content files */
export const CONTENT_BASE_URL = '/content';

/** Get audio URL for a preset */
export function getAudioUrl(presetId: string): string {
  return `${CONTENT_BASE_URL}/${presetId}.mp3`;
}

/** Get metadata JSON URL for a preset */
export function getMetadataUrl(presetId: string): string {
  return `${CONTENT_BASE_URL}/${presetId}.json`;
}

/** Content index URL */
export const CONTENT_INDEX_URL = `${CONTENT_BASE_URL}/index.json`;

// ============================================================================
// Storage Keys (re-exported from storageKeys.ts to avoid circular imports)
// ============================================================================

export {
  STORAGE_KEY_CLIENT_ID,
  STORAGE_KEY_LANGUAGE,
  STORAGE_KEY_VOICE_NAME,
  STORAGE_KEY_THEME,
} from "./storageKeys";

// ============================================================================
// WebRTC Configuration
// ============================================================================

/** ICE servers for WebRTC connections */
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};
