// src/pages/WithFriendsRoomPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  useClientId,
  useServerTime,
  usePresence,
  useRoomState,
  useAudioPlayback,
  updateRoomPreset,
  startCustomRoomCountdown,
  resetCustomRoom
} from '../hooks';
import { AUDIO_URLS } from '../utils/constants';
import { BreathingCircle } from '../components/BreathingCircle';
import { PresetSelector } from '../components/PresetSelector';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import type { PresetId } from '../types';

const SINGLE_USER_WAIT_MS = 3000; // 3 seconds wait for single user

export function WithFriendsRoomPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();

  // Firebase hooks
  const clientId = useClientId();
  const { getServerTime } = useServerTime();
  const roomState = useRoomState('with_friends');

  // Local ready state (sent to Firebase)
  const [isReady, setIsReady] = useState(false);

  // Local preset selection (for immediate audio loading)
  const [localPreset, setLocalPreset] = useState<PresetId | null>(null);

  // Single user waiting timer ref
  const singleUserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if playback has been initiated to prevent duplicate calls
  const hasStartedPlayingRef = useRef(false);

  // Track previous countdown value to detect transition from >0 to 0
  const prevCountdownRef = useRef<number | null>(null);

  // Track presence with ready status
  const { onlineCount, clients } = usePresence('with_friends', clientId, { isReady });

  // Use local preset for audio loading (immediate), fall back to room state
  const selectedPreset = localPreset || roomState?.selectedPreset || null;
  const audioUrl = selectedPreset ? AUDIO_URLS[selectedPreset] : null;

  // Track if user has selected a preset
  const hasSelectedPreset = localPreset !== null;

  const {
    isLoaded,
    isPlaying,
    remainingTime,
    unlockAudio,
    playNow,
    stopPlayback,
    getAudioLevel
  } = useAudioPlayback(audioUrl);

  // Calculate ready count
  const readyCount = Object.values(clients).filter(c => c.isReady).length;
  const allReady = onlineCount > 0 && readyCount === onlineCount;

  // Room status from Firebase
  const roomStatus = roomState?.status || 'idle';
  const startTimestamp = roomState?.startTimestamp || null;

  // Calculate countdown seconds for overlay
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  useEffect(() => {
    if (roomStatus !== 'countdown' || !startTimestamp) {
      setCountdownSeconds(0);
      prevCountdownRef.current = null;
      return;
    }

    const updateCountdown = () => {
      const now = getServerTime();
      const remaining = Math.ceil((startTimestamp - now) / 1000);
      const clampedRemaining = Math.max(0, remaining);
      setCountdownSeconds(clampedRemaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [roomStatus, startTimestamp, getServerTime]);

  // Handle single user waiting (3 second delay before starting)
  useEffect(() => {
    // Clear any existing timer
    if (singleUserTimerRef.current) {
      clearTimeout(singleUserTimerRef.current);
      singleUserTimerRef.current = null;
    }

    // Only proceed if room is idle, audio loaded, and user is ready
    if (roomStatus !== 'idle' || !isLoaded || !isReady) {
      return;
    }

    // If more than one user online and all ready, start immediately
    if (onlineCount > 1 && allReady) {
      startCustomRoomCountdown(getServerTime);
      return;
    }

    // If single user and ready, wait 3 seconds silently then start
    if (onlineCount === 1 && isReady) {
      singleUserTimerRef.current = setTimeout(() => {
        startCustomRoomCountdown(getServerTime);
      }, SINGLE_USER_WAIT_MS);
    }

    return () => {
      if (singleUserTimerRef.current) {
        clearTimeout(singleUserTimerRef.current);
        singleUserTimerRef.current = null;
      }
    };
  }, [roomStatus, isLoaded, isReady, onlineCount, allReady, getServerTime]);

  // Play audio when countdown transitions from >0 to 0
  useEffect(() => {
    const prev = prevCountdownRef.current;
    prevCountdownRef.current = countdownSeconds;

    // Only play when countdown was > 0 and now is 0 (actual countdown finished)
    const countdownJustFinished = prev !== null && prev > 0 && countdownSeconds === 0;

    if (roomStatus === 'countdown' && countdownJustFinished && isLoaded && !isPlaying && !hasStartedPlayingRef.current) {
      hasStartedPlayingRef.current = true;
      playNow();
    }
  }, [roomStatus, countdownSeconds, isLoaded, isPlaying, playNow]);

  // Track playback state and reset room when audio finishes
  useEffect(() => {
    if (isPlaying) {
      hasStartedPlayingRef.current = true;
    } else if (hasStartedPlayingRef.current) {
      // Audio finished playing - reset room
      resetCustomRoom();
      setIsReady(false);
      hasStartedPlayingRef.current = false;
    }
  }, [isPlaying]);

  // Reset playback flag when room goes back to idle
  useEffect(() => {
    if (roomStatus === 'idle') {
      hasStartedPlayingRef.current = false;
    }
  }, [roomStatus]);

  // Format remaining time as MM:SS
  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handlePresetChange = useCallback(async (preset: PresetId) => {
    if (roomStatus !== 'idle') return;
    setLocalPreset(preset);
    await updateRoomPreset(preset);
  }, [roomStatus]);

  const handleToggleReady = useCallback(async () => {
    if (roomStatus !== 'idle') return;
    // Unlock audio context on user gesture when becoming ready
    if (!isReady) {
      await unlockAudio();
    }
    setIsReady(prev => !prev);
  }, [roomStatus, isReady, unlockAudio]);

  const handleStop = useCallback(async () => {
    stopPlayback();
    await resetCustomRoom();
    setIsReady(false);
  }, [stopPlayback]);

  const canChangePreset = roomStatus === 'idle' && !isReady;
  const canPressReady = hasSelectedPreset && isLoaded;

  // Text based on language
  const texts = language === 'en' ? {
    back: '← Back',
    title: 'With Friends',
    selectPreset: 'Select preset',
    ready: "I'm Ready",
    notReady: 'Not Ready',
    waiting: 'Waiting for others...',
    readyCount: 'ready',
    loading: 'Loading...',
    sessionEnd: 'Session ends in',
    stop: 'Stop',
    online: 'online'
  } : {
    back: '← Назад',
    title: 'С друзьями',
    selectPreset: 'Выберите пресет',
    ready: 'Я готов',
    notReady: 'Не готов',
    waiting: 'Ожидание остальных...',
    readyCount: 'готовы',
    loading: 'Загрузка...',
    sessionEnd: 'До конца сессии',
    stop: 'Остановить',
    online: 'онлайн'
  };

  return (
    <div className="room-page with-friends-room">
      {roomStatus === 'countdown' && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}

      <header className="room-header">
        <button className="back-button" onClick={handleBack}>
          {texts.back}
        </button>
        <div className="header-title">
          <h2>{texts.title}</h2>
          <span className="online-indicator">
            <span className="online-dot" />
            {onlineCount} {texts.online}
          </span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="room-content">
        <BreathingCircle isActive={isPlaying} getAudioLevel={getAudioLevel} />

        <div className="room-info">
          {roomStatus === 'idle' && (
            <>
              <PresetSelector
                selected={selectedPreset}
                onChange={handlePresetChange}
                disabled={!canChangePreset}
              />

              <div className="ready-status">
                <div className="ready-bar">
                  <div
                    className="ready-fill"
                    style={{ width: onlineCount > 0 ? `${(readyCount / onlineCount) * 100}%` : '0%' }}
                  />
                </div>
                <span>{readyCount} / {onlineCount} {texts.readyCount}</span>
              </div>

              <button
                className={`ready-button ${isReady ? 'ready' : ''}`}
                onClick={handleToggleReady}
                disabled={!canPressReady}
              >
                {!hasSelectedPreset ? texts.selectPreset : (!isLoaded ? texts.loading : (isReady ? texts.notReady : texts.ready))}
              </button>

              {isReady && onlineCount > 1 && !allReady && (
                <p className="waiting-message">{texts.waiting}</p>
              )}
            </>
          )}

          {roomStatus === 'countdown' && !isPlaying && (
            <div className="countdown-message">
              <button className="stop-button" onClick={handleStop}>
                {texts.stop}
              </button>
            </div>
          )}

          {isPlaying && (
            <div className="playing-message">
              <div className="session-timer">
                <span className="timer-label">{texts.sessionEnd}</span>
                <span className="timer-value">{formatRemainingTime(remainingTime)}</span>
              </div>
              <button className="stop-button" onClick={handleStop}>
                {texts.stop}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
