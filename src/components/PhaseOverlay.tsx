// src/components/PhaseOverlay.tsx
import { useAppContext } from '../context/AppContext';
import { getPhaseText, type PhaseType } from '../utils/phaseCues';

interface PhaseOverlayProps {
  phase: PhaseType | null;
  remaining: number;
}

export function PhaseOverlay({ phase, remaining }: PhaseOverlayProps) {
  const { language } = useAppContext();

  if (!language) return null;

  // Always render the container to prevent layout jumping
  // Show phase info when available, otherwise keep the space reserved
  const text = phase ? getPhaseText(phase, language) : '';
  const phaseClass = phase ? `phase-${phase}` : '';

  return (
    <div className={`phase-display ${phaseClass}`} aria-live="polite">
      <span className="phase-label">{text || '\u00A0'}</span>
      <span className="phase-time">{phase ? remaining : '\u00A0'}</span>
    </div>
  );
}
