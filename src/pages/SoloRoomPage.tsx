// src/pages/SoloRoomPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  useAudioPlayback,
  usePhaseCues,
  useOfflinePresets,
  useContentIndex,
} from "../hooks";
import { isValidPreset } from "../hooks/useContentIndex";
import { COUNTDOWN_DURATION_MS, getAudioUrl } from "../utils/constants";
import { formatSeconds } from "../utils/helpers";
import { getCueUrlFromAudioUrl } from "../utils/phaseCues";
import { BreathingCircle } from "../components/BreathingCircle";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { TopBar } from "../components/TopBar";
import { PageFooter } from "../components/PageFooter";

type RoomStatus = "idle" | "countdown" | "playing";

export function SoloRoomPage() {
  const navigate = useNavigate();
  const { presetId: presetIdParam } = useParams<{ presetId: string }>();
  const { language } = useAppContext();
  const { soloPresets, isLoading: isLoadingPresets } = useContentIndex();

  // Validate preset ID
  const validPresetId = isValidPreset(presetIdParam, soloPresets)
    ? presetIdParam
    : null;

  const [status, setStatus] = useState<RoomStatus>("idle");
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [presetTitle, setPresetTitle] = useState<string>("");
  const [hasAudioEnded, setHasAudioEnded] = useState(false);
  const hasStartedPlayingRef = useRef(false);
  const audioDidPlayRef = useRef(false);

  const audioUrl = validPresetId ? getAudioUrl(validPresetId) : null;

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
  } = useAudioPlayback(audioUrl, { presetId: validPresetId, language });

  // Phase cues for displaying Breathe/Pause/Hold (keep active during pause)
  const { currentPhase, phaseRemaining, authorUrl } = usePhaseCues(
    audioUrl,
    getCurrentTime,
    isPlaying || isPaused,
  );

  // Offline status
  const { isPresetCached, cachePreset } = useOfflinePresets();
  const isCurrentPresetCached = validPresetId
    ? isPresetCached(validPresetId)
    : false;

  // Redirect to lobby if preset is invalid (after presets have loaded)
  useEffect(() => {
    if (!isLoadingPresets && soloPresets.length > 0 && !validPresetId) {
      navigate("/solo", { replace: true });
    }
  }, [isLoadingPresets, soloPresets.length, validPresetId, navigate]);

  // Cache preset for offline use when playback starts
  useEffect(() => {
    if (isPlaying && validPresetId && !isCurrentPresetCached) {
      cachePreset(validPresetId);
    }
  }, [isPlaying, validPresetId, isCurrentPresetCached, cachePreset]);

  // Fetch preset title from JSON cue file
  useEffect(() => {
    if (!audioUrl) {
      setPresetTitle("");
      return;
    }

    const controller = new AbortController();

    const fetchTitle = async () => {
      const jsonUrl = getCueUrlFromAudioUrl(audioUrl);
      try {
        const response = await fetch(jsonUrl, { signal: controller.signal });
        const data = await response.json();
        setPresetTitle(
          language === "ru"
            ? data.titleRu || data.title || ""
            : data.title || "",
        );
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          setPresetTitle("");
        }
      }
    };

    fetchTitle();

    return () => controller.abort();
  }, [audioUrl, language]);

  // Run countdown timer
  useEffect(() => {
    if (status !== "countdown") return;

    const interval = setInterval(() => {
      setCountdownSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Transition to playing when countdown reaches 0
  useEffect(() => {
    if (status === "countdown" && countdownSeconds <= 0) {
      setStatus("playing");
    }
  }, [status, countdownSeconds]);

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

  // Auto-start when audio is loaded
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    if (
      status !== "idle" ||
      !validPresetId ||
      !isLoaded ||
      hasAutoStartedRef.current
    ) {
      return;
    }

    hasAutoStartedRef.current = true;

    const startSession = async () => {
      try {
        await unlockAudio();
        setStatus("countdown");
        setCountdownSeconds(COUNTDOWN_DURATION_MS / 1000);
      } catch (error) {
        console.error("Failed to unlock audio:", error);
        hasAutoStartedRef.current = false;
      }
    };

    startSession();
  }, [status, validPresetId, isLoaded, unlockAudio]);

  const handleBack = useCallback(() => {
    navigate("/solo");
  }, [navigate]);

  const handleSupportAuthor = useCallback(() => {
    if (authorUrl) {
      window.open(authorUrl, "_blank", "noopener,noreferrer");
    }
  }, [authorUrl]);

  const handleStop = useCallback(() => {
    stopPlayback();
    navigate("/solo");
  }, [stopPlayback, navigate]);

  // Text based on language
  const texts =
    language === "en"
      ? {
          title: "Solo",
          loading: "Loading...",
          sessionEnd: "Remaining",
          stop: "Stop",
          pause: "Pause",
          resume: "Resume",
          paused: "Paused",
          done: "Done",
          supportAuthor: "Support Author",
        }
      : {
          title: "Соло",
          loading: "Загрузка...",
          sessionEnd: "Осталось",
          stop: "Стоп",
          pause: "Пауза",
          resume: "Продолжить",
          paused: "Пауза",
          done: "Готово",
          supportAuthor: "Поддержать автора",
        };

  // Show loading while checking preset validity
  if (isLoadingPresets || soloPresets.length === 0) {
    return (
      <div className="app-container">
        <TopBar showBack onBack={handleBack} />
        <main className="app-content">
          <div className="content-centered">
            <div className="loading">
              {language === "ru" ? "Загрузка..." : "Loading..."}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      {status === "countdown" && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} language={language} />
      )}

      <TopBar showBack onBack={handleBack} />

      <main className="app-content">
        <div className="content-centered">
          <header className="app-header">
            <h1>{texts.title}</h1>
            <h4 className="subtitle">
              {isCurrentPresetCached && (
                <span
                  className="offline-indicator"
                  title={
                    language === "ru" ? "Доступен офлайн" : "Available offline"
                  }
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
              )}
              {presetTitle || texts.loading}
            </h4>
          </header>

          <BreathingCircle isActive={isPlaying || isPaused} phase={currentPhase}>
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
                              pause: "Отдых",
                              intro: "Начало",
                              outro: "Завершение",
                            }[currentPhase]
                          : {
                              breathe: "Breathe",
                              hold: "Hold",
                              pause: "Rest",
                              intro: "Starting",
                              outro: "Finishing",
                            }[currentPhase]
                        : ""}
                  </span>
                  <span className="overlay-phase-time">
                    {!hasAudioEnded && phaseRemaining > 0 ? formatSeconds(phaseRemaining) : ""}
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

          <div className="room-info">
            {status === "idle" && !isLoaded && (
              <p className="waiting-message">{texts.loading}</p>
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

          {(status === "idle" || hasAudioEnded) && <PageFooter />}
        </div>
      </main>
    </div>
  );
}
