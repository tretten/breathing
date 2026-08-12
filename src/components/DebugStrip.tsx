// src/components/DebugStrip.tsx
// Renders the audio debug log when the URL has ?debug (e.g.
// https://non-stop.us/room/en-3rounds?debug). Used to diagnose
// device-specific audio failures from the UI.
import { useEffect, useState } from "react";
import { audioDebugLog } from "../utils/audioDebug";

export function DebugStrip() {
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const id = setInterval(() => setLog([...audioDebugLog]), 1000);
    return () => clearInterval(id);
  }, []);

  if (!new URLSearchParams(window.location.search).has("debug")) return null;

  return (
    <pre className="debug-strip" aria-hidden="true">
      {log.join("\n")}
    </pre>
  );
}
