// src/components/TopBar.tsx
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { GlobalOnlineIndicator } from './GlobalOnlineIndicator';

interface TopBarProps {
  showBack?: boolean;
  onBack?: () => void;
}

export function TopBar({ showBack = false, onBack }: TopBarProps) {
  const navigate = useNavigate();
  const { language } = useAppContext();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  const backText = language === 'en' ? 'Back' : 'Назад';
  const backLabel = language === 'en' ? 'Go back to home' : 'Вернуться на главную';

  return (
    <header className="top-bar">
      <nav className="top-bar-left" aria-label={language === 'en' ? 'Navigation' : 'Навигация'}>
        {showBack && (
          <button className="back-button" onClick={handleBack} aria-label={backLabel}>
            <span className="back-arrow" aria-hidden="true">←</span>
            <span className="back-text">{backText}</span>
          </button>
        )}
        <GlobalOnlineIndicator />
      </nav>
      <div className="top-bar-right">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
