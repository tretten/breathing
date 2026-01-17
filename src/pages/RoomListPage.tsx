// src/pages/RoomListPage.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useRoomState, useServerTime, resetCustomRoom } from '../hooks';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeToggle } from '../components/ThemeToggle';
import { GlobalOnlineIndicator } from '../components/GlobalOnlineIndicator';
import type { RoomId } from '../types';

export function RoomListPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();
  const roomState = useRoomState('with_friends');
  const { getServerTime } = useServerTime();

  const handleEnterRoom = (roomId: RoomId) => {
    navigate(`/room/${roomId}`);
  };

  // Check if there's an active session in "with_friends" room
  const onlineCount = roomState?.online ? Object.keys(roomState.online).length : 0;
  const isSessionStarted = roomState?.status === 'countdown' &&
    roomState?.startTimestamp !== null &&
    getServerTime() > roomState.startTimestamp;

  // Auto-reset abandoned sessions (session started but no participants)
  useEffect(() => {
    if (isSessionStarted && onlineCount === 0) {
      resetCustomRoom();
    }
  }, [isSessionStarted, onlineCount]);

  // Only show as active if there are participants
  const isSessionActive = isSessionStarted && onlineCount > 0;

  const texts = language === 'en' ? {
    title: 'Wim Hof Breathing',
    subtitle: 'Breathe together in real time',
    solo: 'Solo',
    soloDesc: 'Practice breathing on your own',
    withFriends: 'With Friends',
    withFriendsDesc: 'Breathe together with others',
    enter: 'Enter',
    sessionActive: 'Session in progress'
  } : {
    title: 'Дыхание по Виму Хофу',
    subtitle: 'Совместное дыхание в реальном времени',
    solo: 'Сам',
    soloDesc: 'Практикуй дыхание самостоятельно',
    withFriends: 'С друзьями',
    withFriendsDesc: 'Дыши вместе с другими',
    enter: 'Войти',
    sessionActive: 'Идет сессия'
  };

  return (
    <div className="room-list-page">
      <header className="page-header">
        <div className="page-header-row">
          <GlobalOnlineIndicator />
          <div className="page-header-controls">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
        <h1>{texts.title}</h1>
        <p className="subtitle">{texts.subtitle}</p>
      </header>

      <div className="rooms-grid">
        <article
          className="room-card"
          onClick={() => handleEnterRoom('solo')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleEnterRoom('solo')}
        >
          <header>
            <h3>{texts.solo}</h3>
          </header>
          <p>{texts.soloDesc}</p>
          <footer>
            <span className="enter-hint">{texts.enter} →</span>
          </footer>
        </article>

        <article
          className={`room-card ${isSessionActive ? 'room-card-active' : ''}`}
          onClick={() => handleEnterRoom('with_friends')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleEnterRoom('with_friends')}
        >
          <header>
            <h3>{texts.withFriends}</h3>
            {isSessionActive && (
              <span className="session-badge">{texts.sessionActive}</span>
            )}
          </header>
          <p>{texts.withFriendsDesc}</p>
          <footer>
            <span className="enter-hint">{texts.enter} →</span>
          </footer>
        </article>
      </div>

      {/* Footer space for global online indicator */}
      <footer className="page-footer" />
    </div>
  );
}
