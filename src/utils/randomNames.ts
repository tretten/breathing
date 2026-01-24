// src/utils/randomNames.ts
// ============================================================================
// Random Name Generator for Voice Chat Participants
// ============================================================================

import { STORAGE_KEY_VOICE_NAME } from "./storageKeys";

// Adjectives in English and Russian (same order, same indices)
const ADJECTIVES = {
  en: [
    "Blue",
    "Happy",
    "Swift",
    "Calm",
    "Bright",
    "Quiet",
    "Gentle",
    "Wild",
    "Warm",
    "Cool",
    "Soft",
    "Bold",
    "Free",
    "Wise",
    "Kind",
    "Pure",
    "Deep",
    "Light",
    "Vivid",
    "Fresh",
  ],
  ru: [
    "Синий",
    "Весёлый",
    "Быстрый",
    "Спокойный",
    "Яркий",
    "Тихий",
    "Нежный",
    "Дикий",
    "Тёплый",
    "Прохладный",
    "Мягкий",
    "Смелый",
    "Вольный",
    "Мудрый",
    "Добрый",
    "Чистый",
    "Глубокий",
    "Лёгкий",
    "Живой",
    "Свежий",
  ],
};

// All nouns are masculine gender in Russian for grammatical agreement
const NOUNS = {
  en: [
    "Fox",
    "Wolf",
    "Bear",
    "Hawk",
    "Falcon",
    "Eagle",
    "Raven",
    "Tiger",
    "Lion",
    "Deer",
    "Wind",
    "Storm",
    "Thunder",
    "Fire",
    "Ice",
    "Stone",
    "Oak",
    "Snow",
    "Rain",
    "Mist",
  ],
  ru: [
    "Лис",
    "Волк",
    "Медведь",
    "Ястреб",
    "Сокол",
    "Орёл",
    "Ворон",
    "Тигр",
    "Лев",
    "Олень",
    "Ветер",
    "Шторм",
    "Гром",
    "Огонь",
    "Лёд",
    "Камень",
    "Дуб",
    "Снег",
    "Дождь",
    "Туман",
  ],
};

export interface NameIndices {
  adj: number;
  noun: number;
}

function generateRandomIndices(): NameIndices {
  return {
    adj: Math.floor(Math.random() * ADJECTIVES.en.length),
    noun: Math.floor(Math.random() * NOUNS.en.length),
  };
}

export function getOrCreateNameIndices(): NameIndices {
  const stored = localStorage.getItem(STORAGE_KEY_VOICE_NAME);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (typeof parsed.adj === "number" && typeof parsed.noun === "number") {
        return parsed;
      }
    } catch {
      // Invalid stored data, generate new
    }
  }

  const indices = generateRandomIndices();
  localStorage.setItem(STORAGE_KEY_VOICE_NAME, JSON.stringify(indices));
  return indices;
}

export function getNameFromIndices(
  indices: NameIndices,
  language: "en" | "ru",
): string {
  const adjective = ADJECTIVES[language][indices.adj] || ADJECTIVES.en[0];
  const noun = NOUNS[language][indices.noun] || NOUNS.en[0];
  return `${adjective} ${noun}`;
}

// Legacy function for backward compatibility - returns indices as JSON string
export function getOrCreateVoiceName(): string {
  const indices = getOrCreateNameIndices();
  return JSON.stringify(indices);
}

export function resetVoiceName(): string {
  const indices = generateRandomIndices();
  localStorage.setItem(STORAGE_KEY_VOICE_NAME, JSON.stringify(indices));
  return JSON.stringify(indices);
}
