// src/utils/phaseCues.ts
// Phase cue parsing and timing utilities

export type PhaseType = "breathe" | "pause" | "hold" | "intro" | "outro";

export interface PhaseCue {
  type: PhaseType;
  duration: number; // in seconds
  startTime: number; // cumulative start time in seconds
  endTime: number; // cumulative end time in seconds
}

// JSON file format
interface PhaseEntry {
  type: PhaseType;
  duration: number;
}

interface PhaseCuesJson {
  title?: string;
  titleRu?: string;
  url?: string;
  phases: PhaseEntry[];
}

export interface ParsedCuesData {
  cues: PhaseCue[];
  authorUrl: string | null;
  title: string | null;
  titleRu: string | null;
}

/**
 * Parse JSON cues format
 * Returns array of phase cues with timing information and author URL
 */
export function parsePhaseCues(jsonString: string): ParsedCuesData {
  const cues: PhaseCue[] = [];
  let currentTime = 0;
  let authorUrl: string | null = null;
  let title: string | null = null;
  let titleRu: string | null = null;

  try {
    const data: PhaseCuesJson = JSON.parse(jsonString);

    if (data.url) {
      authorUrl = data.url;
    }
    if (data.title) {
      title = data.title;
    }
    if (data.titleRu) {
      titleRu = data.titleRu;
    }

    for (const entry of data.phases) {
      if (!entry.type || !entry.duration || entry.duration <= 0) {
        continue; // Skip invalid entries
      }

      cues.push({
        type: entry.type,
        duration: entry.duration,
        startTime: currentTime,
        endTime: currentTime + entry.duration,
      });

      currentTime += entry.duration;
    }
  } catch (e) {
    console.error("Failed to parse phase cues JSON:", e);
  }

  return { cues, authorUrl, title, titleRu };
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
 * /content/ru_4rounds.mp3 -> /content/ru_4rounds.json
 */
export function getCueUrlFromAudioUrl(audioUrl: string): string {
  return audioUrl.replace(/\.(mp3|ogg|wav|m4a)$/i, ".json");
}
