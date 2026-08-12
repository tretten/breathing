// Shared app state bits that cross module boundaries.

let appPlaying = false;

export function setAppPlaying(playing: boolean): void {
  appPlaying = playing;
}

/** True while audio is playing - auto-reloads must not fire mid-session. */
export function isAppPlaying(): boolean {
  return appPlaying;
}
