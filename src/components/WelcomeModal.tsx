// src/components/WelcomeModal.tsx
import { useState } from 'react';
import { TopBar } from './TopBar';
import { BreathingIcon, LangRuIcon, LangEnIcon } from './Icons';

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

  const texts = {
    title: 'Wim Hof Breathing',
    subtitle: 'Совместное дыхание в реальном времени',
    selectLabel: 'Выберите язык / Select language:',
    continueEn: 'Enable Sound & Continue',
    continueRu: 'Включить звук и продолжить',
    hintEn: 'Sound is required for breathing guidance',
    hintRu: 'Звук необходим для голосового сопровождения'
  };

  return (
    <div className="page-container">
      <TopBar />

      <main className="page-content">
        <div className="content-centered">
          <header className="page-header">
            <BreathingIcon className="page-icon" />
            <h1>{texts.title}</h1>
            <p className="subtitle">{texts.subtitle}</p>
          </header>

          <div className="language-selection-page">
            <p className="selection-label">{texts.selectLabel}</p>
            <div className="language-options-page">
              <button
                type="button"
                className={`language-option-page ${selectedLang === 'ru' ? 'selected' : ''}`}
                onClick={() => setSelectedLang('ru')}
                aria-pressed={selectedLang === 'ru'}
              >
                <LangRuIcon className="lang-icon" size={32} />
                <span className="lang-name">Русский</span>
              </button>
              <button
                type="button"
                className={`language-option-page ${selectedLang === 'en' ? 'selected' : ''}`}
                onClick={() => setSelectedLang('en')}
                aria-pressed={selectedLang === 'en'}
              >
                <LangEnIcon className="lang-icon" size={32} />
                <span className="lang-name">English</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            className="start-now-button"
            onClick={handleContinue}
            disabled={!selectedLang}
          >
            {selectedLang === 'en' ? texts.continueEn : texts.continueRu}
          </button>

          <p className="welcome-hint">
            {selectedLang === 'en' ? texts.hintEn : texts.hintRu}
          </p>
        </div>
      </main>
    </div>
  );
}
