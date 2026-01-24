// src/pages/TogetherRoomPage.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  useClientId,
  useServerTime,
  usePresence,
  useTogetherRoomState,
  useAudioPlayback,
  usePhaseCues,
  useVoiceChat,
  startTogetherCountdown,
  resetTogetherRoom,
} from "../hooks";
import {
  AUDIO_URLS,
  SINGLE_USER_WAIT_MS,
  MAX_SESSION_DURATION_MS,
  AUTO_EXIT_DELAY_MS,
  LATE_JOIN_WINDOW_MS,
  AUDIO_SYNC_INTERVAL_MS,
  AUDIO_SYNC_THRESHOLD_S,
} from "../utils/constants";
import { BreathingCircle } from "../components/BreathingCircle";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { TopBar } from "../components/TopBar";
import { VoiceChatButton } from "../components/VoiceChatButton";
import { ParticipantList } from "../components/ParticipantList";
import { getCueUrlFromAudioUrl } from "../utils/phaseCues";
import { PRESET_IDS, type PresetId } from "../types";

export function TogetherRoomPage() {
  const navigate = useNavigate();
  const { presetId: presetIdParam } = useParams<{ presetId: string }>();
  const { language } = useAppContext();

  // Validate presetId - check if it's a valid preset
  const validPresetId = PRESET_IDS.includes(presetIdParam as PresetId)
    ? (presetIdParam as PresetId)
    : null;
  const audioUrl = validPresetId ? AUDIO_URLS[validPresetId] : null;

  // Firebase hooks
  const clientId = useClientId();
  const { getServerTime } = useServerTime();
  const roomState = useTogetherRoomState(validPresetId);

  // Room path for Firebase
  const roomPath = validPresetId ? `together/${validPresetId}` : null;

  // Local ready state (sent to Firebase)
  const [isReady, setIsReady] = useState(false);
  const [presetTitle, setPresetTitle] = useState<string>("");

  // Single user waiting timer ref
  const singleUserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if playback has been initiated to prevent duplicate calls
  const hasStartedPlayingRef = useRef(false);

  // Track previous countdown value to detect transition from >0 to 0
  const prevCountdownRef = useRef<number | null>(null);

  // Track presence with ready status
  const { onlineCount, clients } = usePresence(roomPath, clientId, {
    isReady,
  });

  // Voice chat
  const {
    isVoiceEnabled,
    isMuted,
    isSpeaking,
    participants,
    isRoomFull,
    error: voiceError,
    enableVoice,
    disableVoice,
    toggleMute,
    muteAll,
    unmuteAll,
  } = useVoiceChat({
    roomId: roomPath || "",
    clientId,
    clients,
  });

  const {
    isLoaded,
    isPlaying,
    duration,
    remainingTime,
    unlockAudio,
    playNow,
    playAt,
    syncTo,
    getCurrentTime,
    stopPlayback,
  } = useAudioPlayback(audioUrl, { presetId: validPresetId, language });

  // Phase cues for displaying Breathe/Pause/Hold
  // Phase cues for displaying Breathe/Pause/Hold (keep active during pause)
  const { currentPhase, phaseRemaining, authorUrl } = usePhaseCues(
    audioUrl,
    getCurrentTime,
    isPlaying,
  );

  // Fetch preset title from JSON cue file
  useEffect(() => {
    if (!audioUrl) return;

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

  // Calculate ready count
  const readyCount = Object.values(clients).filter((c) => c.isReady).length;
  const allReady = onlineCount > 0 && readyCount === onlineCount;

  // Room status from Firebase
  const roomStatus = roomState?.status || "idle";
  const startTimestamp = roomState?.startTimestamp || null;

  // Calculate countdown seconds for overlay
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // Track if user manually exited (vs audio ending naturally)
  const exitedManuallyRef = useRef(false);

  // Show "session ended" message state
  const [showSessionEnded, setShowSessionEnded] = useState(false);

  // Redirect if invalid preset
  useEffect(() => {
    if (!validPresetId) {
      navigate("/room");
    }
  }, [validPresetId, navigate]);

  useEffect(() => {
    if (roomStatus !== "countdown" || !startTimestamp) {
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

    // Don't start new session if we just finished one (prevents loop)
    // Only proceed if room is idle, audio loaded, and user is ready
    if (
      roomStatus !== "idle" ||
      !isLoaded ||
      !isReady ||
      showSessionEnded ||
      !validPresetId
    ) {
      return;
    }

    // If more than one user online and all ready, start immediately
    if (onlineCount > 1 && allReady) {
      startTogetherCountdown(validPresetId, getServerTime);
      return;
    }

    // If single user and ready, wait 3 seconds silently then start
    if (onlineCount === 1 && isReady) {
      singleUserTimerRef.current = setTimeout(() => {
        startTogetherCountdown(validPresetId, getServerTime);
      }, SINGLE_USER_WAIT_MS);
    }

    return () => {
      if (singleUserTimerRef.current) {
        clearTimeout(singleUserTimerRef.current);
        singleUserTimerRef.current = null;
      }
    };
  }, [
    roomStatus,
    isLoaded,
    isReady,
    onlineCount,
    allReady,
    getServerTime,
    showSessionEnded,
    validPresetId,
  ]);

  // Play audio when countdown transitions from >0 to 0
  useEffect(() => {
    const prev = prevCountdownRef.current;
    prevCountdownRef.current = countdownSeconds;

    // Only play when countdown was > 0 and now is 0 (actual countdown finished)
    const countdownJustFinished =
      prev !== null && prev > 0 && countdownSeconds === 0;

    if (
      roomStatus === "countdown" &&
      countdownJustFinished &&
      isLoaded &&
      !isPlaying &&
      !hasStartedPlayingRef.current
    ) {
      hasStartedPlayingRef.current = true;
      playNow();
    }
  }, [roomStatus, countdownSeconds, isLoaded, isPlaying, playNow]);

  // Track playback state and handle audio ending naturally
  useEffect(() => {
    if (isPlaying) {
      hasStartedPlayingRef.current = true;
      exitedManuallyRef.current = false;
    } else if (hasStartedPlayingRef.current && !exitedManuallyRef.current) {
      // Audio finished playing naturally - show session ended screen
      setShowSessionEnded(true);
      if (validPresetId) {
        resetTogetherRoom(validPresetId);
      }
      setIsReady(false);
      hasStartedPlayingRef.current = false;
      // Auto-unmute after session ends
      if (isVoiceEnabled) {
        unmuteAll();
      }
    }
  }, [isPlaying, isVoiceEnabled, unmuteAll, validPresetId]);

  // Auto-exit after session ended and user hasn't interacted
  useEffect(() => {
    if (!showSessionEnded) return;

    const timer = setTimeout(() => {
      navigate("/room");
    }, AUTO_EXIT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [showSessionEnded, navigate]);

  // Reset playback flag when room goes back to idle
  useEffect(() => {
    if (roomStatus === "idle") {
      hasStartedPlayingRef.current = false;
    }
  }, [roomStatus]);

  // Periodic audio sync - correct drift if audio position differs from expected
  useEffect(() => {
    if (!isPlaying || !startTimestamp) return;

    const syncAudio = () => {
      const expectedPosition = (getServerTime() - startTimestamp) / 1000;
      const actualPosition = getCurrentTime();
      const drift = Math.abs(expectedPosition - actualPosition);

      if (
        drift > AUDIO_SYNC_THRESHOLD_S &&
        expectedPosition > 0 &&
        expectedPosition < duration
      ) {
        syncTo(expectedPosition);
      }
    };

    const interval = setInterval(syncAudio, AUDIO_SYNC_INTERVAL_MS);
    // Also sync immediately
    syncAudio();

    return () => clearInterval(interval);
  }, [
    isPlaying,
    startTimestamp,
    duration,
    getServerTime,
    getCurrentTime,
    syncTo,
  ]);

  // Format remaining time as MM:SS
  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleBack = useCallback(() => {
    navigate("/room");
  }, [navigate]);

  const handleToggleReady = useCallback(async () => {
    if (roomStatus !== "idle") return;
    // Unlock audio context on user gesture when becoming ready
    if (!isReady) {
      await unlockAudio();
      // Auto-mute when clicking Ready
      if (isVoiceEnabled) {
        muteAll();
      }
    }
    setIsReady((prev) => !prev);
  }, [roomStatus, isReady, unlockAudio, isVoiceEnabled, muteAll]);

  const handleExit = useCallback(async () => {
    exitedManuallyRef.current = true;
    stopPlayback();
    setIsReady(false);
    setShowSessionEnded(false);

    // Disable voice chat on exit
    if (isVoiceEnabled) {
      disableVoice();
    }

    // If we're the last participant, end the session
    if (onlineCount <= 1 && validPresetId) {
      resetTogetherRoom(validPresetId);
    }

    navigate("/room");
  }, [
    stopPlayback,
    navigate,
    onlineCount,
    isVoiceEnabled,
    disableVoice,
    validPresetId,
  ]);

  const handleSupportAuthor = useCallback(() => {
    if (authorUrl) {
      window.open(authorUrl, "_blank", "noopener,noreferrer");
    }
  }, [authorUrl]);

  // Handle voice button click
  const handleVoiceToggle = useCallback(async () => {
    if (!isVoiceEnabled) {
      await enableVoice();
    } else if (isMuted) {
      toggleMute();
    } else {
      toggleMute();
    }
  }, [isVoiceEnabled, isMuted, enableVoice, toggleMute]);

  // Calculate elapsed time since session started
  const getElapsedSeconds = useCallback(() => {
    if (!startTimestamp) return 0;
    return (getServerTime() - startTimestamp) / 1000;
  }, [startTimestamp, getServerTime]);

  // Check if session has expired
  const elapsedMs = startTimestamp ? getServerTime() - startTimestamp : 0;
  const isSessionStale =
    roomStatus === "countdown" &&
    startTimestamp !== null &&
    elapsedMs > MAX_SESSION_DURATION_MS;
  const isSessionExpired =
    isSessionStale ||
    (roomStatus === "countdown" &&
      startTimestamp !== null &&
      duration > 0 &&
      getElapsedSeconds() > duration);

  // Check if this is a late join (session in progress, within 18s window, not expired)
  const sessionElapsedMs = startTimestamp
    ? getServerTime() - startTimestamp
    : 0;
  const isLateJoin =
    roomStatus === "countdown" &&
    startTimestamp !== null &&
    sessionElapsedMs > 0 &&
    sessionElapsedMs <= LATE_JOIN_WINDOW_MS &&
    !isPlaying &&
    !isSessionExpired;

  // Too late to join - session started more than 18 seconds ago
  const isTooLateToJoin =
    roomStatus === "countdown" &&
    startTimestamp !== null &&
    sessionElapsedMs > LATE_JOIN_WINDOW_MS &&
    !isPlaying &&
    !isSessionExpired;

  // Auto-reset expired sessions
  useEffect(() => {
    if (isSessionExpired && validPresetId) {
      resetTogetherRoom(validPresetId);
    }
  }, [isSessionExpired, validPresetId]);

  // Periodically check for stale sessions
  useEffect(() => {
    if (
      roomStatus !== "countdown" ||
      isPlaying ||
      !startTimestamp ||
      !validPresetId
    ) {
      return;
    }

    const checkStale = () => {
      const elapsed = getServerTime() - startTimestamp;
      if (elapsed > MAX_SESSION_DURATION_MS) {
        resetTogetherRoom(validPresetId);
      }
    };

    checkStale();
    const interval = setInterval(checkStale, 5000);

    return () => clearInterval(interval);
  }, [roomStatus, isPlaying, startTimestamp, getServerTime, validPresetId]);

  // Auto-end session if it appears abandoned
  useEffect(() => {
    const isActiveSession =
      roomStatus === "countdown" &&
      startTimestamp !== null &&
      getServerTime() > startTimestamp;

    if (!isActiveSession || !validPresetId) return;

    if (onlineCount === 0) {
      resetTogetherRoom(validPresetId);
      return;
    }

    const sessionStartedSecondsAgo = (getServerTime() - startTimestamp) / 1000;
    if (onlineCount === 1 && !isPlaying && sessionStartedSecondsAgo > 5) {
      resetTogetherRoom(validPresetId);
    }
  }, [
    roomStatus,
    startTimestamp,
    onlineCount,
    isPlaying,
    getServerTime,
    validPresetId,
  ]);

  // Handle joining an active session (late join)
  const handleJoinSession = useCallback(async () => {
    if (!startTimestamp || !isLoaded || !duration) return;

    await unlockAudio();

    const elapsedMs = getServerTime() - startTimestamp;
    const elapsedSeconds = elapsedMs / 1000;

    if (elapsedSeconds >= 0 && elapsedSeconds < duration) {
      const getExactPosition = () => (getServerTime() - startTimestamp) / 1000;
      await playAt(elapsedSeconds, getExactPosition);
    }
  }, [startTimestamp, isLoaded, duration, unlockAudio, getServerTime, playAt]);

  // Text based on language
  const texts =
    language === "en"
      ? {
          title: "Together",
          ready: "I'm Ready",
          notReady: "Cancel",
          waiting: "Waiting...",
          loading: "Wait...",
          readyLabel: "ready",
          sessionEnd: "Remaining",
          exit: "Back",
          join: "Join the session",
          sessionEnded: "Session is over, enjoy!",
          sessionInProgress: "In progress",
          tooLate: "Session already started",
          supportAuthor: "Support Author",
        }
      : {
          title: "Вместе",
          ready: "Я Готов",
          notReady: "Отмена",
          waiting: "Ожидание...",
          loading: "Ждите",
          readyLabel: "готовы",
          sessionEnd: "Осталось",
          exit: "Назад",
          join: "Присоединиться",
          sessionEnded: "Сессия завершена!",
          sessionInProgress: "Идёт сеанс",
          tooLate: "Сессия уже началась",
          supportAuthor: "Поддержать автора",
        };

  // Format subtitle: "3 Раунда Стас: готовы 2/3" or just preset title during playback
  const subtitleText = useMemo(() => {
    if (!presetTitle) return "...";
    if (isPlaying || showSessionEnded) return presetTitle;
    return `${presetTitle}: ${texts.readyLabel} ${readyCount}/${onlineCount}`;
  }, [
    presetTitle,
    isPlaying,
    showSessionEnded,
    texts.readyLabel,
    readyCount,
    onlineCount,
  ]);

  if (!validPresetId) {
    return null;
  }

  return (
    <div className="page-container">
      {roomStatus === "countdown" && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}

      <TopBar showBack onBack={handleBack} />

      <main className="page-content">
        <div className="content-centered">
          <header className="page-header">
            <h1>{texts.title}</h1>
            <p className="subtitle">{subtitleText}</p>
            {/* Participant list - moved to header, above the circle */}
            <ParticipantList
              participants={participants}
              currentClientId={clientId}
              language={language || "en"}
            />
          </header>

          <BreathingCircle isActive={isPlaying} phase={currentPhase}>
            {/* Phase info - displayed as overlay on the circle during playback */}
            {isPlaying && !showSessionEnded && (
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
            {/* Late join / Too late status - displayed inside circle */}
            {(isLateJoin || isTooLateToJoin) && !isPlaying && !showSessionEnded && (
              <div className="circle-overlay-content">
                <div className="overlay-phase">
                  <span className="overlay-phase-label">
                    {isLateJoin ? texts.sessionInProgress : texts.tooLate}
                  </span>
                  <span className="overlay-phase-time">
                    {formatRemainingTime(remainingTime)}
                  </span>
                </div>
              </div>
            )}
          </BreathingCircle>

          <div className="room-info">
            {/* Voice error message */}
            {voiceError && <p className="voice-error">{voiceError}</p>}

            {/* Idle state - show only when not playing and not showing session ended */}
            {roomStatus === "idle" && !isPlaying && !showSessionEnded && (
              <>
                <div className="voice-controls">
                  <VoiceChatButton
                    isVoiceEnabled={isVoiceEnabled}
                    isMuted={isMuted}
                    isSpeaking={isSpeaking}
                    disabled={isRoomFull && !isVoiceEnabled}
                    onToggle={handleVoiceToggle}
                  />
                  <button
                    className={`btn btn--primary btn--lg ${isReady ? "active" : ""}`}
                    onClick={handleToggleReady}
                    disabled={!isLoaded}
                  >
                    {!isLoaded
                      ? texts.loading
                      : isReady
                        ? texts.notReady
                        : texts.ready}
                  </button>
                </div>

                {isReady && onlineCount > 1 && !allReady && (
                  <p className="waiting-message">{texts.waiting}</p>
                )}
              </>
            )}

            {/* Countdown state - waiting for countdown to finish */}
            {roomStatus === "countdown" &&
              !isPlaying &&
              !isLateJoin &&
              !isTooLateToJoin &&
              !showSessionEnded && (
                <div className="countdown-message">
                  <div className="voice-controls">
                    {isVoiceEnabled && (
                      <VoiceChatButton
                        isVoiceEnabled={isVoiceEnabled}
                        isMuted={isMuted}
                        isSpeaking={isSpeaking}
                        onToggle={toggleMute}
                      />
                    )}
                    <button className="btn btn--secondary" onClick={handleExit}>
                      {texts.exit}
                    </button>
                  </div>
                </div>
              )}

            {/* Late join state - session in progress, user can join */}
            {isLateJoin && !isPlaying && !showSessionEnded && (
              <div className="late-join-message">
                <button
                  className="btn btn--primary btn--lg"
                  onClick={handleJoinSession}
                  disabled={!isLoaded}
                >
                  {isLoaded ? texts.join : texts.loading}
                </button>
              </div>
            )}

            {/* Too late to join - session started more than 18 seconds ago */}
            {isTooLateToJoin && !showSessionEnded && (
              <div className="too-late-message">
                <button className="btn btn--secondary" onClick={handleExit}>
                  {texts.exit}
                </button>
              </div>
            )}

            {/* Playing state - audio is playing */}
            {isPlaying && !showSessionEnded && (
              <div className="playing-controls">
                <div className="remaining-time">
                  <span className="remaining-time-label">
                    {texts.sessionEnd}
                  </span>
                  <span className="remaining-time-value">
                    {formatRemainingTime(remainingTime)}
                  </span>
                </div>
                <div className="voice-controls">
                  <VoiceChatButton
                    isVoiceEnabled={isVoiceEnabled}
                    isMuted={isMuted}
                    isSpeaking={isSpeaking}
                    disabled={isRoomFull && !isVoiceEnabled}
                    onToggle={handleVoiceToggle}
                  />
                  <button
                    className="btn btn--primary btn--lg"
                    onClick={handleExit}
                  >
                    {texts.exit}
                  </button>
                </div>
              </div>
            )}

            {/* Session ended state */}
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
        </div>
      </main>
    </div>
  );
}
