// src/components/AudioUnlockModal.tsx

interface AudioUnlockModalProps {
  onUnlock: () => void;
}

export function AudioUnlockModal({ onUnlock }: AudioUnlockModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-icon">🔊</div>
        <h3>Включить звук</h3>
        <p>Нажмите кнопку, чтобы активировать аудио</p>
        <button className="unlock-button" onClick={onUnlock}>
          Включить звук
        </button>
      </div>
    </div>
  );
}
