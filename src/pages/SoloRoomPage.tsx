// src/pages/SoloRoomPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAudioPlayback } from '../hooks';
import { AUDIO_URLS } from '../utils/constants';
import { BreathingCircle } from '../components/BreathingCircle';
import { PresetSelector } from '../components/PresetSelector';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import type { PresetId } from '../types';

type RoomStatus = 'idle' | 'countdown' | 'playing';

export function SoloRoomPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();

  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
  const [status, setStatus] = useState<RoomStatus>('idle');
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const hasStartedPlayingRef = useRef(false);
  const audioDidPlayRef = useRef(false); // tracks if audio actually started playing

  const audioUrl = selectedPreset ? AUDIO_URLS[selectedPreset] : null;

  const {
    isLoaded,
    isPlaying,
    isPaused,
    remainingTime,
    unlockAudio,
    playNow,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    getAudioLevel
  } = useAudioPlayback(audioUrl);

  // Run countdown timer
  useEffect(() => {
    if (status !== 'countdown') return;

    const interval = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setStatus('playing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Play audio when countdown reaches 0
  useEffect(() => {
    if (status === 'playing' && !isPlaying && isLoaded && !hasStartedPlayingRef.current) {
      hasStartedPlayingRef.current = true;
      playNow();
    }
  }, [status, isPlaying, isLoaded, playNow]);

  // Track when audio actually starts playing
  useEffect(() => {
    if (isPlaying) {
      hasStartedPlayingRef.current = true;
      audioDidPlayRef.current = true;
    }
  }, [isPlaying]);

  // Reset when audio stops (only after it has actually played, not when paused)
  useEffect(() => {
    // Only reset if audio actually played and is now stopped (not paused)
    if (!isPlaying && !isPaused && status === 'playing' && audioDidPlayRef.current) {
      setStatus('idle');
      hasStartedPlayingRef.current = false;
      audioDidPlayRef.current = false;
    }
  }, [isPlaying, isPaused, status]);

  // Format remaining time as MM:SS
  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handlePresetChange = useCallback((preset: PresetId) => {
    if (status !== 'idle') return;
    setSelectedPreset(preset);
  }, [status]);

  const handleStart = useCallback(async () => {
    if (status !== 'idle' || !isLoaded) return;
    // Unlock audio context on user gesture
    await unlockAudio();
    setStatus('countdown');
    setCountdownSeconds(3);
  }, [status, isLoaded, unlockAudio]);

  const handleStop = useCallback(() => {
    stopPlayback();
    setStatus('idle');
    setCountdownSeconds(0);
  }, [stopPlayback]);

  const canChangePreset = status === 'idle';
  const canStart = selectedPreset !== null && isLoaded;

  // Text based on language
  const texts = language === 'en' ? {
    back: '← Back',
    title: 'Solo',
    selectPreset: 'Select preset',
    start: 'Start',
    loading: 'Loading...',
    sessionEnd: 'Session ends in',
    stop: 'Stop',
    pause: 'Pause',
    resume: 'Resume',
    paused: 'Paused'
  } : {
    back: '← Назад',
    title: 'Сам',
    selectPreset: 'Выберите пресет',
    start: 'Начать',
    loading: 'Загрузка...',
    sessionEnd: 'До конца сессии',
    stop: 'Остановить',
    pause: 'Пауза',
    resume: 'Продолжить',
    paused: 'Пауза'
  };

  return (
    <div className="room-page solo-room">
      {status === 'countdown' && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}

      <header className="room-header">
        <button className="back-button" onClick={handleBack}>
          {texts.back}
        </button>
        <h2>{texts.title}</h2>
        <LanguageSwitcher />
      </header>

      <main className="room-content">
        <BreathingCircle isActive={isPlaying || isPaused} getAudioLevel={isPlaying ? getAudioLevel : undefined} />

        <div className="room-info">

          {status === 'idle' && (
            <>
              <PresetSelector
                selected={selectedPreset}
                onChange={handlePresetChange}
                disabled={!canChangePreset}
              />

              <button
                className="start-now-button"
                onClick={handleStart}
                disabled={!canStart}
              >
                {!selectedPreset ? texts.selectPreset : (!isLoaded ? texts.loading : texts.start)}
              </button>
            </>
          )}

          {status === 'countdown' && (
            <div className="countdown-message">
              <button className="stop-button" onClick={handleStop}>
                {texts.stop}
              </button>
            </div>
          )}

          {(isPlaying || isPaused) && (
            <div className="playing-message">
              <div className="session-timer">
                <span className="timer-label">{isPaused ? texts.paused : texts.sessionEnd}</span>
                <span className="timer-value">{formatRemainingTime(remainingTime)}</span>
              </div>
              <div className="control-buttons">
                {isPlaying && (
                  <button className="pause-button icon-button" onClick={pausePlayback} title={texts.pause}>
                    <span className="icon-pause">| |</span>
                  </button>
                )}
                {isPaused && (
                  <button className="resume-button icon-button" onClick={resumePlayback} title={texts.resume}>
                    <span className="icon-play">▶</span>
                  </button>
                )}
                <button className="stop-button" onClick={handleStop}>
                  {texts.stop}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
