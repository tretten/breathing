// src/hooks/index.ts
// ============================================================================
// Custom Hooks for Wim Hof Breathing App
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ref,
  onValue,
  set,
  update,
  remove,
  onDisconnect,
  get
} from 'firebase/database';
import { db } from '../firebase/config';
import type {
  UseServerTimeReturn,
  UsePresenceReturn,
  UseAudioPlaybackReturn,
  ClientPresence,
  CustomRoomState,
  RoomId,
  PresetId
} from '../types';
import {
  parsePhaseCues,
  getCurrentPhase,
  getCueUrlFromAudioUrl,
  type PhaseCue,
  type PhaseType
} from '../utils/phaseCues';
import {
  setupMediaSession,
  setupMediaSessionHandlers,
  clearMediaSession,
  getSessionTitle,
  getArtistName
} from '../utils/mediaSession';

// ============================================================================
// useClientId - Generate and persist anonymous client ID
// ============================================================================

export function useClientId(): string {
  const [clientId] = useState<string>(() => {
    const stored = localStorage.getItem('wim_hof_client_id');
    if (stored) return stored;
    
    const id = 'client_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    localStorage.setItem('wim_hof_client_id', id);
    return id;
  });

  return clientId;
}

// ============================================================================
// useServerTime - Get Firebase server time with offset correction
// ============================================================================

export function useServerTime(): UseServerTimeReturn {
  const [offset, setOffset] = useState<number>(0);

  useEffect(() => {
    const offsetRef = ref(db, '.info/serverTimeOffset');
    
    const unsubscribe = onValue(offsetRef, (snapshot) => {
      const value = snapshot.val();
      setOffset(typeof value === 'number' ? value : 0);
    });

    return unsubscribe;
  }, []);

  const getServerTime = useCallback((): number => {
    return Date.now() + offset;
  }, [offset]);

  return { getServerTime, offset };
}

// ============================================================================
// usePresence - Manage user presence in a room
// ============================================================================

interface UsePresenceOptions {
  isReady?: boolean;
}

// Max age for presence entries before considered stale (5 minutes)
const PRESENCE_MAX_AGE_MS = 5 * 60 * 1000;

export function usePresence(
  roomId: RoomId | null,
  clientId: string,
  options: UsePresenceOptions = {}
): UsePresenceReturn {
  // Start with 1 to count ourselves before Firebase confirms (prevents showing 0)
  const [onlineCount, setOnlineCount] = useState<number>(roomId ? 1 : 0);
  const [clients, setClients] = useState<Record<string, ClientPresence>>({});
  const { isReady } = options;

  // Register presence (only depends on roomId and clientId)
  useEffect(() => {
    if (!roomId || !clientId) {
      return;
    }

    const myRef = ref(db, `rooms/${roomId}/online/${clientId}`);
    const onlineRef = ref(db, `rooms/${roomId}/online`);

    // Clean up stale entries first, then register ourselves
    const cleanupAndRegister = async () => {
      try {
        // Get current entries
        const snapshot = await get(onlineRef);
        const data = snapshot.val() as Record<string, ClientPresence> | null;

        if (data) {
          const now = Date.now();
          const staleClientIds = Object.entries(data)
            .filter(([id, presence]) => {
              // Don't remove our own entry
              if (id === clientId) return false;
              // Remove if joinedAt is too old
              return now - presence.joinedAt > PRESENCE_MAX_AGE_MS;
            })
            .map(([id]) => id);

          // Remove stale entries
          for (const staleId of staleClientIds) {
            await remove(ref(db, `rooms/${roomId}/online/${staleId}`));
          }
        }
      } catch (e) {
        console.warn('Failed to cleanup stale presence entries:', e);
      }

      // Register presence with initial data
      const presenceData: ClientPresence = {
        joinedAt: Date.now(),
        isReady: false
      };

      set(myRef, presenceData);
    };

    cleanupAndRegister();

    // Setup disconnect handler
    onDisconnect(myRef).remove();

    // Listen to online users - filter out stale entries
    const unsubscribe = onValue(onlineRef, (snapshot) => {
      const data = snapshot.val() as Record<string, ClientPresence> | null;

      // Filter out stale entries from display
      const now = Date.now();
      const activeClients: Record<string, ClientPresence> = {};

      if (data) {
        for (const [id, presence] of Object.entries(data)) {
          // Always include our own entry, filter stale others
          if (id === clientId || now - presence.joinedAt <= PRESENCE_MAX_AGE_MS) {
            activeClients[id] = presence;
          }
        }
      }

      setClients(activeClients);
      // Always count at least ourselves (we're in the process of registering even if not in data yet)
      const count = Object.keys(activeClients).length;
      setOnlineCount(count > 0 ? count : 1);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      remove(myRef);
    };
  }, [roomId, clientId]);

  // Update isReady status when it changes (separate effect)
  useEffect(() => {
    if (!roomId || !clientId || typeof isReady !== 'boolean') {
      return;
    }

    const myRef = ref(db, `rooms/${roomId}/online/${clientId}`);
    update(myRef, { isReady });
  }, [roomId, clientId, isReady]);

  // Heartbeat - update joinedAt periodically to stay "alive"
  useEffect(() => {
    if (!roomId || !clientId) {
      return;
    }

    const myRef = ref(db, `rooms/${roomId}/online/${clientId}`);
    const HEARTBEAT_INTERVAL = 60 * 1000; // Every 1 minute

    const heartbeat = setInterval(() => {
      update(myRef, { joinedAt: Date.now() });
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(heartbeat);
  }, [roomId, clientId]);

  return { onlineCount, clients };
}

// ============================================================================
// useRoomState - Subscribe to custom room state
// ============================================================================

export function useRoomState(roomId: 'with_friends'): CustomRoomState | null {
  const [roomState, setRoomState] = useState<CustomRoomState | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(db, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomState({
          online: data.online || {},
          selectedPreset: data.selectedPreset || null,
          status: data.status || 'idle',
          startTimestamp: data.startTimestamp || null
        });
      }
    });

    return unsubscribe;
  }, [roomId]);

  return roomState;
}

// ============================================================================
// useCountdown - Countdown to target timestamp
// ============================================================================

export function useCountdown(
  targetTimestamp: number | null, 
  getServerTime: () => number
): number {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!targetTimestamp) {
      setRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const serverTime = getServerTime();
      const diff = targetTimestamp - serverTime;
      setRemaining(Math.max(0, diff));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 100);
    
    return () => clearInterval(interval);
  }, [targetTimestamp, getServerTime]);

  return remaining;
}

// ============================================================================
// useAudioPlayback - HTML5 Audio with Web Audio API for visualization
// ============================================================================

export interface UseAudioPlaybackOptions {
  presetId?: string | null;
  language?: 'en' | 'ru' | null;
}

export function useAudioPlayback(
  audioUrl: string | null,
  options: UseAudioPlaybackOptions = {}
): UseAudioPlaybackReturn {
  const { presetId = null, language: langOption = 'en' } = options;
  const language = langOption || 'en';

  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // HTML5 Audio element for reliable iOS playback
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Note: We intentionally do NOT use Web Audio API (createMediaElementSource)
  // because it routes audio exclusively through AudioContext, which iOS suspends
  // when the screen is locked - causing audio to stop playing.
  // Instead, we use plain HTML5 Audio which continues playing in background.

  // Create audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    (audio as any).playsInline = true; // Important for iOS
    (audio as any).webkitPlaysinline = true; // Safari
    audioElementRef.current = audio;

    // Event handlers
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setRemainingTime(audio.duration);
      setIsLoaded(true);
    };

    const handleCanPlayThrough = () => {
      setIsLoaded(true);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setRemainingTime(0);
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setIsLoaded(false);
    };

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setRemainingTime(Math.max(0, audio.duration - audio.currentTime));
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Load audio when URL changes
  useEffect(() => {
    if (!audioUrl || !audioElementRef.current) {
      setIsLoaded(false);
      return;
    }

    setIsLoaded(false);
    audioElementRef.current.src = audioUrl;
    audioElementRef.current.load();
  }, [audioUrl]);

  // Unlock audio (must be called from user gesture)
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    if (!audioElementRef.current) return false;

    // Skip if already unlocked
    if (isUnlocked) {
      return true;
    }

    try {
      // Play and immediately pause to unlock iOS audio
      audioElementRef.current.muted = true;
      await audioElementRef.current.play();
      audioElementRef.current.pause();
      audioElementRef.current.muted = false;
      // Don't reset currentTime here - let playAt handle position

      setIsUnlocked(true);
      return true;
    } catch (error) {
      console.error('Failed to unlock audio:', error);
      // Ensure muted is reset even if play() failed
      if (audioElementRef.current) {
        audioElementRef.current.muted = false;
      }
      // Still mark as unlocked - some browsers don't need the trick
      setIsUnlocked(true);
      return true;
    }
  }, [isUnlocked]);

  // Schedule playback at specific server timestamp
  const schedulePlayback = useCallback((
    startTimestamp: number,
    getServerTime: () => number
  ): boolean => {
    if (!audioElementRef.current || !isLoaded) {
      console.warn('Audio not ready for playback');
      return false;
    }

    const serverTime = getServerTime();
    const delayMs = startTimestamp - serverTime;

    if (delayMs < -1000) {
      console.warn('Start timestamp already passed');
      return false;
    }

    setTimeout(() => {
      if (audioElementRef.current) {
        audioElementRef.current.currentTime = 0;
        audioElementRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(console.error);
      }
    }, Math.max(0, delayMs));

    return true;
  }, [isLoaded]);

  // Pause playback
  const pausePlayback = useCallback(() => {
    if (!audioElementRef.current || !isPlaying) return;

    audioElementRef.current.pause();
    setIsPlaying(false);
    setIsPaused(true);
  }, [isPlaying]);

  // Resume playback from paused position
  const resumePlayback = useCallback(async (): Promise<boolean> => {
    if (!audioElementRef.current || !isPaused) return false;

    try {
      // Ensure audio is not muted
      audioElementRef.current.muted = false;

      await audioElementRef.current.play();
      setIsPlaying(true);
      setIsPaused(false);
      return true;
    } catch (error) {
      console.error('Failed to resume audio:', error);
      return false;
    }
  }, [isPaused]);

  // Stop playback immediately
  const stopPlayback = useCallback(() => {
    if (!audioElementRef.current) return;

    audioElementRef.current.pause();
    audioElementRef.current.currentTime = 0;
    setIsPlaying(false);
    setIsPaused(false);
    setRemainingTime(duration);
  }, [duration]);

  // Play immediately (must be called from user gesture)
  const playNow = useCallback(async (): Promise<boolean> => {
    if (!audioElementRef.current || !isLoaded) {
      console.warn('Audio not ready for playback');
      return false;
    }

    if (isPlaying) {
      console.warn('Already playing');
      return false;
    }

    try {
      // Ensure audio is not muted (could be left muted from failed unlock)
      audioElementRef.current.muted = false;

      // Reset to beginning and play
      audioElementRef.current.currentTime = 0;
      await audioElementRef.current.play();

      setIsPlaying(true);
      setIsPaused(false);
      setIsUnlocked(true);

      return true;
    } catch (error) {
      console.error('Failed to play audio:', error);
      return false;
    }
  }, [isLoaded, isPlaying]);

  // Play from specific position (for late join sync)
  // getPositionFn allows recalculating position right before play for better accuracy
  const playAt = useCallback(async (
    positionSeconds: number,
    getPositionFn?: () => number
  ): Promise<boolean> => {
    if (!audioElementRef.current || !isLoaded) {
      console.warn('Audio not ready for playback');
      return false;
    }

    if (isPlaying) {
      console.warn('Already playing');
      return false;
    }

    try {
      const audio = audioElementRef.current;

      // Wait for audio to be ready for seeking (if not already)
      if (audio.readyState < 3) { // HAVE_FUTURE_DATA = 3
        await new Promise<void>((resolve) => {
          const onCanPlay = () => {
            audio.removeEventListener('canplay', onCanPlay);
            resolve();
          };
          audio.addEventListener('canplay', onCanPlay);
          // Fallback timeout
          setTimeout(() => {
            audio.removeEventListener('canplay', onCanPlay);
            resolve();
          }, 500);
        });
      }

      // Add compensation for play() startup latency
      const PLAY_LATENCY_COMPENSATION = 0.3; // 300ms

      // Calculate exact position RIGHT NOW (use callback if provided)
      const targetPosition = getPositionFn
        ? getPositionFn() + PLAY_LATENCY_COMPENSATION
        : positionSeconds + PLAY_LATENCY_COMPENSATION;

      // Clamp to valid range
      const clampedPosition = Math.max(0, Math.min(targetPosition, duration - 0.1));

      // Ensure audio is not muted (could be left muted from failed unlock)
      audio.muted = false;

      // Set position and play immediately
      audio.currentTime = clampedPosition;
      await audio.play();

      setIsPlaying(true);
      setIsPaused(false);
      setIsUnlocked(true);

      return true;
    } catch (error) {
      console.error('Failed to play audio at position:', error);
      return false;
    }
  }, [isLoaded, isPlaying, duration]);

  // Force sync audio to specific position (for correcting drift)
  const syncTo = useCallback((positionSeconds: number): boolean => {
    if (!audioElementRef.current || !isPlaying) {
      return false;
    }

    const clampedPosition = Math.max(0, Math.min(positionSeconds, duration - 0.1));
    audioElementRef.current.currentTime = clampedPosition;
    return true;
  }, [isPlaying, duration]);

  // Get current audio playback position
  const getCurrentTime = useCallback((): number => {
    return audioElementRef.current?.currentTime || 0;
  }, []);

  // Set up Media Session for iOS lock screen
  // Only set play handler - this hides pause and seek buttons
  useEffect(() => {
    if (!isPlaying || !audioElementRef.current) {
      return;
    }

    // Set up media session metadata for lock screen
    setupMediaSession({
      title: getSessionTitle(presetId, language),
      artist: getArtistName(language),
      album: 'Wim Hof Breathing'
    });

    // Set handlers that ignore user actions - prevents pausing from lock screen
    const cleanup = setupMediaSessionHandlers({
      onPlay: () => {
        // Ignore - audio is already playing
      },
      onPause: () => {
        // Ignore pause button - do nothing, keep playing
      }
      // Intentionally NOT setting: onSeekBackward, onSeekForward, onSeekTo
    });

    return () => {
      cleanup();
      clearMediaSession();
    };
  }, [isPlaying, presetId, language]);

  return {
    isLoaded,
    isPlaying,
    isPaused,
    isUnlocked,
    duration,
    remainingTime,
    unlockAudio,
    schedulePlayback,
    playNow,
    playAt,
    syncTo,
    getCurrentTime,
    pausePlayback,
    resumePlayback,
    stopPlayback
  };
}

// ============================================================================
// useNextSlot - Calculate next auto-session slot
// ============================================================================

const SLOT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function useNextSlot(getServerTime: () => number): number | null {
  const [nextSlot, setNextSlot] = useState<number | null>(null);

  useEffect(() => {
    const calculateNextSlot = () => {
      const serverTime = getServerTime();
      const currentSlot = Math.floor(serverTime / SLOT_INTERVAL_MS) * SLOT_INTERVAL_MS;
      const timeInSlot = serverTime - currentSlot;

      // If within first 5 seconds, this is the current session starting
      if (timeInSlot < 5000) {
        setNextSlot(currentSlot);
      } else {
        setNextSlot(currentSlot + SLOT_INTERVAL_MS);
      }
    };

    calculateNextSlot();
    const interval = setInterval(calculateNextSlot, 1000);
    
    return () => clearInterval(interval);
  }, [getServerTime]);

  return nextSlot;
}

// ============================================================================
// With Friends Room Actions
// ============================================================================

export async function updateRoomPreset(preset: PresetId): Promise<void> {
  const roomRef = ref(db, 'rooms/with_friends');
  await update(roomRef, { selectedPreset: preset });
}

export async function startCustomRoomCountdown(
  getServerTime: () => number
): Promise<boolean> {
  const roomRef = ref(db, 'rooms/with_friends');

  try {
    await update(roomRef, {
      status: 'countdown',
      startTimestamp: getServerTime() + 3000 // 3 seconds countdown
    });
    return true;
  } catch (error) {
    console.error('Failed to start countdown:', error);
    return false;
  }
}

export async function resetCustomRoom(): Promise<void> {
  const roomRef = ref(db, 'rooms/with_friends');
  const onlineRef = ref(db, 'rooms/with_friends/online');

  // Reset room status
  await update(roomRef, {
    status: 'idle',
    startTimestamp: null
  });

  // Reset isReady for all clients
  const snapshot = await get(onlineRef);
  const clients = snapshot.val() as Record<string, ClientPresence> | null;

  if (clients) {
    const updates: Record<string, boolean> = {};
    Object.keys(clients).forEach(clientId => {
      updates[`${clientId}/isReady`] = false;
    });
    await update(onlineRef, updates);
  }
}

export async function setRoomStatus(status: string): Promise<void> {
  const roomRef = ref(db, 'rooms/with_friends');
  await update(roomRef, { status });
}

// ============================================================================
// usePhaseCues - Fetch and track phase cues for audio
// ============================================================================

export interface UsePhaseCuesReturn {
  currentPhase: PhaseType | null;
  phaseRemaining: number;
  cues: PhaseCue[];
  isLoaded: boolean;
  authorUrl: string | null;
}

export function usePhaseCues(
  audioUrl: string | null,
  getCurrentTime: () => number,
  isActive: boolean // true when playing OR paused (not stopped)
): UsePhaseCuesReturn {
  const [cues, setCues] = useState<PhaseCue[]>([]);
  const [authorUrl, setAuthorUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<PhaseType | null>(null);
  const [phaseRemaining, setPhaseRemaining] = useState<number>(0);

  // Fetch cue file when audio URL changes
  useEffect(() => {
    if (!audioUrl) {
      setCues([]);
      setAuthorUrl(null);
      setIsLoaded(false);
      setCurrentPhase(null);
      setPhaseRemaining(0);
      return;
    }

    const cueUrl = getCueUrlFromAudioUrl(audioUrl);

    fetch(cueUrl, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) {
          throw new Error('Cue file not found');
        }
        return response.text();
      })
      .then(text => {
        const parsed = parsePhaseCues(text);
        setCues(parsed.cues);
        setAuthorUrl(parsed.authorUrl);
        setIsLoaded(true);
      })
      .catch(() => {
        // No cue file - that's OK
        setCues([]);
        setAuthorUrl(null);
        setIsLoaded(true);
      });
  }, [audioUrl]);

  // Update current phase based on playback position
  useEffect(() => {
    if (!isActive || cues.length === 0) {
      if (!isActive) {
        setCurrentPhase(null);
        setPhaseRemaining(0);
      }
      return;
    }

    const updatePhase = () => {
      const elapsed = getCurrentTime();
      const phase = getCurrentPhase(cues, elapsed);
      if (phase) {
        setCurrentPhase(phase.type);
        setPhaseRemaining(Math.ceil(phase.endTime - elapsed));
      } else {
        setCurrentPhase(null);
        setPhaseRemaining(0);
      }
    };

    updatePhase();
    const interval = setInterval(updatePhase, 100);

    return () => clearInterval(interval);
  }, [isActive, cues, getCurrentTime]);

  return { currentPhase, phaseRemaining, cues, isLoaded, authorUrl };
}
