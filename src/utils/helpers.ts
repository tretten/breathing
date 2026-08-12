/**
 * Format seconds as M:SS or MM:SS string
 */
export function formatSeconds(seconds: number): string {
  if (seconds <= 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Sort presets by language - English first, then everything else
 */
export function splitPresetsByLang<T extends { lang: string }>(
  presets: T[],
): T[] {
  return [
    ...presets.filter((p) => p.lang.startsWith("EN")),
    ...presets.filter((p) => !p.lang.startsWith("EN")),
  ];
}