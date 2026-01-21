// src/components/ReadyButton.tsx

interface ReadyButtonProps {
  isReady: boolean;
  onToggle: () => void;
  disabled: boolean;
}

export function ReadyButton({ isReady, onToggle, disabled }: ReadyButtonProps) {
  return (
    <button 
      className={`ready-button ${isReady ? 'ready' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      type="button"
    >
      {isReady ? '✓ Готов' : 'Готов'}
    </button>
  );
}
