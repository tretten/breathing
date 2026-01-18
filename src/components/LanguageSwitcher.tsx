// src/components/LanguageSwitcher.tsx
import { useAppContext } from '../context/AppContext';

export function LanguageSwitcher() {
  const { language, setLanguage } = useAppContext();

  return (
    <div className="language-switcher" role="group" aria-label="Language selection">
      <button
        className={`lang-btn ${language === 'ru' ? 'active' : ''}`}
        onClick={() => setLanguage('ru')}
        aria-label="Русский"
        aria-pressed={language === 'ru'}
      >
        RU
      </button>
      <button
        className={`lang-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        aria-label="English"
        aria-pressed={language === 'en'}
      >
        EN
      </button>
    </div>
  );
}
