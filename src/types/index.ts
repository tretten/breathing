// src/types/index.ts
// ============================================================================
// Type Definitions
// ============================================================================

export type RoomType = 'solo' | 'with_friends';
export type RoomStatus = 'idle' | 'countdown' | 'playing' | 'completed';
export type PresetId = 'ru_4rounds' | 'en_4rounds' | 'ru_3rounds' | 'en_3rounds';
export type RoomId = 'solo' | 'with_friends';

export interface RoomConfig {
  lang?: 'ru' | 'en';
  rounds?: 3 | 4;
  type: RoomType;
  label: string;
}

export interface ClientPresence {
  joinedAt: number;
  isReady?: boolean;
}

export interface AutoRoomState {
  online: Record<string, ClientPresence>;
}

export interface CustomRoomState {
  online: Record<string, ClientPresence>;
  selectedPreset: PresetId;
  status: RoomStatus;
  startTimestamp: number | null;
}

export interface UseServerTimeReturn {
  getServerTime: () => number;
  offset: number;
}

export interface UsePresenceReturn {
  onlineCount: number;
  clients: Record<string, ClientPresence>;
}

export interface UseAudioPlaybackReturn {
  isLoaded: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  isUnlocked: boolean;
  duration: number;
  remainingTime: number;
  unlockAudio: () => Promise<boolean>;
  schedulePlayback: (startTimestamp: number, getServerTime: () => number) => boolean;
  playNow: () => Promise<boolean>;
  playAt: (positionSeconds: number) => Promise<boolean>;
  pausePlayback: () => void;
  resumePlayback: () => Promise<boolean>;
  stopPlayback: () => void;
  getAudioLevel: () => number;
}

export interface UseScheduledPlaybackOptions {
  roomId: RoomId;
  audioUrl: string;
  mode: 'auto' | 'ready';
}
