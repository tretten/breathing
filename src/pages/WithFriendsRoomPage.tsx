// src/pages/WithFriendsRoomPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  useClientId,
  useServerTime,
  usePresence,
  useRoomState,
  useAudioPlayback,
  usePhaseCues,
  useVoiceChat,
  updateRoomPreset,
  startCustomRoomCountdown,
  resetCustomRoom,
} from "../hooks";
import { AUDIO_URLS } from "../utils/constants";
import { BreathingCircle } from "../components/BreathingCircle";
import { PhaseOverlay } from "../components/PhaseOverlay";
import { PresetSelector } from "../components/PresetSelector";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { TopBar } from "../components/TopBar";
import { VoiceChatButton } from "../components/VoiceChatButton";
import { ParticipantList } from "../components/ParticipantList";
import type { PresetId } from "../types";

const SINGLE_USER_WAIT_MS = 3000; // 3 seconds wait for single user
const MAX_SESSION_DURATION_MS = 20 * 60 * 1000; // 20 minutes max session (safety margin for longest audio)
const AUTO_EXIT_DELAY = 10000; // 10 seconds before auto-exit after session ends

export function WithFriendsRoomPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();

  // Firebase hooks
  const clientId = useClientId();
  const { getServerTime } = useServerTime();
  const roomState = useRoomState("with_friends");

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
  const { onlineCount, clients } = usePresence("with_friends", clientId, {
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
    roomId: "with_friends",
    clientId,
    clients,
  });

  // Room's preset (what others selected)
  const roomPreset = roomState?.selectedPreset || null;

  // Use local preset for audio loading (immediate), fall back to room state
  const selectedPreset = localPreset || roomPreset;
  const audioUrl = selectedPreset ? AUDIO_URLS[selectedPreset] : null;

  // Track if user has selected a preset
  const hasSelectedPreset = localPreset !== null;

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
  } = useAudioPlayback(audioUrl, { presetId: selectedPreset, language });

  // Phase cues for displaying Breathe/Pause/Hold
  const { currentPhase, phaseRemaining, authorUrl } = usePhaseCues(
    audioUrl,
    getCurrentTime,
    isPlaying,
  );

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

  // Late join remaining time (updates every second)
  const [lateJoinRemaining, setLateJoinRemaining] = useState(0);

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
    if (roomStatus !== "idle" || !isLoaded || !isReady || showSessionEnded) {
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
  }, [
    roomStatus,
    isLoaded,
    isReady,
    onlineCount,
    allReady,
    getServerTime,
    showSessionEnded,
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
      resetCustomRoom();
      setIsReady(false);
      hasStartedPlayingRef.current = false;
      // Auto-unmute after session ends
      if (isVoiceEnabled) {
        unmuteAll();
      }
    }
  }, [isPlaying, isVoiceEnabled, unmuteAll]);

  // Auto-exit after 10 seconds if session ended and user hasn't interacted
  useEffect(() => {
    if (!showSessionEnded) return;

    const timer = setTimeout(() => {
      navigate("/");
    }, AUTO_EXIT_DELAY);

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

    const SYNC_THRESHOLD = 0.5; // Sync if drift > 0.5 seconds
    const SYNC_INTERVAL = 1000; // Check every second

    const syncAudio = () => {
      const expectedPosition = (getServerTime() - startTimestamp) / 1000;
      const actualPosition = getCurrentTime();
      const drift = Math.abs(expectedPosition - actualPosition);

      if (
        drift > SYNC_THRESHOLD &&
        expectedPosition > 0 &&
        expectedPosition < duration
      ) {
        syncTo(expectedPosition);
      }
    };

    const interval = setInterval(syncAudio, SYNC_INTERVAL);
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
    navigate("/");
  }, [navigate]);

  const handlePresetChange = useCallback(
    async (preset: PresetId) => {
      if (roomStatus !== "idle") return;
      setLocalPreset(preset);
      await updateRoomPreset(preset);
    },
    [roomStatus],
  );

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
    if (onlineCount <= 1) {
      resetCustomRoom();
    }

    navigate("/");
  }, [stopPlayback, navigate, onlineCount, isVoiceEnabled, disableVoice]);

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

  // Check if session has expired (audio already finished OR session is stale)
  // Session is stale if it's been running longer than max duration (even if audio not loaded yet)
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

  // Check if this is a late join (session in progress, not expired)
  const isLateJoin =
    roomStatus === "countdown" &&
    startTimestamp !== null &&
    getServerTime() > startTimestamp &&
    !isPlaying &&
    !isSessionExpired;

  // Auto-reset expired sessions
  useEffect(() => {
    if (isSessionExpired) {
      resetCustomRoom();
    }
  }, [isSessionExpired]);

  // Periodically check for stale sessions (runs every 5s when room is in countdown but not playing)
  // This ensures stale sessions are detected even if audio isn't loaded yet
  useEffect(() => {
    if (roomStatus !== "countdown" || isPlaying || !startTimestamp) {
      return;
    }

    const checkStale = () => {
      const elapsed = getServerTime() - startTimestamp;
      // If session has been running for more than max duration, reset
      if (elapsed > MAX_SESSION_DURATION_MS) {
        resetCustomRoom();
      }
    };

    // Check immediately and every 5 seconds
    checkStale();
    const interval = setInterval(checkStale, 5000);

    return () => clearInterval(interval);
  }, [roomStatus, isPlaying, startTimestamp, getServerTime]);

  // Auto-end session if it appears abandoned (no active listeners or solo user in a "started" session)
  useEffect(() => {
    // Only check during active session (countdown started, audio should be playing)
    const isActiveSession =
      roomStatus === "countdown" &&
      startTimestamp !== null &&
      getServerTime() > startTimestamp;

    if (!isActiveSession) return;

    // Reset if no one is online
    if (onlineCount === 0) {
      resetCustomRoom();
      return;
    }

    // If I'm the only one online, the session already started (past startTimestamp),
    // and I'm NOT currently playing (meaning I just joined), this is a stale session
    // Give a small grace period (2 seconds) for late joins before assuming it's stale
    const sessionStartedSecondsAgo = (getServerTime() - startTimestamp) / 1000;
    if (onlineCount === 1 && !isPlaying && sessionStartedSecondsAgo > 5) {
      // I'm alone in a session that started over 5 seconds ago and I'm not playing
      // This means everyone else left - reset the room
      resetCustomRoom();
    }
  }, [roomStatus, startTimestamp, onlineCount, isPlaying, getServerTime]);

  // Update late join remaining time
  useEffect(() => {
    if (!isLateJoin || !startTimestamp || !duration) {
      return;
    }

    const updateRemaining = () => {
      const elapsed = getElapsedSeconds();
      const remaining = Math.max(0, duration - elapsed);
      setLateJoinRemaining(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [isLateJoin, startTimestamp, duration, getElapsedSeconds]);

  // Handle joining an active session (late join)
  const handleJoinSession = useCallback(async () => {
    if (!startTimestamp || !isLoaded || !duration) return;

    // First unlock audio with user gesture
    await unlockAudio();

    // Calculate initial elapsed time
    const elapsedMs = getServerTime() - startTimestamp;
    const elapsedSeconds = elapsedMs / 1000;

    // If session is still within audio duration, sync to position
    if (elapsedSeconds >= 0 && elapsedSeconds < duration) {
      // Pass function to recalculate exact position right before play
      const getExactPosition = () => (getServerTime() - startTimestamp) / 1000;
      await playAt(elapsedSeconds, getExactPosition);
    }
  }, [startTimestamp, isLoaded, duration, unlockAudio, getServerTime, playAt]);

  const canChangePreset = roomStatus === "idle" && !isReady;
  const canPressReady = hasSelectedPreset && isLoaded;

  // Text based on language
  const texts =
    language === "en"
      ? {
          appTitle: "Wim Hof",
          title: "Together",
          inRoom: "in the room",
          selectPreset: "Choose",
          ready: "I'm Ready",
          notReady: "Cancel",
          waiting: "Waiting...",
          readyCount: "ready",
          loading: "Wait...",
          sessionEnd: "Remaining",
          exit: "Exit",
          join: "Join",
          sessionEnded: "Session is over, enjoy!",
          sessionInProgress: "In progress",
          online: "online",
          supportAuthor: "Support Author",
          roomFull: "Room is full",
          roomFullDesc: "Maximum 8 participants with voice chat",
          continueWithoutVoice: "Continue without voice",
          goBack: "Go back",
        }
      : {
          appTitle: "Вим Хоф",
          title: "Вместе",
          inRoom: "в комнате",
          selectPreset: "Выбор",
          ready: "Я Готов",
          notReady: "Отмена",
          waiting: "Ожидание...",
          readyCount: "готовы",
          loading: "Ждите",
          sessionEnd: "Осталось",
          exit: "Выйти",
          join: "Войти",
          sessionEnded: "Сессия завершена!",
          sessionInProgress: "Идёт сеанс",
          online: "онлайн",
          supportAuthor: "Поддержать автора",
          roomFull: "Комната заполнена",
          roomFullDesc: "Максимум 8 участников с голосовым чатом",
          continueWithoutVoice: "Продолжить без голоса",
          goBack: "Назад",
        };

  return (
    <div className="page-container">
      {roomStatus === "countdown" && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}

      <TopBar showBack onBack={handleBack} />

      <main className="page-content">
        <div className="content-centered">
          <header className="page-header">
            <p className="page-subtitle">{texts.appTitle}</p>
            <h1>{texts.title}</h1>
            <p className="room-online-count">
              {onlineCount} {texts.inRoom}
            </p>
          </header>

          {(roomStatus !== "idle" || isPlaying) && (
            <BreathingCircle isActive={isPlaying} phase={currentPhase} />
          )}

          <div className="room-info">
            {/* Participant list - always show */}
            <ParticipantList
              participants={participants}
              currentClientId={clientId}
            />

            {/* Voice error message */}
            {voiceError && <p className="voice-error">{voiceError}</p>}

            {/* Idle state - show only when not playing and not showing session ended */}
            {roomStatus === "idle" && !isPlaying && !showSessionEnded && (
              <>
                <PresetSelector
                  selected={localPreset}
                  preselected={roomPreset}
                  onChange={handlePresetChange}
                  disabled={!canChangePreset}
                />

                <div className="ready-status">
                  <div className="ready-bar">
                    <div
                      className="ready-fill"
                      style={{
                        width:
                          onlineCount > 0
                            ? `${(readyCount / onlineCount) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span>
                    {readyCount} / {onlineCount} {texts.readyCount}
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
                    className={`ready-button ${isReady ? "ready" : ""}`}
                    onClick={handleToggleReady}
                    disabled={!canPressReady}
                  >
                    {!hasSelectedPreset
                      ? texts.selectPreset
                      : !isLoaded
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
                    <button className="exit-button" onClick={handleExit}>
                      {texts.exit}
                    </button>
                  </div>
                </div>
              )}

            {/* Late join state - session in progress, user can join */}
            {isLateJoin && !isPlaying && !showSessionEnded && (
              <div className="late-join-message">
                <p className="session-status">{texts.sessionInProgress}</p>
                {lateJoinRemaining > 0 && (
                  <div
                    className="session-timer"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <span className="timer-label">{texts.sessionEnd}</span>
                    <span className="timer-value">
                      {formatRemainingTime(lateJoinRemaining)}
                    </span>
                  </div>
                )}
                <button
                  className="join-button"
                  onClick={handleJoinSession}
                  disabled={!isLoaded}
                >
                  {isLoaded ? texts.join : texts.loading}
                </button>
              </div>
            )}

            {/* Playing state - audio is playing */}
            {isPlaying && !showSessionEnded && (
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
                      {texts.sessionEnd}
                    </span>
                    <span className="total-timer-value">
                      {formatRemainingTime(remainingTime)}
                    </span>
                  </div>
                </div>
                <div className="voice-controls">
                  {isVoiceEnabled && (
                    <VoiceChatButton
                      isVoiceEnabled={isVoiceEnabled}
                      isMuted={isMuted}
                      isSpeaking={isSpeaking}
                      onToggle={toggleMute}
                    />
                  )}
                  <button className="exit-button" onClick={handleExit}>
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
