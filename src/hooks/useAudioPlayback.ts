// src/hooks/useAudioPlayback.ts
// ============================================================================
// useAudioPlayback - HTML5 Audio with Web Audio API for visualization
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseAudioPlaybackReturn } from '../types';
import { PLAY_LATENCY_COMPENSATION_S } from '../utils/constants';
import { debugAudio } from '../utils/audioDebug';
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
  /** Wire lock screen play/pause controls to real playback (solo mode).
   *  Together mode keeps them ignored so one client can't desync the session. */
  lockScreenControls?: boolean;
  /** Called when the audio element genuinely fires the 'ended' event. */
  onEnded?: () => void;
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
  const { presetId = null, language: langOption = 'en', lockScreenControls = false, onEnded } = options;
  const language = langOption || 'en';

  // Keep the latest onEnded callback without re-creating the audio element
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // HTML5 Audio element for reliable iOS playback
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Scheduled playback timeout for cleanup
  const scheduledTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Retry counter for transient load failures (SW/CDN issues)
  const loadRetriesRef = useRef(0);
  const loadRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // When the last play() was attempted - used to detect a spurious 'ended'
  // fired within moments of starting (broken media on some devices)
  const lastPlayAttemptRef = useRef(0);

  // Create audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', ''); // Important for iOS
    audio.setAttribute('webkit-playsinline', ''); // Safari
    audioElementRef.current = audio;

    // Event handlers
    const handleLoadedMetadata = () => {
      debugAudio('loadedmetadata', `duration=${audio.duration}`);
      setDuration(audio.duration);
      setRemainingTime(audio.duration);
      setIsLoaded(true);
    };

    const handleCanPlayThrough = () => {
      debugAudio('canplaythrough', `duration=${audio.duration}`);
      setIsLoaded(true);
    };

    const handlePlaying = () => {
      debugAudio('playing', `t=${audio.currentTime.toFixed(1)}`);
    };

    const handleEnded = () => {
      const elapsedSincePlay = performance.now() - lastPlayAttemptRef.current;
      debugAudio('ended', `t=${audio.currentTime.toFixed(1)} dur=${audio.duration}`);
      setIsPlaying(false);
      setIsPaused(false);
      setRemainingTime(0);

      // 'ended' right after play() means the media never really played
      // (broken/empty resource on some devices) - don't report a real end,
      // retry the load instead
      if (elapsedSincePlay < 1500) {
        debugAudio('ended', `SPURIOUS (${elapsedSincePlay.toFixed(0)}ms after play)`);
        if (loadRetriesRef.current < 2 && audioUrlRef.current) {
          loadRetriesRef.current += 1;
          loadRetryTimeoutRef.current = setTimeout(() => {
            if (audioElementRef.current && audioUrlRef.current) {
              audioElementRef.current.src = audioUrlRef.current;
              audioElementRef.current.load();
            }
          }, 1500);
        }
        return;
      }

      onEndedRef.current?.();
    };

    const handleError = (e: Event) => {
      const el = e.target as HTMLAudioElement | null;
      debugAudio('error', `code=${el?.error?.code} msg=${el?.error?.message}`);
      console.error('Audio error:', e);
      setIsLoaded(false);
      // Transient failures (SW/CDN) - retry loading a couple of times
      if (loadRetriesRef.current < 2 && audioUrlRef.current) {
        loadRetriesRef.current += 1;
        loadRetryTimeoutRef.current = setTimeout(() => {
          if (audioElementRef.current && audioUrlRef.current) {
            audioElementRef.current.src = audioUrlRef.current;
            audioElementRef.current.load();
          }
        }, 1500);
      }
    };

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setRemainingTime(Math.max(0, audio.duration - audio.currentTime));
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.pause();
      audio.src = '';
      if (scheduledTimeoutRef.current) {
        clearTimeout(scheduledTimeoutRef.current);
        scheduledTimeoutRef.current = null;
      }
      if (loadRetryTimeoutRef.current) {
        clearTimeout(loadRetryTimeoutRef.current);
        loadRetryTimeoutRef.current = null;
      }
      if (unlockCtxRef.current) {
        unlockCtxRef.current.close().catch(() => {});
        unlockCtxRef.current = null;
      }
    };
  }, []);

  // Load audio when URL changes
  useEffect(() => {
    if (!audioUrl || !audioElementRef.current) {
      setIsLoaded(false);
      return;
    }

    audioUrlRef.current = audioUrl;
    loadRetriesRef.current = 0;
    setIsLoaded(false);
    audioElementRef.current.src = audioUrl;
    audioElementRef.current.load();
  }, [audioUrl]);

  // Unlock audio (must be called from user gesture)
  // AudioContext kept open (silent) to hold the iOS audio session active
  const unlockCtxRef = useRef<AudioContext | null>(null);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    if (!audioElementRef.current) return false;

    // Skip if already unlocked
    if (isUnlocked) {
      return true;
    }

    try {
      // 1) Web Audio unlock: a running AudioContext activates the page's
      //    audio session so media elements can play without a gesture.
      //    Deliberately does NOT touch the media element - play()+pause()
      //    on iOS fires a spurious 'ended' and corrupts the element
      //    (duration collapses to ~0 and playback is dead).
      let webAudioUnlocked = false;
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) {
        try {
          const ctx = new Ctor();
          unlockCtxRef.current = ctx;
          if (ctx.state === "suspended") {
            await ctx.resume();
          }
          webAudioUnlocked = ctx.state === "running";
        } catch {
          webAudioUnlocked = false;
        }
      }

      // 2) Fallback (no Web Audio / resume blocked): muted play WITHOUT
      //    pausing. The element keeps "playing" silently; it is unmuted at
      //    actual playback start. Pausing here is what breaks iOS Safari.
      if (!webAudioUnlocked) {
        debugAudio("unlock: muted play (no pause)");
        audioElementRef.current.muted = true;
        audioElementRef.current.currentTime = 0;
        lastPlayAttemptRef.current = performance.now();
        const p = audioElementRef.current.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {});
        }
      }

      setIsUnlocked(true);
      return true;
    } catch (error) {
      console.error("Failed to unlock audio:", error);
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

    if (scheduledTimeoutRef.current) {
      clearTimeout(scheduledTimeoutRef.current);
    }

    scheduledTimeoutRef.current = setTimeout(() => {
      scheduledTimeoutRef.current = null;
      if (audioElementRef.current) {
        audioElementRef.current.currentTime = 0;
        // Unmute here - the unlock fallback leaves the element muted-playing
        audioElementRef.current.muted = false;
        lastPlayAttemptRef.current = performance.now();
        debugAudio('play()', `delay=${Math.max(0, delayMs)}ms`);
        audioElementRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          debugAudio('play rejected', String(err));
          console.error(err);
        });
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
      const PLAY_LATENCY_COMPENSATION = PLAY_LATENCY_COMPENSATION_S;

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
      lastPlayAttemptRef.current = performance.now();
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
    // Keep the session alive while playing OR paused, so lock screen
    // controls survive a pause and can resume the track
    if ((!isPlaying && !isPaused) || !audioElementRef.current) {
      return;
    }

    // Set up media session metadata for lock screen
    setupMediaSession({
      title: getSessionTitle(presetId, language),
      artist: getArtistName(),
      album: 'Wim Hof Breathing',
    });

    const handlers: Parameters<typeof setupMediaSessionHandlers>[0] = lockScreenControls
      ? {
          onPlay: () => {
            resumePlayback();
          },
          onPause: () => {
            pausePlayback();
          },
        }
      : {
          // Together mode: ignore lock screen actions - pausing one client
          // would desync the shared session
          onPlay: () => {
            // Ignore - audio is already playing
          },
          onPause: () => {
            // Ignore pause button - do nothing, keep playing
          },
        };

    const cleanup = setupMediaSessionHandlers(handlers);

    return () => {
      cleanup();
      clearMediaSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, isPaused, presetId, language, lockScreenControls]);

  return {
    isLoaded,
    isPlaying,
    isPaused,
    isUnlocked,
    duration,
    remainingTime,
    unlockAudio,
    schedulePlayback,
    playAt,
    syncTo,
    getCurrentTime,
    pausePlayback,
    resumePlayback,
    stopPlayback,
  };
}
