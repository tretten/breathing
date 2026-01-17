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

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        {showBack && (
          <button className="back-button" onClick={handleBack}>
            <span className="back-arrow">←</span>
            <span className="back-text">{backText}</span>
          </button>
        )}
        <GlobalOnlineIndicator />
      </div>
      <div className="top-bar-right">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
