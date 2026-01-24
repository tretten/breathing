// src/components/WelcomeModal.tsx
import { useState } from "react";
import { TopBar } from "./TopBar";
import { PageFooter } from "./PageFooter";
import { BreathingIcon, LangRuIcon, LangEnIcon } from "./Icons";

type Language = "ru" | "en";

interface WelcomeModalProps {
  onComplete: (language: Language) => void;
}

export function WelcomeModal({ onComplete }: WelcomeModalProps) {
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);

  const handleContinue = () => {
    if (!selectedLang) return;
    onComplete(selectedLang);
  };

  const texts = {
    title: "Breathing Room",
    subtitle: "Дышим вместе",
    selectLabel: "Select language · Выберите язык",
    continueEn: "Continue",
    continueRu: "Продолжить",
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
            <div className="card-grid--row">
              <button
                type="button"
                className={`card ${selectedLang === "en" ? "selected" : ""}`}
                onClick={() => setSelectedLang("en")}
                aria-pressed={selectedLang === "en"}
              >
                <LangEnIcon className="card__icon" size={28} />
                <span className="card__title">English</span>
              </button>
              <button
                type="button"
                className={`card ${selectedLang === "ru" ? "selected" : ""}`}
                onClick={() => setSelectedLang("ru")}
                aria-pressed={selectedLang === "ru"}
              >
                <LangRuIcon className="card__icon" size={28} />
                <span className="card__title">Русский</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={handleContinue}
            disabled={!selectedLang}
          >
            {selectedLang === "ru" ? texts.continueRu : texts.continueEn}
          </button>

          <PageFooter />
        </div>
      </main>
    </div>
  );
}
