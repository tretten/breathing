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
// useAudioPlayback - Load and play audio with Web Audio API
// ============================================================================

export function useAudioPlayback(audioUrl: string | null): UseAudioPlaybackReturn {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const pausedAtPositionRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const isStoppingIntentionallyRef = useRef<boolean>(false);

  // Initialize AudioContext and AnalyserNode
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();

    // Create analyser for audio visualization
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Load and decode audio
  useEffect(() => {
    if (!audioUrl || !audioContextRef.current) {
      setIsLoaded(false);
      return;
    }

    const loadAudio = async () => {
      try {
        setIsLoaded(false);
        const response = await fetch(audioUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
        
        audioBufferRef.current = buffer;
        setDuration(buffer.duration);
        setRemainingTime(buffer.duration);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load audio:', error);
        setIsLoaded(false);
      }
    };

    loadAudio();
  }, [audioUrl]);

  // Update remaining time during playback
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current) {
      return;
    }

    const interval = setInterval(() => {
      if (audioContextRef.current && playbackStartTimeRef.current > 0) {
        const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
        const remaining = Math.max(0, duration - elapsed);
        setRemainingTime(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Unlock audio (must be called from user gesture)
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    if (!audioContextRef.current) {
      return false;
    }

    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setIsUnlocked(true);
      return true;
    } catch (error) {
      console.error('Failed to unlock audio:', error);
      return false;
    }
  }, []);

  // Schedule playback at specific server timestamp
  const schedulePlayback = useCallback((
    startTimestamp: number, 
    getServerTime: () => number
  ): boolean => {
    if (!audioBufferRef.current || !audioContextRef.current) {
      console.warn('Audio not ready for playback');
      return false;
    }

    if (audioContextRef.current.state === 'suspended') {
      console.warn('AudioContext is suspended, cannot schedule playback');
      return false;
    }

    const serverTime = getServerTime();
    const delayMs = startTimestamp - serverTime;

    // Don't schedule if already significantly past
    if (delayMs < -1000) {
      console.warn('Start timestamp already passed');
      return false;
    }

    // Cancel any existing playback
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    }

    // Create new source and connect through analyser for visualization
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;

    // Connect: source -> analyser -> destination
    if (analyserRef.current) {
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    } else {
      source.connect(audioContextRef.current.destination);
    }
    sourceRef.current = source;

    // Calculate delay in audio context time
    const delaySeconds = Math.max(0, delayMs / 1000);
    const startTime = audioContextRef.current.currentTime + delaySeconds;
    
    source.start(startTime);

    // Update playing state
    setTimeout(() => {
      setIsPlaying(true);
    }, Math.max(0, delayMs));

    source.onended = () => {
      setIsPlaying(false);
      sourceRef.current = null;
    };

    return true;
  }, []);

  // Pause playback
  const pausePlayback = useCallback(() => {
    if (!isPlaying || !audioContextRef.current) return;

    // Calculate current position
    const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
    pausedAtPositionRef.current = elapsed;

    // Mark as intentional stop to prevent onended from resetting state
    isStoppingIntentionallyRef.current = true;

    // Stop the source
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (e) {
        // Ignore errors
      }
      sourceRef.current = null;
    }

    setIsPlaying(false);
    setIsPaused(true);
  }, [isPlaying]);

  // Resume playback from paused position
  const resumePlayback = useCallback(async (): Promise<boolean> => {
    if (!isPaused || !audioBufferRef.current || !audioContextRef.current) {
      return false;
    }

    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;

      if (analyserRef.current) {
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      } else {
        source.connect(audioContextRef.current.destination);
      }
      sourceRef.current = source;

      // Start from paused position
      const offset = pausedAtPositionRef.current;
      playbackStartTimeRef.current = audioContextRef.current.currentTime - offset;

      source.start(0, offset);
      setIsPlaying(true);
      setIsPaused(false);
      isStoppingIntentionallyRef.current = false;

      source.onended = () => {
        // Only reset state if this was a natural end, not a pause/stop
        if (!isStoppingIntentionallyRef.current) {
          setIsPlaying(false);
          setIsPaused(false);
          setRemainingTime(0);
          sourceRef.current = null;
          playbackStartTimeRef.current = 0;
          pausedAtPositionRef.current = 0;
        }
        isStoppingIntentionallyRef.current = false;
      };

      return true;
    } catch (error) {
      console.error('Failed to resume audio:', error);
      return false;
    }
  }, [isPaused]);

  // Stop playback immediately
  const stopPlayback = useCallback(() => {
    // Mark as intentional stop to prevent onended from resetting state
    isStoppingIntentionallyRef.current = true;

    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (e) {
        // Ignore errors
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setRemainingTime(duration);
    playbackStartTimeRef.current = 0;
    pausedAtPositionRef.current = 0;
  }, [duration]);

  // Play immediately (must be called from user gesture for cross-browser support)
  const playNow = useCallback(async (): Promise<boolean> => {
    if (!audioBufferRef.current || !audioContextRef.current) {
      console.warn('Audio not ready for playback');
      return false;
    }

    // Prevent multiple simultaneous playback attempts
    if (isPlaying) {
      console.warn('Already playing');
      return false;
    }

    try {
      // Resume AudioContext if suspended (required for Safari/WebKit and Chrome autoplay policy)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setIsUnlocked(true);

      // Cancel any existing playback
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
          sourceRef.current.disconnect();
        } catch (e) {
          // Ignore errors from already stopped sources
        }
      }

      // Create new source and connect through analyser for visualization
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;

      // Connect: source -> analyser -> destination
      if (analyserRef.current) {
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      } else {
        source.connect(audioContextRef.current.destination);
      }
      sourceRef.current = source;

      // Track playback start time
      playbackStartTimeRef.current = audioContextRef.current.currentTime;
      const currentDuration = audioBufferRef.current.duration;
      setRemainingTime(currentDuration);

      source.start(0);
      setIsPlaying(true);
      isStoppingIntentionallyRef.current = false;

      source.onended = () => {
        // Only reset state if this was a natural end, not a pause/stop
        if (!isStoppingIntentionallyRef.current) {
          setIsPlaying(false);
          setIsPaused(false);
          setRemainingTime(0);
          sourceRef.current = null;
          playbackStartTimeRef.current = 0;
          pausedAtPositionRef.current = 0;
        }
        isStoppingIntentionallyRef.current = false;
      };

      return true;
    } catch (error) {
      console.error('Failed to play audio:', error);
      return false;
    }
  }, [isPlaying]);

  // Get current audio level for visualization (0-1)
  const getAudioLevel = useCallback((): number => {
    if (!analyserRef.current || !dataArrayRef.current || !isPlaying) {
      return 0;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const sum = dataArrayRef.current.reduce((acc, val) => acc + val, 0);
    const average = sum / dataArrayRef.current.length;
    return average / 255; // Normalize to 0-1
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
