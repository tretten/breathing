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

export function usePresence(
  roomId: RoomId | null,
  clientId: string,
  options: UsePresenceOptions = {}
): UsePresenceReturn {
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [clients, setClients] = useState<Record<string, ClientPresence>>({});
  const { isReady } = options;

  // Register presence (only depends on roomId and clientId)
  useEffect(() => {
    if (!roomId || !clientId) {
      return;
    }

    const myRef = ref(db, `rooms/${roomId}/online/${clientId}`);
    const onlineRef = ref(db, `rooms/${roomId}/online`);

    // Register presence with initial data
    const presenceData: ClientPresence = {
      joinedAt: Date.now(),
      isReady: false
    };

    set(myRef, presenceData);

    // Setup disconnect handler
    onDisconnect(myRef).remove();

    // Listen to online users
    const unsubscribe = onValue(onlineRef, (snapshot) => {
      const data = snapshot.val() as Record<string, ClientPresence> | null;
      const validData = data || {};
      setClients(validData);
      setOnlineCount(Object.keys(validData).length);
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
          selectedPreset: data.selectedPreset || 'ru_4rounds',
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

export function useAudioPlayback(audioUrl: string | null): UseAudioPlaybackReturn {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // HTML5 Audio element for reliable iOS playback
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Web Audio API for visualization only
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const connectedRef = useRef<boolean>(false);

  // Create audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.playsInline = true; // Important for iOS
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

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
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

  // Setup Web Audio API for visualization (connect on first play)
  const setupAnalyser = useCallback(() => {
    if (connectedRef.current || !audioElementRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const ctx = audioContextRef.current;

      // Create analyser
      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      }

      // Connect audio element to analyser (only once)
      if (!sourceNodeRef.current) {
        const source = ctx.createMediaElementSource(audioElementRef.current);
        source.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
        sourceNodeRef.current = source;
        connectedRef.current = true;
      }
    } catch (e) {
      console.warn('Could not setup audio analyser:', e);
    }
  }, []);

  // Unlock audio (must be called from user gesture)
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    if (!audioElementRef.current) return false;

    try {
      // Play and immediately pause to unlock iOS audio
      audioElementRef.current.muted = true;
      await audioElementRef.current.play();
      audioElementRef.current.pause();
      audioElementRef.current.muted = false;
      audioElementRef.current.currentTime = 0;

      // Setup analyser during user gesture
      setupAnalyser();

      // Resume AudioContext if it exists
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      setIsUnlocked(true);
      return true;
    } catch (error) {
      console.error('Failed to unlock audio:', error);
      // Still mark as unlocked - some browsers don't need the trick
      setIsUnlocked(true);
      return true;
    }
  }, [setupAnalyser]);

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
      // Resume AudioContext if suspended
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

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
      // Setup analyser if not done yet
      setupAnalyser();

      // Resume AudioContext if suspended
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

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
  }, [isLoaded, isPlaying, setupAnalyser]);

  // Get current audio level for visualization (0-1)
  const getAudioLevel = useCallback((): number => {
    if (!analyserRef.current || !dataArrayRef.current || !isPlaying) {
      return 0;
    }

    try {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const sum = dataArrayRef.current.reduce((acc, val) => acc + val, 0);
      const average = sum / dataArrayRef.current.length;
      return average / 255;
    } catch {
      return 0;
    }
  }, [isPlaying]);

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
    pausePlayback,
    resumePlayback,
    stopPlayback,
    getAudioLevel
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
