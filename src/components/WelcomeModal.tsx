// src/components/WelcomeModal.tsx
import { useState } from 'react';

type Language = 'ru' | 'en';

interface WelcomeModalProps {
  onComplete: (language: Language) => void;
}

export function WelcomeModal({ onComplete }: WelcomeModalProps) {
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);

  const handleContinue = () => {
    if (selectedLang) {
      onComplete(selectedLang);
    }
  };

  return (
    <div className="welcome-overlay">
      <div className="welcome-content">
        <div className="welcome-icon">🌬️</div>
        <h2>Wim Hof Breathing</h2>
        <p className="welcome-subtitle">Совместное дыхание в реальном времени</p>

        <div className="language-selection">
          <p className="selection-label">Выберите язык / Select language:</p>
          <div className="language-options">
            <button
              className={`language-option ${selectedLang === 'ru' ? 'selected' : ''}`}
              onClick={() => setSelectedLang('ru')}
            >
              <span className="lang-flag">🇷🇺</span>
              <span className="lang-name">Русский</span>
            </button>
            <button
              className={`language-option ${selectedLang === 'en' ? 'selected' : ''}`}
              onClick={() => setSelectedLang('en')}
            >
              <span className="lang-flag">🇬🇧</span>
              <span className="lang-name">English</span>
            </button>
          </div>
        </div>

        <button
          className="welcome-continue-button"
          onClick={handleContinue}
          disabled={!selectedLang}
        >
          {selectedLang === 'en' ? 'Enable Sound & Continue' : 'Включить звук и продолжить'}
        </button>

        <p className="welcome-hint">
          {selectedLang === 'en'
            ? 'Sound is required for breathing guidance'
            : 'Звук необходим для голосового сопровождения'}
        </p>
      </div>
    </div>
  );
}
