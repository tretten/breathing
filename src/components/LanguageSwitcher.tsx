// src/components/LanguageSwitcher.tsx
import { useAppContext } from '../context/AppContext';

export function LanguageSwitcher() {
  const { language, setLanguage } = useAppContext();

  return (
    <div className="language-switcher">
      <button
        className={`lang-btn ${language === 'ru' ? 'active' : ''}`}
        onClick={() => setLanguage('ru')}
        title="Русский"
      >
        RU
      </button>
      <button
        className={`lang-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        title="English"
      >
        EN
      </button>
    </div>
  );
}
