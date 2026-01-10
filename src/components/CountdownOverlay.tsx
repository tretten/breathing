// src/components/CountdownOverlay.tsx

interface CountdownOverlayProps {
  seconds: number;
}

export function CountdownOverlay({ seconds }: CountdownOverlayProps) {
  if (seconds <= 0 || seconds > 3) return null;

  return (
    <div className="countdown-overlay">
      <div className="countdown-number">{Math.ceil(seconds)}</div>
    </div>
  );
}
