// src/utils/phaseCues.ts
// Phase cue parsing and timing utilities

export type PhaseType = "breathe" | "pause" | "hold" | "intro" | "outro";

export interface PhaseCue {
  type: PhaseType;
  duration: number; // in seconds
  startTime: number; // cumulative start time in seconds
  endTime: number; // cumulative end time in seconds
}

const PHASE_CODES: Record<string, PhaseType> = {
  B: "breathe",
  P: "pause",
  H: "hold",
  I: "intro",
  O: "outro",
};

/**
 * Parse cue string format like "B60,P10,H60,B60,H90"
 * Returns array of phase cues with timing information
 */
export function parsePhaseCues(cueString: string): PhaseCue[] {
  const parts = cueString.trim().split(",");
  const cues: PhaseCue[] = [];
  let currentTime = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const code = trimmed[0].toUpperCase();
    const duration = parseInt(trimmed.slice(1), 10);

    const phaseType = PHASE_CODES[code];
    if (!phaseType || isNaN(duration) || duration <= 0) {
      continue; // Skip invalid entries
    }

    cues.push({
      type: phaseType,
      duration,
      startTime: currentTime,
      endTime: currentTime + duration,
    });

    currentTime += duration;
  }

  return cues;
}

/**
 * Get the current phase based on elapsed time
 */
export function getCurrentPhase(
  cues: PhaseCue[],
  elapsedSeconds: number,
): PhaseCue | null {
  for (const cue of cues) {
    if (elapsedSeconds >= cue.startTime && elapsedSeconds < cue.endTime) {
      return cue;
    }
  }
  return null;
}

/**
 * Get phase display text based on type and language
 */
export function getPhaseText(type: PhaseType, language: "en" | "ru"): string {
  const texts: Record<PhaseType, { en: string; ru: string }> = {
    breathe: { en: "Breathe", ru: "Дыши" },
    pause: { en: "Pause", ru: "Пауза" },
    hold: { en: "Hold", ru: "Задержка" },
    intro: { en: "Intro", ru: "Начало" },
    outro: { en: "Outro", ru: "Конец" },
  };
  return texts[type][language];
}

/**
 * Convert audio URL to cue file URL
 * /audio/ru_4rounds.mp3 -> /audio/ru_4rounds.txt
 */
export function getCueUrlFromAudioUrl(audioUrl: string): string {
  return audioUrl.replace(/\.(mp3|ogg|wav|m4a)$/i, ".txt");
}
