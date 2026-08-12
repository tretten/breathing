// src/components/DebugStrip.tsx
// Renders the audio debug log when the URL has ?debug (e.g.
// https://non-stop.us/room/en-3rounds?debug). Used to diagnose
// device-specific audio failures from the UI. Copy button grabs the log.
import { useEffect, useState } from "react";
import { audioDebugLog } from "../utils/audioDebug";

export function DebugStrip() {
  const [log, setLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setLog([...audioDebugLog]), 1000);
    return () => clearInterval(id);
  }, []);

  if (!new URLSearchParams(window.location.search).has("debug")) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(log.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable - keep the button state as-is
    }
  };

  return (
    <div className="debug-strip" aria-hidden="true">
      <button
        type="button"
        className="debug-copy"
        onClick={copy}
        aria-label="Copy debug log"
      >
        {copied ? "✓ copied" : "copy"}
      </button>
      <pre>{log.join("\n")}</pre>
    </div>
  );
}
