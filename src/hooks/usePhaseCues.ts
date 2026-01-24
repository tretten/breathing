// src/hooks/usePhaseCues.ts
// ============================================================================
// usePhaseCues - Fetch and track phase cues for audio
// ============================================================================

import { useState, useEffect } from 'react';
import {
  parsePhaseCues,
  getCurrentPhase,
  getCueUrlFromAudioUrl,
  type PhaseCue,
  type PhaseType,
} from '../utils/phaseCues';

export interface UsePhaseCuesReturn {
  currentPhase: PhaseType | null;
  phaseRemaining: number;
  cues: PhaseCue[];
  isLoaded: boolean;
  authorUrl: string | null;
}

/**
 * Hook to load and track phase cues for breathing audio
 * Fetches the cue file and updates current phase based on playback position
 */
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
      .then((response) => {
        if (!response.ok) {
          throw new Error('Cue file not found');
        }
        return response.text();
      })
      .then((text) => {
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
