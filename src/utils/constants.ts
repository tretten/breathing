// src/utils/constants.ts
// ============================================================================
// Application Constants
// ============================================================================

import type { RoomId, RoomConfig, PresetId } from '../types';

// Room configurations
export const ROOMS_CONFIG: Record<RoomId, RoomConfig> = {
  solo: {
    type: 'solo',
    label: 'Сам'
  },
  with_friends: {
    type: 'with_friends',
    label: 'С друзьями'
  }
};

// Labels for room list (localized)
export const ROOM_LABELS: Record<RoomId, { ru: string; en: string }> = {
  solo: { ru: 'Сам', en: 'Solo' },
  with_friends: { ru: 'С друзьями', en: 'With Friends' }
};

// Preset options for custom room
export const PRESET_OPTIONS: Array<{ id: PresetId; label: string }> = [
  { id: 'ru_4rounds', label: 'Русский • 4 раунда' },
  { id: 'en_4rounds', label: 'English • 4 rounds' },
  { id: 'ru_3rounds', label: 'Русский • 3 раунда' },
  { id: 'en_3rounds', label: 'English • 3 rounds' }
];

// Audio file URLs (update these to your actual audio file locations)
export const AUDIO_URLS: Record<PresetId, string> = {
  ru_4rounds: '/audio/ru_4rounds.mp3',
  en_4rounds: '/audio/en_4rounds.mp3',
  ru_3rounds: '/audio/ru_3rounds.mp3',
  en_3rounds: '/audio/en_3rounds.mp3'
};

// Time constants
export const SLOT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
export const COUNTDOWN_DURATION_MS = 3000; // 3 seconds
export const SESSION_WINDOW_MS = 5000; // 5 seconds window for "current session"
