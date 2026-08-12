// src/pages/TogetherRoomPage.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  getClientId,
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
  MAX_SESSION_DURATION_MS,
  LATE_JOIN_WINDOW_MS,
  AUDIO_SYNC_INTERVAL_MS,
  AUDIO_SYNC_THRESHOLD_S,
  POST_SESSION_CHAT_MS,
  getAudioUrl,
} from "../utils/constants";
import { formatSeconds } from "../utils/helpers";
import { getPhaseText } from "../utils/phaseCues";
import { BreathingCircle } from "../components/BreathingCircle";
import { OfflineIcon } from "../components/Icons";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { TopBar } from "../components/TopBar";
import { VoiceChatButton } from "../components/VoiceChatButton";
import { ParticipantList } from "../components/ParticipantList";
import { DebugStrip } from "../components/DebugStrip";

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
  const [clientId] = useState(() => getClientId());
  const { getServerTime } = useServerTime();
  const roomState = useTogetherRoomState(validPresetId);

  // Room path for Firebase
  const roomPath = validPresetId ? `together/${validPresetId}` : null;

  // Local ready state (sent to Firebase)
  const [isReady, setIsReady] = useState(false);
  const [hasAudioEnded, setHasAudioEnded] = useState(false);

  // Track if playback has been initiated to prevent duplicate calls
  const hasStartedPlayingRef = useRef(false);

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
    schedulePlayback,
    playAt,
    syncTo,
    getCurrentTime,
    stopPlayback,
  } = useAudioPlayback(audioUrl, {
    presetId: validPresetId,
    language,
    onEnded: () => {
      // Audio genuinely reached the end - not inferred from state, so a
      // slow start or failed play() can never fake the "done" screen
      hasStartedPlayingRef.current = false;
      setIsReady(false);
      setHasAudioEnded(true);
    },
  });

  // Phase cues for displaying Breathe/Pause/Hold (keep active during pause)
  const { currentPhase, phaseRemaining, authorUrl, title, titleRu } =
    usePhaseCues(audioUrl, getCurrentTime, isPlaying);

  // Preset title from the same cue file usePhaseCues already loads
  const presetTitle = title
    ? language === "ru"
      ? titleRu || title
      : title
    : "";

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

  // Calculate ready count
  const readyCount = Object.values(clients).filter((c) => c.isReady).length;
  const allReady = onlineCount > 0 && readyCount === onlineCount;

  // Room status from Firebase
  const roomStatus = roomState?.status || "idle";
  const startTimestamp = roomState?.startTimestamp || null;

  // Calculate countdown seconds for overlay
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // Redirect if invalid preset (wait for presets to load first)
  useEffect(() => {
    if (!isLoadingPresets && !validPresetId) {
      navigate("/room");
    }
  }, [validPresetId, navigate, isLoadingPresets]);

  useEffect(() => {
    if (roomStatus !== "countdown" || !startTimestamp) {
      setCountdownSeconds(0);
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

  // Start the session when more than one user is online and all are ready
  useEffect(() => {
    if (roomStatus !== "idle" || !isReady || !validPresetId) {
      return;
    }

    if (onlineCount > 1 && allReady) {
      startTogetherCountdown(validPresetId, getServerTime);
    }
  }, [
    roomStatus,
    isReady,
    onlineCount,
    allReady,
    getServerTime,
    validPresetId,
  ]);

  // Schedule playback from position 0 at the server timestamp.
  // Only fires while the start timestamp is still ahead (the client was
  // present during the countdown). If the session already started, the
  // client sees the "Join" button instead and resumes from the current
  // position via playAt.
  useEffect(() => {
    if (
      roomStatus !== "countdown" ||
      !startTimestamp ||
      !isLoaded ||
      isPlaying ||
      hasStartedPlayingRef.current
    ) {
      return;
    }

    hasStartedPlayingRef.current = true;
    schedulePlayback(startTimestamp, getServerTime);
  }, [roomStatus, startTimestamp, isLoaded, isPlaying, getServerTime, schedulePlayback]);

  // Track playback state - reset end state when playback starts
  useEffect(() => {
    if (isPlaying) {
      hasStartedPlayingRef.current = true;
      setHasAudioEnded(false);
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

  // Reset playback/end flags when room goes back to idle, so a lone user
  // lands back on the Ready screen instead of the done screen
  useEffect(() => {
    if (roomStatus === "idle") {
      hasStartedPlayingRef.current = false;
      setHasAudioEnded(false);
      setIsReady(false);
    }
  }, [roomStatus]);

  // If the audio dropped out of the loaded state (transient error, retry in
  // progress), allow the playback effect to re-arm once it loads again
  useEffect(() => {
    if (!isLoaded) {
      hasStartedPlayingRef.current = false;
    }
  }, [isLoaded]);

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
    stopPlayback();
    setIsReady(false);
    setHasAudioEnded(false);

    // Disable voice chat on exit
    if (isVoiceEnabled) {
      disableVoice();
    }

    // Do NOT reset the room - the session keeps running for the others,
    // and the exiting participant can re-join from the current position
    navigate("/room");
  }, [
    stopPlayback,
    navigate,
    isVoiceEnabled,
    disableVoice,
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
    } else {
      toggleMute();
    }
  }, [isVoiceEnabled, enableVoice, toggleMute]);

  // Check if this is a late join (session running, join at any point before
  // the track ends)
  const sessionElapsedMs = startTimestamp
    ? getServerTime() - startTimestamp
    : 0;
  const isLateJoin =
    roomStatus === "countdown" &&
    startTimestamp !== null &&
    duration > 0 &&
    sessionElapsedMs > 0 &&
    sessionElapsedMs / 1000 < duration &&
    !isPlaying &&
    !hasAudioEnded;

  // Session already finished - wait for the room to reset
  const isSessionOver =
    roomStatus === "countdown" &&
    startTimestamp !== null &&
    duration > 0 &&
    sessionElapsedMs / 1000 >= duration &&
    !isPlaying;

  // Periodically reset stale/abandoned sessions (merged checks)
  useEffect(() => {
    if (roomStatus !== "countdown" || !startTimestamp || !validPresetId) {
      return;
    }

    const checkStale = () => {
      const sessionElapsedMs = getServerTime() - startTimestamp;
      if (sessionElapsedMs < 0) return; // countdown hasn't started yet
      const sessionStartedSecondsAgo = sessionElapsedMs / 1000;
      const audioEndedMs = duration > 0 ? sessionElapsedMs - duration * 1000 : 0;
      const isAudioFinished = duration > 0 && sessionStartedSecondsAgo > duration;

      // Session too old - reset
      if (sessionElapsedMs > MAX_SESSION_DURATION_MS) {
        resetTogetherRoom(validPresetId);
        return;
      }

      // No one online - reset immediately
      if (onlineCount === 0) {
        resetTogetherRoom(validPresetId);
        return;
      }

      // If audio finished, allow post-session chat only when others are in
      // the room; a lone user gets reset right back to the Ready screen
      if (isAudioFinished) {
        const roomHasOthers = onlineCount > 1;
        if (roomHasOthers && audioEndedMs <= POST_SESSION_CHAT_MS) {
          return; // Let people chat - don't reset
        }
        resetTogetherRoom(validPresetId);
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
    };

    checkStale();
    const interval = setInterval(checkStale, 5000);

    return () => clearInterval(interval);
  }, [
    roomStatus,
    startTimestamp,
    onlineCount,
    isPlaying,
    getServerTime,
    validPresetId,
    duration,
  ]);

  // Track if audio is ready via refs so the async join handler can poll
  const isLoadedRef = useRef(isLoaded);
  isLoadedRef.current = isLoaded;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  // Handle joining an active session (late join)
  const handleJoinSession = useCallback(async () => {
    if (!startTimestamp) return;

    await unlockAudio();

    // Wait briefly for audio to become ready (slow load / transient error)
    for (
      let i = 0;
      i < 50 && (!isLoadedRef.current || !durationRef.current);
      i++
    ) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!isLoadedRef.current || !durationRef.current) {
      console.error("Audio not ready, cannot join session");
      return;
    }

    const elapsedMs = getServerTime() - startTimestamp;
    const elapsedSeconds = elapsedMs / 1000;

    if (elapsedSeconds >= 0 && elapsedSeconds < durationRef.current) {
      await playAt(elapsedSeconds, () => (getServerTime() - startTimestamp) / 1000);
    }
  }, [startTimestamp, unlockAudio, getServerTime, playAt]);

  // Text based on language
  const texts =
    language === "en"
      ? {
          title: "Together",
          ready: "I'm Ready",
          notReady: "Cancel",
          waiting: "Waiting...",
          loading: "Loading...",
          readyLabel: "ready",
          waitForOthers: "Waiting for others...",
          sessionEnd: "Remaining",
          exit: "Exit",
          join: "Join the session",
          sessionInProgress: "In progress",
          tooLate: "Session over",
          done: "Done",
          supportAuthor: "Support Author",
        }
      : {
          title: "Вместе",
          ready: "Я Готов",
          notReady: "Отмена",
          waiting: "Ожидание...",
          loading: "Загрузка...",
          readyLabel: "готовы",
          waitForOthers: "Ожидание других...",
          sessionEnd: "Осталось",
          exit: "Выход",
          join: "Присоединиться",
          sessionInProgress: "Идёт сеанс",
          tooLate: "Сессия завершена",
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
    <div className="wrap">
      <DebugStrip />
      {roomStatus === "countdown" && countdownSeconds > 0 && (
        <CountdownOverlay seconds={countdownSeconds} language={language} />
      )}

      <TopBar showBack onBack={handleBack} />

      <main className="main">
        <div className="center">
          <header className="hdr">
            <h1>{texts.title}</h1>
            <p className="subtitle">
              {isCurrentPresetCached && (
                <span
                  className="offline-ico"
                  title={
                    language === "ru" ? "Доступен офлайн" : "Available offline"
                  }
                >
                  <OfflineIcon />
                </span>
              )}
              {subtitleText}
            </p>
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
              <div className="circ-ovl">
                <div className="phase">
                  <span className="phase-lbl">
                    {hasAudioEnded
                      ? texts.done
                      : currentPhase
                        ? getPhaseText(currentPhase, language)
                        : ""}
                  </span>
                  <span className="phase-time">
                    {!hasAudioEnded && phaseRemaining > 0 ? formatSeconds(phaseRemaining) : ""}
                  </span>
                </div>
                {/* Support author button during outro or when finished */}
                {(currentPhase === "outro" || hasAudioEnded) && authorUrl && (
                  <button
                    type="button"
                    className="btn btn--accent btn--lg"
                    onClick={handleSupportAuthor}
                  >
                    {texts.supportAuthor}
                  </button>
                )}
              </div>
            )}
            {/* Late join / Too late status - displayed inside circle */}
            {(isLateJoin || isSessionOver) &&
              !isPlaying &&
              !hasAudioEnded && (
                <div className="circ-ovl">
                  <div className="phase">
                    <span className="phase-lbl">
                      {isLateJoin ? texts.sessionInProgress : texts.tooLate}
                    </span>
                    <span className="phase-time">
                      {formatSeconds(remainingTime)}
                    </span>
                  </div>
                </div>
              )}
          </BreathingCircle>

          <div className="info">
            {/* Voice error message */}
            {voiceError && <p className="voice-err">{voiceError}</p>}

            {/* Idle state - show only when not playing and audio hasn't ended */}
            {roomStatus === "idle" && !isPlaying && !hasAudioEnded && (
              <>
                <div className="voice">
                  <VoiceChatButton
                    isVoiceEnabled={isVoiceEnabled}
                    isMuted={isMuted}
                    isSpeaking={isSpeaking}
                    disabled={isRoomFull && !isVoiceEnabled}
                    language={language}
                    onToggle={handleVoiceToggle}
                  />
                  <button
                    className={`btn btn--primary btn--lg ${isReady ? "active" : ""}`}
                    onClick={handleToggleReady}
                    disabled={!isLoaded || onlineCount <= 1}
                  >
                    {!isLoaded
                      ? texts.loading
                      : onlineCount <= 1 && !isReady
                        ? texts.waitForOthers
                        : isReady
                          ? texts.notReady
                          : texts.ready}
                  </button>
                </div>

                {isReady && onlineCount > 1 && !allReady && (
                  <p className="wait-msg">{texts.waiting}</p>
                )}
              </>
            )}

            {/* Countdown state - waiting for countdown to finish */}
            {roomStatus === "countdown" &&
              !isPlaying &&
              !isLateJoin &&
              !isSessionOver && (
                <div className="cdown-msg">
                  <div className="voice">
                    {isVoiceEnabled && (
                      <VoiceChatButton
                        isVoiceEnabled={isVoiceEnabled}
                        isMuted={isMuted}
                        isSpeaking={isSpeaking}
                        language={language}
                        onToggle={toggleMute}
                      />
                    )}
                    <button type="button" className="btn btn--secondary" onClick={handleExit}>
                      {texts.exit}
                    </button>
                  </div>
                </div>
              )}

            {/* Late join state - session in progress, user can join */}
            {isLateJoin && !isPlaying && (
              <div className="late-join-message">
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={handleJoinSession}
                  disabled={!isLoaded}
                >
                  {isLoaded ? texts.join : texts.loading}
                </button>
              </div>
            )}

            {/* Too late to join - session started more than 18 seconds ago */}
            {isSessionOver && (
              <div className="too-late-message">
                <button className="btn btn--secondary" onClick={handleExit}>
                  {texts.exit}
                </button>
              </div>
            )}

            {/* Playing state - audio is playing */}
            {isPlaying && (
              <div className="playback">
                <div className="timer">
                  <span className="timer-lbl">{texts.sessionEnd}</span>
                  <span className="timer-val">
                    {formatSeconds(remainingTime)}
                  </span>
                </div>
                <div className="voice">
                  <VoiceChatButton
                    isVoiceEnabled={isVoiceEnabled}
                    isMuted={isMuted}
                    isSpeaking={isSpeaking}
                    disabled={isRoomFull && !isVoiceEnabled}
                    language={language}
                    onToggle={handleVoiceToggle}
                  />
                  <button
                    type="button"
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
              <div className="playback">
                <div className="voice">
                  <VoiceChatButton
                    isVoiceEnabled={isVoiceEnabled}
                    isMuted={isMuted}
                    isSpeaking={isSpeaking}
                    disabled={isRoomFull && !isVoiceEnabled}
                    language={language}
                    onToggle={handleVoiceToggle}
                  />
                  <button
                    type="button"
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
