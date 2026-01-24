// src/hooks/useAudioPlayback.ts
// ============================================================================
// useAudioPlayback - HTML5 Audio with Web Audio API for visualization
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseAudioPlaybackReturn } from '../types';
import {
  setupMediaSession,
  setupMediaSessionHandlers,
  clearMediaSession,
  getSessionTitle,
  getArtistName,
} from '../utils/mediaSession';

export interface UseAudioPlaybackOptions {
  presetId?: string | null;
  language?: 'en' | 'ru' | null;
}

/**
 * Hook for managing audio playback with HTML5 Audio
 * Note: We intentionally do NOT use Web Audio API (createMediaElementSource)
 * because it routes audio exclusively through AudioContext, which iOS suspends
 * when the screen is locked - causing audio to stop playing.
 * Instead, we use plain HTML5 Audio which continues playing in background.
 */
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
      album: 'Wim Hof Breathing',
    });

    // Set handlers that ignore user actions - prevents pausing from lock screen
    const cleanup = setupMediaSessionHandlers({
      onPlay: () => {
        // Ignore - audio is already playing
      },
      onPause: () => {
        // Ignore pause button - do nothing, keep playing
      },
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
    stopPlayback,
  };
}
