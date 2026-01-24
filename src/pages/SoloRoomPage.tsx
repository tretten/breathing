// src/pages/SoloRoomPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useAudioPlayback, usePhaseCues } from "../hooks";
import {
  AUDIO_URLS,
  AUTO_EXIT_DELAY_MS,
  COUNTDOWN_DURATION_MS,
} from "../utils/constants";
import { formatSeconds } from "../utils/helpers";
import { getCueUrlFromAudioUrl } from "../utils/phaseCues";
import { BreathingCircle } from "../components/BreathingCircle";
import { PresetSelector } from "../components/PresetSelector";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { TopBar } from "../components/TopBar";
import { PageFooter } from "../components/PageFooter";
import { MeditationIcon } from "../components/Icons";
import type { PresetId } from "../types";

type RoomStatus = "idle" | "countdown" | "playing";

export function SoloRoomPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();

  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [showSessionEnded, setShowSessionEnded] = useState(false);
  const [presetTitle, setPresetTitle] = useState<string>("");
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

  // Fetch preset title from JSON cue file
  useEffect(() => {
    if (!audioUrl) {
      setPresetTitle("");
      return;
    }

    const fetchTitle = async () => {
      const jsonUrl = getCueUrlFromAudioUrl(audioUrl);
      try {
        const response = await fetch(jsonUrl);
        const data = await response.json();
        setPresetTitle(
          language === "ru"
            ? data.titleRu || data.title || ""
            : data.title || "",
        );
      } catch {
        setPresetTitle("");
      }
    };

    fetchTitle();
  }, [audioUrl, language]);

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

  // Auto-exit after session ended and user hasn't interacted
  useEffect(() => {
    if (!showSessionEnded) return;

    const timer = setTimeout(() => {
      navigate("/");
    }, AUTO_EXIT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [showSessionEnded, navigate]);

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
    async (preset: PresetId) => {
      if (status !== "idle" || showSessionEnded) return;
      setSelectedPreset(preset);
      hasStartedPlayingRef.current = false;
      audioDidPlayRef.current = false;
    },
    [status, showSessionEnded],
  );

  // Auto-start when audio is loaded after preset selection
  useEffect(() => {
    if (status !== "idle" || !selectedPreset || !isLoaded || showSessionEnded)
      return;

    const startSession = async () => {
      await unlockAudio();
      setStatus("countdown");
      setCountdownSeconds(COUNTDOWN_DURATION_MS / 1000);
    };

    startSession();
  }, [status, selectedPreset, isLoaded, showSessionEnded, unlockAudio]);

  const handleStop = useCallback(() => {
    stopPlayback();
    navigate("/");
  }, [stopPlayback, navigate]);

  const canChangePreset = status === "idle" && !showSessionEnded;

  // Text based on language
  const texts =
    language === "en"
      ? {
          title: "Solo",
          subtitle: "Choose a preset",
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
          title: "Соло",
          subtitle: "Выбери пресет",
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
            {status === "idle" && !showSessionEnded && (
              <MeditationIcon className="page-icon" />
            )}
            <h1>{texts.title}</h1>
            <p className="subtitle">{presetTitle || texts.subtitle}</p>
          </header>

          {(status !== "idle" || showSessionEnded) && (
            <BreathingCircle
              isActive={isPlaying || isPaused}
              phase={currentPhase}
            >
              {/* Phase info - displayed as overlay on the circle (no total timer) */}
              {(isPlaying || isPaused) && (
                <div className="circle-overlay-content">
                  <div className="overlay-phase">
                    <span className="overlay-phase-label">
                      {currentPhase
                        ? language === "ru"
                          ? {
                              breathe: "Дыши",
                              hold: "Держи",
                              pause: "Пауза",
                              intro: "Начало",
                              outro: "Конец",
                            }[currentPhase]
                          : {
                              breathe: "Breathe",
                              hold: "Hold",
                              pause: "Pause",
                              intro: "Intro",
                              outro: "Outro",
                            }[currentPhase]
                        : ""}
                    </span>
                    <span className="overlay-phase-time">
                      {phaseRemaining > 0 ? phaseRemaining : ""}
                    </span>
                  </div>
                </div>
              )}
            </BreathingCircle>
          )}

          <div className="room-info">
            {status === "idle" && !showSessionEnded && (
              <>
                <PresetSelector
                  selected={selectedPreset}
                  onChange={handlePresetChange}
                  disabled={!canChangePreset}
                />

                {selectedPreset && !isLoaded && (
                  <p className="waiting-message">{texts.loading}</p>
                )}
              </>
            )}

            {status === "countdown" && (
              <div className="countdown-message">
                <button className="btn btn--danger" onClick={handleStop}>
                  {texts.stop}
                </button>
              </div>
            )}

            {(isPlaying || isPaused) && (
              <div className="playing-controls">
                <div className="control-buttons">
                  {isPlaying && (
                    <button
                      className="btn btn--icon btn--primary"
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
                      className="btn btn--icon btn--accent"
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
                  <button className="btn btn--danger" onClick={handleStop}>
                    {texts.stop}
                  </button>
                </div>
                <div className="remaining-time">
                  <span className="remaining-time-label">
                    {isPaused ? texts.paused : texts.sessionEnd}
                  </span>
                  <span className="remaining-time-value">
                    {formatSeconds(remainingTime)}
                  </span>
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
                      className="btn btn--accent"
                      onClick={handleSupportAuthor}
                    >
                      {texts.supportAuthor}
                    </button>
                  )}
                  <button className="btn btn--secondary" onClick={handleExit}>
                    {texts.exit}
                  </button>
                </div>
              </div>
            )}
          </div>

          {status === "idle" && !showSessionEnded && <PageFooter />}
        </div>
      </main>
    </div>
  );
}
