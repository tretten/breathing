// src/utils/randomNames.ts
// ============================================================================
// Random Name Generator for Voice Chat Participants
// ============================================================================

const ADJECTIVES = [
  'Blue',
  'Happy',
  'Swift',
  'Calm',
  'Bright',
  'Quiet',
  'Gentle',
  'Wild',
  'Warm',
  'Cool',
  'Soft',
  'Bold',
  'Free',
  'Wise',
  'Kind',
  'Pure',
  'Deep',
  'Light',
  'Vivid',
  'Fresh',
];

const NOUNS = [
  'Fox',
  'Cloud',
  'Wave',
  'Star',
  'Moon',
  'Wind',
  'River',
  'Tree',
  'Bird',
  'Bear',
  'Wolf',
  'Owl',
  'Hawk',
  'Leaf',
  'Stone',
  'Flame',
  'Snow',
  'Rain',
  'Sky',
  'Sun',
];

const STORAGE_KEY = 'wim_hof_voice_name';

export function generateRandomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}

export function getOrCreateVoiceName(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return stored;
  }

  const newName = generateRandomName();
  localStorage.setItem(STORAGE_KEY, newName);
  return newName;
}

export function resetVoiceName(): string {
  const newName = generateRandomName();
  localStorage.setItem(STORAGE_KEY, newName);
  return newName;
}
