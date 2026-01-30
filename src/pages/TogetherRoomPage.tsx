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
  useOfflinePresets,
  useContentIndex,
  isValidPreset,
  startTogetherCountdown,
  resetTogetherRoom,
} from "../hooks";
import {
  SINGLE_USER_WAIT_MS,
  MAX_SESSION_DURATION_MS,
  LATE_JOIN_WINDOW_MS,
  AUDIO_SYNC_INTERVAL_MS,
  AUDIO_SYNC_THRESHOLD_S,
  POST_SESSION_CHAT_MS,
  getAudioUrl,
} from "../utils/constants";
import { BreathingCircle } from "../components/BreathingCircle";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { TopBar } from "../components/TopBar";
import { VoiceChatButton } from "../components/VoiceChatButton";
import { ParticipantList } from "../components/ParticipantList";
import { getCueUrlFromAudioUrl } from "../utils/phaseCues";

export function TogetherRoomPage() {
  const navigate = useNavigate();
  const { presetId: presetIdParam } = useParams<{ presetId: string }>();
  const { language } = useAppContext();
  const { togetherPresets, isLoading: isLoadingPresets } = useContentIndex();

  // Validate presetId - check if it's a valid preset
  const validPresetId = isValidPreset(presetIdParam, togetherPresets)
    ? presetIdParam
    : null;
  const audioUrl = validPresetId ? getAudioUrl(validPresetId) : null;

  // Firebase hooks
  const clientId = useClientId();
  const { getServerTime } = useServerTime();
  const roomState = useTogetherRoomState(validPresetId);

  // Room path for Firebase
  const roomPath = validPresetId ? `together/${validPresetId}` : null;

  // Local ready state (sent to Firebase)
  const [isReady, setIsReady] = useState(false);
  const [presetTitle, setPresetTitle] = useState<string>("");
  const [hasAudioEnded, setHasAudioEnded] = useState(false);

  // Single user waiting timer ref
  const singleUserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if playback has been initiated to prevent duplicate calls
  const hasStartedPlayingRef = useRef(false);

  // Track previous countdown value to detect transition from >0 to 0
  const prevCountdownRef = useRef<number | null>(null);

  // Track if auto-unmute already happened after audio ended
  const autoUnmutedRef = useRef(false);

  // Track presence with ready status
  const { onlineCount, clients } = usePresence(roomPath, clientId, {
    isReady,
  });

  // Voice chat
  const {
    isVoiceEnabled,
    isPaused: isVoicePaused,
    isMuted,
    isSpeaking,
    participants,
    isRoomFull,
    error: voiceError,
    enableVoice,
    disableVoice,
    pauseVoice,
    resumeVoice,
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

  // Phase cues for displaying Breathe/Pause/Hold (keep active during pause)
  const { currentPhase, phaseRemaining, authorUrl } = usePhaseCues(
    audioUrl,
    getCurrentTime,
    isPlaying,
  );

  // Offline status
  const { isPresetCached, cachePreset } = useOfflinePresets();
  const isCurrentPresetCached = validPresetId
    ? isPresetCached(validPresetId)
    : false;

  // Cache preset for offline use when playback starts
  useEffect(() => {
    if (isPlaying && validPresetId && !isCurrentPresetCached) {
      cachePreset(validPresetId);
    }
  }, [isPlaying, validPresetId, isCurrentPresetCached, cachePreset]);

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

  // Redirect if invalid preset (wait for presets to load first)
  useEffect(() => {
    if (!isLoadingPresets && !validPresetId) {
      navigate("/room");
    }
  }, [validPresetId, navigate, isLoadingPresets]);

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

    // Only proceed if room is idle, audio loaded, and user is ready
    if (roomStatus !== "idle" || !isLoaded || !isReady || !validPresetId) {
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
      setHasAudioEnded(false);
    } else if (hasStartedPlayingRef.current && !exitedManuallyRef.current) {
      // Audio finished playing naturally - stay on page for voice chat
      setHasAudioEnded(true);
      setIsReady(false);
      hasStartedPlayingRef.current = false;
      // Don't reset room - let people continue talking
      // Room will reset when everyone leaves or after timeout
    }
  }, [isPlaying]);

  // Pause voice chat during audio playback to prevent iOS audio ducking
  // Resume when audio ends
  useEffect(() => {
    if (isPlaying && isVoiceEnabled && !isVoicePaused) {
      pauseVoice();
    } else if (!isPlaying && hasAudioEnded && isVoiceEnabled && isVoicePaused) {
      resumeVoice();
    }
  }, [isPlaying, hasAudioEnded, isVoiceEnabled, isVoicePaused, pauseVoice, resumeVoice]);

  // Auto-unmute voice chat when audio ends so people can talk (only once)
  useEffect(() => {
    if (hasAudioEnded && isVoiceEnabled && isMuted && !autoUnmutedRef.current) {
      autoUnmutedRef.current = true;
      unmuteAll();
    }
    // Reset flag when starting new session
    if (!hasAudioEnded) {
      autoUnmutedRef.current = false;
    }
  }, [hasAudioEnded, isVoiceEnabled, isMuted, unmuteAll]);

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
    setHasAudioEnded(false);

    // Disable voice chat on exit
    if (isVoiceEnabled) {
      disableVoice();
    }

    // Always reset room when exiting - let other users restart if needed
    // This prevents stale sessions when the last user leaves
    if (validPresetId) {
      resetTogetherRoom(validPresetId);
    }

    navigate("/room");
  }, [
    stopPlayback,
    navigate,
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

  // Auto-end session if it appears abandoned or stale
  useEffect(() => {
    const isActiveSession =
      roomStatus === "countdown" &&
      startTimestamp !== null &&
      getServerTime() > startTimestamp;

    if (!isActiveSession || !validPresetId) return;

    // No one online - reset immediately
    if (onlineCount === 0) {
      resetTogetherRoom(validPresetId);
      return;
    }

    const sessionElapsedMs = getServerTime() - startTimestamp;
    const sessionStartedSecondsAgo = sessionElapsedMs / 1000;
    const audioEndedMs = duration > 0 ? sessionElapsedMs - duration * 1000 : 0;
    const isAudioFinished = duration > 0 && sessionStartedSecondsAgo > duration;

    // If audio finished, allow post-session chat for POST_SESSION_CHAT_MS
    if (isAudioFinished) {
      // Reset only if chat time exceeded
      if (audioEndedMs > POST_SESSION_CHAT_MS) {
        resetTogetherRoom(validPresetId);
      }
      // Otherwise let people chat - don't reset
      return;
    }

    // Single user with stale session (> 5 seconds old, not playing) - reset
    if (onlineCount === 1 && !isPlaying && sessionStartedSecondsAgo > 5) {
      resetTogetherRoom(validPresetId);
      return;
    }

    // Session is past late join window and no one is playing - reset
    // This handles the case where everyone left during countdown
    if (!isPlaying && sessionStartedSecondsAgo > LATE_JOIN_WINDOW_MS / 1000) {
      resetTogetherRoom(validPresetId);
    }
  }, [
    roomStatus,
    startTimestamp,
    onlineCount,
    isPlaying,
    getServerTime,
    validPresetId,
    duration,
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
          sessionInProgress: "In progress",
          tooLate: "Session already started",
          done: "Done",
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
          sessionInProgress: "Идёт сеанс",
          tooLate: "Сессия уже началась",
          done: "Готово",
          supportAuthor: "Поддержать автора",
        };

  // Format subtitle: "3 Раунда Стас: готовы 2/3" or just preset title during playback
  const subtitleText = useMemo(() => {
    if (!presetTitle) return "...";
    if (isPlaying) return presetTitle;
    return `${presetTitle}: ${texts.readyLabel} ${readyCount}/${onlineCount}`;
  }, [presetTitle, isPlaying, texts.readyLabel, readyCount, onlineCount]);

  if (!validPresetId) {
    return null;
  }

  return (
    <div className="app-container">
      {roomStatus === "countdown" && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} />
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
              {subtitleText}
            </h4>
            {/* Participant list - moved to header, above the circle */}
            <ParticipantList
              participants={participants}
              currentClientId={clientId}
              language={language || "en"}
            />
          </header>

          <BreathingCircle isActive={isPlaying} phase={currentPhase}>
            {/* Phase info - displayed as overlay on the circle during playback or when ended */}
            {(isPlaying || hasAudioEnded) && (
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
            {/* Late join / Too late status - displayed inside circle */}
            {(isLateJoin || isTooLateToJoin) &&
              !isPlaying &&
              !hasAudioEnded && (
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

            {/* Idle state - show only when not playing and audio hasn't ended */}
            {roomStatus === "idle" && !isPlaying && !hasAudioEnded && (
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
              !isTooLateToJoin && (
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
            {isLateJoin && !isPlaying && (
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
            {isTooLateToJoin && (
              <div className="too-late-message">
                <button className="btn btn--secondary" onClick={handleExit}>
                  {texts.exit}
                </button>
              </div>
            )}

            {/* Playing state - audio is playing */}
            {isPlaying && (
              <div className="playing-controls">
                <div className="remaining-time">
                  <span className="remaining-time-label">{texts.sessionEnd}</span>
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

            {/* Audio ended state - voice chat continues */}
            {hasAudioEnded && !isPlaying && (
              <div className="playing-controls">
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
          </div>
        </div>
      </main>
    </div>
  );
}
