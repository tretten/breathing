// src/pages/SoloRoomPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useAudioPlayback, usePhaseCues, useOfflinePresets } from "../hooks";
import { COUNTDOWN_DURATION_MS, getAudioUrl } from "../utils/constants";
import { formatSeconds } from "../utils/helpers";
import { getCueUrlFromAudioUrl } from "../utils/phaseCues";
import { BreathingCircle } from "../components/BreathingCircle";
import { PresetSelector } from "../components/PresetSelector";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { TopBar } from "../components/TopBar";
import { PageFooter } from "../components/PageFooter";
import { MeditationIcon } from "../components/Icons";

type RoomStatus = "idle" | "countdown" | "playing";

export function SoloRoomPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [presetTitle, setPresetTitle] = useState<string>("");
  const [hasAudioEnded, setHasAudioEnded] = useState(false);
  const hasStartedPlayingRef = useRef(false);
  const audioDidPlayRef = useRef(false);

  const audioUrl = selectedPreset ? getAudioUrl(selectedPreset) : null;

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

  // Offline status
  const { isPresetCached, cachePreset } = useOfflinePresets();
  const isCurrentPresetCached = selectedPreset ? isPresetCached(selectedPreset) : false;

  // Cache preset for offline use when playback starts
  useEffect(() => {
    if (isPlaying && selectedPreset && !isCurrentPresetCached) {
      cachePreset(selectedPreset);
    }
  }, [isPlaying, selectedPreset, isCurrentPresetCached, cachePreset]);

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

  // Track when audio actually starts playing and when it ends
  useEffect(() => {
    if (isPlaying) {
      hasStartedPlayingRef.current = true;
      audioDidPlayRef.current = true;
      setHasAudioEnded(false);
    } else if (audioDidPlayRef.current && !isPaused) {
      // Audio finished playing naturally
      setHasAudioEnded(true);
    }
  }, [isPlaying, isPaused]);

  // When audio finishes playing naturally, stay on the page (don't auto-close)
  // User can manually go back or select another preset

  const handleBack = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleSupportAuthor = useCallback(() => {
    if (authorUrl) {
      window.open(authorUrl, "_blank", "noopener,noreferrer");
    }
  }, [authorUrl]);

  const handlePresetChange = useCallback(
    (preset: string) => {
      if (status !== "idle") return;
      setSelectedPreset(preset);
      setHasAudioEnded(false);
      hasStartedPlayingRef.current = false;
      audioDidPlayRef.current = false;
    },
    [status],
  );

  // Auto-start when audio is loaded after preset selection
  useEffect(() => {
    if (status !== "idle" || !selectedPreset || !isLoaded) return;

    const startSession = async () => {
      await unlockAudio();
      setStatus("countdown");
      setCountdownSeconds(COUNTDOWN_DURATION_MS / 1000);
    };

    startSession();
  }, [status, selectedPreset, isLoaded, unlockAudio]);

  const handleStop = useCallback(() => {
    stopPlayback();
    setStatus("idle");
    setSelectedPreset(null);
    setHasAudioEnded(false);
    hasStartedPlayingRef.current = false;
    audioDidPlayRef.current = false;
  }, [stopPlayback]);

  const canChangePreset = status === "idle";

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
          done: "Done",
          supportAuthor: "Support Author",
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
          done: "Готово",
          supportAuthor: "Поддержать автора",
        };

  return (
    <div className="app-container">
      {status === "countdown" && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}

      <TopBar showBack onBack={handleBack} />

      <main className="app-content">
        <div className="content-centered">
          <header className="app-header">
            {status === "idle" && <MeditationIcon className="app-icon" />}
            <h1>{texts.title}</h1>
            <h4 className="subtitle">
              {isCurrentPresetCached && (
                <span className="offline-indicator" title={language === "ru" ? "Доступен офлайн" : "Available offline"}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
              )}
              {presetTitle || texts.subtitle}
            </h4>
          </header>

          {status !== "idle" && (
            <BreathingCircle
              isActive={isPlaying || isPaused}
              phase={currentPhase}
            >
              {/* Phase info - displayed as overlay on the circle */}
              {(isPlaying || isPaused || hasAudioEnded) && (
                <div className="circle-overlay-content">
                  <div className="overlay-phase">
                    <span className="overlay-phase-label">
                      {hasAudioEnded
                        ? texts.done
                        : currentPhase
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
                      {!hasAudioEnded && phaseRemaining > 0 ? phaseRemaining : ""}
                    </span>
                  </div>
                  {/* Support author button during outro or when finished */}
                  {(currentPhase === "outro" || hasAudioEnded) && authorUrl && (
                    <button
                      className="btn btn--accent btn--lg"
                      onClick={handleSupportAuthor}
                    >
                      {texts.supportAuthor}
                    </button>
                  )}
                </div>
              )}
            </BreathingCircle>
          )}

          <div className="room-info">
            {status === "idle" && (
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

            {(isPlaying || isPaused || hasAudioEnded) && (
              <div className="playing-controls">
                {!hasAudioEnded && (
                  <div className="remaining-time">
                    <span className="remaining-time-label">
                      {isPaused ? texts.paused : texts.sessionEnd}
                    </span>
                    <span className="remaining-time-value">
                      {formatSeconds(remainingTime)}
                    </span>
                  </div>
                )}
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
              </div>
            )}

          </div>

          {status === "idle" && <PageFooter />}
        </div>
      </main>
    </div>
  );
}
