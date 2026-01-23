// src/pages/SoloRoomPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useAudioPlayback, usePhaseCues } from "../hooks";
import { AUDIO_URLS } from "../utils/constants";
import { BreathingCircle } from "../components/BreathingCircle";
import { PhaseOverlay } from "../components/PhaseOverlay";
import { PresetSelector } from "../components/PresetSelector";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { TopBar } from "../components/TopBar";
import type { PresetId } from "../types";

type RoomStatus = "idle" | "countdown" | "playing";

const AUTO_EXIT_DELAY = 10000; // 10 seconds

export function SoloRoomPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();

  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [showSessionEnded, setShowSessionEnded] = useState(false);
  const hasStartedPlayingRef = useRef(false);
  const audioDidPlayRef = useRef(false);

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
    getCurrentTime,
  } = useAudioPlayback(audioUrl, { presetId: selectedPreset, language });

  // Phase cues for displaying Breathe/Pause/Hold (keep active during pause)
  const { currentPhase, phaseRemaining, authorUrl } = usePhaseCues(
    audioUrl,
    getCurrentTime,
    isPlaying || isPaused,
  );

  // Run countdown timer
  useEffect(() => {
    if (status !== "countdown") return;

    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setStatus("playing");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Play audio when countdown reaches 0
  useEffect(() => {
    if (
      status === "playing" &&
      !isPlaying &&
      isLoaded &&
      !hasStartedPlayingRef.current
    ) {
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

  // When audio finishes playing naturally, show session ended screen
  useEffect(() => {
    if (
      !isPlaying &&
      !isPaused &&
      status === "playing" &&
      audioDidPlayRef.current
    ) {
      setStatus("idle");
      hasStartedPlayingRef.current = false;
      audioDidPlayRef.current = false;
      setShowSessionEnded(true);
    }
  }, [isPlaying, isPaused, status]);

  // Auto-exit after 10 seconds if session ended and user hasn't interacted
  useEffect(() => {
    if (!showSessionEnded) return;

    const timer = setTimeout(() => {
      navigate("/");
    }, AUTO_EXIT_DELAY);

    return () => clearTimeout(timer);
  }, [showSessionEnded, navigate]);

  // Format remaining time as MM:SS
  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleBack = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleExit = useCallback(() => {
    setShowSessionEnded(false);
    navigate("/");
  }, [navigate]);

  const handleSupportAuthor = useCallback(() => {
    if (authorUrl) {
      window.open(authorUrl, "_blank", "noopener,noreferrer");
    }
  }, [authorUrl]);

  const handlePresetChange = useCallback(
    (preset: PresetId) => {
      if (status !== "idle" || showSessionEnded) return;
      setSelectedPreset(preset);
      hasStartedPlayingRef.current = false;
      audioDidPlayRef.current = false;
    },
    [status, showSessionEnded],
  );

  const handleStart = useCallback(async () => {
    if (status !== "idle" || !isLoaded || showSessionEnded) return;
    await unlockAudio();
    setStatus("countdown");
    setCountdownSeconds(3);
  }, [status, isLoaded, unlockAudio, showSessionEnded]);

  const handleStop = useCallback(() => {
    stopPlayback();
    setStatus("idle");
    setCountdownSeconds(0);
    hasStartedPlayingRef.current = false;
    audioDidPlayRef.current = false;
  }, [stopPlayback]);

  const canChangePreset = status === "idle" && !showSessionEnded;
  const canStart = selectedPreset !== null && isLoaded && !showSessionEnded;

  // Text based on language
  const texts =
    language === "en"
      ? {
          appTitle: "Wim Hof",
          title: "Solo",
          selectPreset: "Choose",
          start: "Start",
          loading: "Wait...",
          sessionEnd: "Remaining",
          stop: "Stop",
          pause: "Pause",
          resume: "Play",
          paused: "Paused",
          exit: "Exit",
          supportAuthor: "Support Author",
          sessionEnded: "Done",
        }
      : {
          appTitle: "Вим Хоф",
          title: "Соло",
          selectPreset: "Выбор",
          start: "Старт",
          loading: "Ждите",
          sessionEnd: "Осталось",
          stop: "Стоп",
          pause: "Пауза",
          resume: "Плей",
          paused: "Пауза",
          exit: "Выйти",
          supportAuthor: "Поддержать автора",
          sessionEnded: "Готово",
        };

  return (
    <div className="page-container">
      {status === "countdown" && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}

      <TopBar showBack onBack={handleBack} />

      <main className="page-content">
        <div className="content-centered">
          <header className="page-header">
            <p className="page-subtitle">{texts.appTitle}</p>
            <h1>{texts.title}</h1>
          </header>

          {(status !== "idle" || showSessionEnded) && (
            <BreathingCircle
              isActive={isPlaying || isPaused}
              phase={currentPhase}
            />
          )}

          <div className="room-info">
            {status === "idle" && !showSessionEnded && (
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
                  {!selectedPreset
                    ? texts.selectPreset
                    : !isLoaded
                      ? texts.loading
                      : texts.start}
                </button>
              </>
            )}

            {status === "countdown" && (
              <div className="countdown-message">
                <button className="stop-button" onClick={handleStop}>
                  {texts.stop}
                </button>
              </div>
            )}

            {(isPlaying || isPaused) && (
              <div className="playing-message">
                <div className="timers-section">
                  <PhaseOverlay
                    phase={currentPhase}
                    remaining={phaseRemaining}
                  />
                  <div
                    className="total-timer"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <span className="total-timer-label">
                      {isPaused ? texts.paused : texts.sessionEnd}
                    </span>
                    <span className="total-timer-value">
                      {formatRemainingTime(remainingTime)}
                    </span>
                  </div>
                </div>
                <div className="control-buttons">
                  {isPlaying && (
                    <button
                      className="pause-button icon-button-circle"
                      onClick={pausePlayback}
                      aria-label={texts.pause}
                      title={texts.pause}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    </button>
                  )}
                  {isPaused && (
                    <button
                      className="resume-button icon-button-circle"
                      onClick={resumePlayback}
                      aria-label={texts.resume}
                      title={texts.resume}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    </button>
                  )}
                  <button className="stop-button" onClick={handleStop}>
                    {texts.stop}
                  </button>
                </div>
              </div>
            )}

            {showSessionEnded && (
              <div
                className="session-ended-message"
                role="status"
                aria-live="polite"
              >
                <span className="session-ended-title">
                  {texts.sessionEnded}
                </span>
                <div className="session-ended-buttons">
                  {authorUrl && (
                    <button
                      className="support-author-button"
                      onClick={handleSupportAuthor}
                    >
                      {texts.supportAuthor}
                    </button>
                  )}
                  <button className="exit-button" onClick={handleExit}>
                    {texts.exit}
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
