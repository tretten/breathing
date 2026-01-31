// src/components/CountdownOverlay.tsx

interface CountdownOverlayProps {
  seconds: number;
  language?: "en" | "ru";
}

export function CountdownOverlay({ seconds, language = "en" }: CountdownOverlayProps) {
  if (seconds <= 0 || seconds > 3) return null;

  const ariaLabel =
    language === "ru"
      ? `Начало через ${Math.ceil(seconds)}`
      : `Starting in ${Math.ceil(seconds)}`;

  return (
    <div className="cdown-ovl" role="alert" aria-live="assertive" aria-atomic="true">
      <div className="cdown-num" aria-label={ariaLabel}>
        {Math.ceil(seconds)}
      </div>
    </div>
  );
}
