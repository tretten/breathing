// src/components/CountdownOverlay.tsx

interface CountdownOverlayProps {
  seconds: number;
}

export function CountdownOverlay({ seconds }: CountdownOverlayProps) {
  if (seconds <= 0 || seconds > 3) return null;

  return (
    <div className="countdown-overlay" role="alert" aria-live="assertive" aria-atomic="true">
      <div className="countdown-number" aria-label={`Starting in ${Math.ceil(seconds)}`}>
        {Math.ceil(seconds)}
      </div>
    </div>
  );
}
