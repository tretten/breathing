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
  const backLabel = language === 'en' ? 'Back to home' : 'На главную';

  return (
    <header className="nav">
      <nav className="nav-l" aria-label={language === 'en' ? 'Navigation' : 'Навигация'}>
        {showBack && (
          <button className="back-btn" onClick={handleBack} aria-label={backLabel}>
            <span className="back-arr" aria-hidden="true">←</span>
            <span className="back-txt">{backText}</span>
          </button>
        )}
        <GlobalOnlineIndicator />
      </nav>
      <div className="nav-r">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
