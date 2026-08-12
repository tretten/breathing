// Minimal audio diagnostics for ?debug - shows what the audio element
// actually experiences (duration, events) so device-specific failures
// (iOS instant 'ended') can be diagnosed from the UI.
export const audioDebugLog: string[] = [];

export function debugAudio(event: string, detail?: string): void {
  audioDebugLog.push(
    `${new Date().toISOString().slice(11, 19)} ${event}${detail ? ` ${detail}` : ""}`,
  );
  if (audioDebugLog.length > 60) audioDebugLog.shift();
}
