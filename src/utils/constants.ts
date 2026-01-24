// src/utils/constants.ts
// ============================================================================
// Application Constants
// ============================================================================

import type { RoomId, RoomConfig, PresetId } from "../types";

// ============================================================================
// Time Constants
// ============================================================================

/** Session slot interval - sessions start every 30 minutes */
export const SLOT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/** Window for considering current slot as "starting now" */
export const SESSION_WINDOW_MS = 5000; // 5 seconds

/** Countdown duration before session starts */
export const COUNTDOWN_DURATION_MS = 3000; // 3 seconds

/** Wait time for single user before starting */
export const SINGLE_USER_WAIT_MS = 3000; // 3 seconds

/** Maximum session duration before considered stale */
export const MAX_SESSION_DURATION_MS = 20 * 60 * 1000; // 20 minutes

/** Auto-exit delay after session ends */
export const AUTO_EXIT_DELAY_MS = 10000; // 10 seconds

/** Window for late joining a session */
export const LATE_JOIN_WINDOW_MS = 36000; // 36 seconds

/** Presence max age before considered stale */
export const PRESENCE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/** Heartbeat interval for presence */
export const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute

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
// Room Configuration
// ============================================================================

/** Room configurations */
export const ROOMS_CONFIG: Record<RoomId, RoomConfig> = {
  solo: {
    type: "solo",
    label: "Сам",
  },
};

/** Labels for room list (localized) */
export const ROOM_LABELS: Record<RoomId, { ru: string; en: string }> = {
  solo: { ru: "Сам", en: "Solo" },
};

// ============================================================================
// Preset Configuration
// ============================================================================

/** Preset options for room selection */
export const PRESET_OPTIONS: Array<{ id: PresetId; label: string }> = [
  { id: "ru_4rounds", label: "Русский • 4 раунда" },
  { id: "en_4rounds", label: "English • 4 rounds" },
  { id: "ru_3rounds", label: "Русский • 3 раунда" },
  { id: "en_3rounds", label: "English • 3 rounds" },
];

/** Audio file URLs mapped by preset */
export const AUDIO_URLS: Record<PresetId, string> = {
  ru_4rounds: "/audio/ru_4rounds.mp3",
  en_4rounds: "/audio/en_4rounds.mp3",
  ru_3rounds: "/audio/ru_3rounds.mp3",
  en_3rounds: "/audio/en_3rounds.mp3",
};

// ============================================================================
// Storage Keys (re-exported from storageKeys.ts to avoid circular imports)
// ============================================================================

export {
  STORAGE_KEY_CLIENT_ID,
  STORAGE_KEY_LANGUAGE,
  STORAGE_KEY_SETUP_COMPLETE,
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
