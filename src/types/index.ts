// src/types/index.ts
// ============================================================================
// Type Definitions
// ============================================================================

export type RoomType = 'solo' | 'together';
export type RoomStatus = 'idle' | 'countdown' | 'playing' | 'completed';
export type PresetId = string;
export type RoomId = 'solo';

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

export interface RoomConfig {
  lang?: 'ru' | 'en';
  rounds?: 3 | 4;
  type: RoomType;
  label: string;
}

export interface ClientPresence {
  joinedAt: number;
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
  isSpeaking: boolean;
  isReady: boolean;
}

export interface VoiceSignaling {
  peerId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  iceCandidates?: RTCIceCandidateInit[];
}

export interface AutoRoomState {
  online: Record<string, ClientPresence>;
}

export interface TogetherRoomState {
  online: Record<string, ClientPresence>;
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
  playAt: (positionSeconds: number, getPositionFn?: () => number) => Promise<boolean>;
  syncTo: (positionSeconds: number) => boolean;
  getCurrentTime: () => number;
  pausePlayback: () => void;
  resumePlayback: () => Promise<boolean>;
  stopPlayback: () => void;
}

export interface UseScheduledPlaybackOptions {
  roomId: RoomId;
  audioUrl: string;
  mode: 'auto' | 'ready';
}
