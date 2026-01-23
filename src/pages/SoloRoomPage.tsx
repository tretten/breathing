// src/pages/SoloRoomPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAudioPlayback, usePhaseCues } from '../hooks';
import { AUDIO_URLS } from '../utils/constants';
import { BreathingCircle } from '../components/BreathingCircle';
import { PhaseOverlay } from '../components/PhaseOverlay';
import { PresetSelector } from '../components/PresetSelector';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { TopBar } from '../components/TopBar';
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
    getAudioLevel,
    getCurrentTime
  } = useAudioPlayback(audioUrl, { presetId: selectedPreset, language });

  // Phase cues for displaying Breathe/Pause/Hold (keep active during pause)
  const { currentPhase, phaseRemaining } = usePhaseCues(audioUrl, getCurrentTime, isPlaying || isPaused);

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

  // When audio finishes playing naturally, navigate back to selection screen
  useEffect(() => {
    // Only navigate if audio actually played and is now stopped (not paused)
    if (!isPlaying && !isPaused && status === 'playing' && audioDidPlayRef.current) {
      // Reset state
      setStatus('idle');
      hasStartedPlayingRef.current = false;
      audioDidPlayRef.current = false;
      // Navigate back to selection screen
      navigate('/');
    }
  }, [isPlaying, isPaused, status, navigate]);

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
    // Reset playback flags when preset changes
    hasStartedPlayingRef.current = false;
    audioDidPlayRef.current = false;
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
    // Reset playback flags
    hasStartedPlayingRef.current = false;
    audioDidPlayRef.current = false;
  }, [stopPlayback]);

  const canChangePreset = status === 'idle';
  const canStart = selectedPreset !== null && isLoaded;

  // Text based on language
  const texts = language === 'en' ? {
    appTitle: 'Wim Hof',
    title: 'Solo',
    selectPreset: 'Choose',
    start: 'Start',
    loading: 'Wait...',
    sessionEnd: 'Remaining',
    stop: 'Stop',
    pause: 'Pause',
    resume: 'Play',
    paused: 'Paused'
  } : {
    appTitle: 'Вим Хоф',
    title: 'Соло',
    selectPreset: 'Выбор',
    start: 'Старт',
    loading: 'Ждите',
    sessionEnd: 'Осталось',
    stop: 'Стоп',
    pause: 'Пауза',
    resume: 'Плей',
    paused: 'Пауза'
  };

  return (
    <div className="page-container">
      {status === 'countdown' && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}

      <TopBar showBack onBack={handleBack} />

      <main className="page-content">
        <div className="content-centered">
          <header className="page-header">
            <p className="page-subtitle">{texts.appTitle}</p>
            <h1>{texts.title}</h1>
          </header>

          {status !== 'idle' && (
            <BreathingCircle isActive={isPlaying || isPaused} getAudioLevel={isPlaying ? getAudioLevel : undefined} phase={currentPhase} />
          )}

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
                <div className="timers-section">
                  <PhaseOverlay phase={currentPhase} remaining={phaseRemaining} />
                  <div className="total-timer" aria-live="polite" aria-atomic="true">
                    <span className="total-timer-label">{isPaused ? texts.paused : texts.sessionEnd}</span>
                    <span className="total-timer-value">{formatRemainingTime(remainingTime)}</span>
                  </div>
                </div>
                <div className="control-buttons">
                  {isPlaying && (
                    <button className="pause-button icon-button-circle" onClick={pausePlayback} aria-label={texts.pause} title={texts.pause}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <rect x="6" y="4" width="4" height="16" rx="1"/>
                        <rect x="14" y="4" width="4" height="16" rx="1"/>
                      </svg>
                    </button>
                  )}
                  {isPaused && (
                    <button className="resume-button icon-button-circle" onClick={resumePlayback} aria-label={texts.resume} title={texts.resume}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5.14v14l11-7-11-7z"/>
                      </svg>
                    </button>
                  )}
                  <button className="stop-button" onClick={handleStop}>
                    {texts.stop}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
