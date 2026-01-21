// src/components/CountdownTimer.tsx
import { formatTimeRemaining } from '../utils/helpers';

interface CountdownTimerProps {
  remainingMs: number;
  label?: string;
}

export function CountdownTimer({ remainingMs, label = 'До следующей сессии' }: CountdownTimerProps) {
  return (
    <div className="countdown-timer">
      <div className="countdown-label">{label}</div>
      <div className="countdown-time">{formatTimeRemaining(remainingMs)}</div>
    </div>
  );
}
