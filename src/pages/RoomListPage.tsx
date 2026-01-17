// src/pages/RoomListPage.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useRoomState, useServerTime, resetCustomRoom } from '../hooks';
import { TopBar } from '../components/TopBar';
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
    <div className="page-container">
      <TopBar />

      <main className="page-content">
        <div className="content-centered">
          <header className="page-header">
            <h1>{texts.title}</h1>
            <p className="subtitle">{texts.subtitle}</p>
          </header>

          <div className="room-options">
            <button
              className="room-option"
              onClick={() => handleEnterRoom('solo')}
            >
              <span className="room-icon">🧘</span>
              <span className="room-name">{texts.solo}</span>
              <span className="room-desc">{texts.soloDesc}</span>
            </button>

            <button
              className={`room-option ${isSessionActive ? 'session-active' : ''}`}
              onClick={() => handleEnterRoom('with_friends')}
            >
              <span className="room-icon">👥</span>
              <span className="room-name">{texts.withFriends}</span>
              <span className="room-desc">{texts.withFriendsDesc}</span>
              {isSessionActive && (
                <span className="session-badge">{texts.sessionActive}</span>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
