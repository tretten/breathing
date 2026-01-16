// src/pages/RoomListPage.tsx
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useRoomState, useServerTime } from '../hooks';
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
  const isSessionActive = roomState?.status === 'countdown' &&
    roomState?.startTimestamp !== null &&
    getServerTime() > roomState.startTimestamp;

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
        <div
          className="room-card"
          onClick={() => handleEnterRoom('solo')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleEnterRoom('solo')}
        >
          <div className="room-card-header">
            <h3>{texts.solo}</h3>
          </div>
          <div className="room-card-body">
            <p>{texts.soloDesc}</p>
          </div>
          <div className="room-card-footer">
            <span className="enter-hint">{texts.enter} →</span>
          </div>
        </div>

        <div
          className={`room-card ${isSessionActive ? 'room-card-active' : ''}`}
          onClick={() => handleEnterRoom('with_friends')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleEnterRoom('with_friends')}
        >
          <div className="room-card-header">
            <h3>{texts.withFriends}</h3>
            {isSessionActive && (
              <span className="session-badge">{texts.sessionActive}</span>
            )}
          </div>
          <div className="room-card-body">
            <p>{texts.withFriendsDesc}</p>
          </div>
          <div className="room-card-footer">
            <span className="enter-hint">{texts.enter} →</span>
          </div>
        </div>
      </div>

      {/* Footer space for global online indicator */}
      <footer className="page-footer" />
    </div>
  );
}
