// src/hooks/index.ts
// ============================================================================
// Custom Hooks for Wim Hof Breathing App
// ============================================================================

// Client identification
export { useClientId, getClientId } from "./useClientId";

// Server time synchronization
export { useServerTime } from "./useServerTime";

// Presence management
export { usePresence } from "./usePresence";

// Audio playback
export { useAudioPlayback } from "./useAudioPlayback";
export type { UseAudioPlaybackOptions } from "./useAudioPlayback";

// Together room state and actions
export {
  useTogetherRoomState,
  useTotalTogetherCount,
  startTogetherCountdown,
  resetTogetherRoom,
} from "./useTogetherRoom";

// Countdown timers
export { useCountdown, useNextSlot } from "./useCountdown";

// Phase cues for breathing display
export { usePhaseCues } from "./usePhaseCues";
export type { UsePhaseCuesReturn } from "./usePhaseCues";

// Voice chat
export { useVoiceChat } from "./useVoiceChat";

// Offline presets
export { useOfflinePresets } from "./useOfflinePresets";

// Content index (list of available presets)
export { useContentIndex, isValidPreset } from "./useContentIndex";

// Preset metadata loading
export { usePresetMetadata, useBulkPresetMetadata } from "./usePresetMetadata";
