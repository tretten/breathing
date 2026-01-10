// src/components/SessionStatus.tsx
import { useAppContext } from '../context/AppContext';

interface SessionStatusProps {
  isPlaying: boolean;
}

export function SessionStatus({ isPlaying }: SessionStatusProps) {
  const { language } = useAppContext();

  const texts = language === 'en' ? {
    playing: 'Session in progress',
    waiting: 'Waiting'
  } : {
    playing: 'Сессия идёт',
    waiting: 'Ожидание'
  };

  return (
    <div className={`session-status ${isPlaying ? 'playing' : 'waiting'}`}>
      <div className="status-indicator" />
      <span>{isPlaying ? texts.playing : texts.waiting}</span>
    </div>
  );
}
