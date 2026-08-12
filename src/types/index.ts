// src/types/index.ts
// ============================================================================
// Type Definitions
// ============================================================================

export type RoomStatus = 'idle' | 'countdown' | 'playing';

/** Content index structure loaded from /content/index.json */
export interface ContentIndex {
  together: string[];
  solo: string[];
}

/** Preset metadata loaded from /content/{id}.json */
export interface PresetMetadata {
  id: string;
  lang: string;
  title: string;
  titleRu?: string;
  url?: string;
}

export interface ClientPresence {
  lastSeen: number;
  isReady?: boolean;
  voiceName?: string;
  isVoiceEnabled?: boolean;
  isMuted?: boolean;
}

export interface VoiceChatParticipant {
  clientId: string;
  name: string;
  isVoiceEnabled: boolean;
  isMuted: boolean;
  isReady: boolean;
}

export interface TogetherRoomState {
  online: Record<string, ClientPresence>;
  status: RoomStatus;
  startTimestamp: number | null;
}

export interface UseServerTimeReturn {
  getServerTime: () => number;
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
  playAt: (positionSeconds: number, getPositionFn?: () => number) => Promise<boolean>;
  syncTo: (positionSeconds: number) => boolean;
  getCurrentTime: () => number;
  pausePlayback: () => void;
  resumePlayback: () => Promise<boolean>;
  stopPlayback: () => void;
}
