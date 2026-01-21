import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const ROOMS_CONFIG = {
  ru_4rounds: { lang: 'ru', rounds: 4, type: 'auto', label: 'Русский • 4 раунда' },
  en_4rounds: { lang: 'en', rounds: 4, type: 'auto', label: 'English • 4 rounds' },
  ru_3rounds: { lang: 'ru', rounds: 3, type: 'auto', label: 'Русский • 3 раунда' },
  en_3rounds: { lang: 'en', rounds: 3, type: 'auto', label: 'English • 3 rounds' },
  custom_ready: { type: 'ready', label: 'Custom Room' }
};

const PRESET_OPTIONS = [
  { id: 'ru_4rounds', label: 'Русский • 4 раунда' },
  { id: 'en_4rounds', label: 'English • 4 rounds' },
  { id: 'ru_3rounds', label: 'Русский • 3 раунда' },
  { id: 'en_3rounds', label: 'English • 3 rounds' }
];

const SLOT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Demo audio URLs (replace with your actual audio files)
const AUDIO_URLS = {
  ru_4rounds: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  en_4rounds: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  ru_3rounds: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  en_3rounds: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
};

// ============================================================================
// FIREBASE MOCK (Replace with real Firebase in production)
// ============================================================================

// This is a simplified mock for demonstration. In production, use:
// import { initializeApp } from 'firebase/app';
// import { getDatabase, ref, set, onValue, onDisconnect, remove, runTransaction } from 'firebase/database';

const createFirebaseMock = () => {
  const state = {
    serverTimeOffset: 0,
    rooms: {
      ru_4rounds: { online: {} },
      en_4rounds: { online: {} },
      ru_3rounds: { online: {} },
      en_3rounds: { online: {} },
      custom_ready: { 
        online: {}, 
        selectedPreset: 'ru_4rounds', 
        status: 'idle', 
        startTimestamp: null 
      }
    },
    listeners: new Map()
  };

  const notifyListeners = (path) => {
    state.listeners.forEach((callback, listenerPath) => {
      if (path.startsWith(listenerPath) || listenerPath.startsWith(path)) {
        const value = getValueAtPath(listenerPath);
        callback({ val: () => value });
      }
    });
  };

  const getValueAtPath = (path) => {
    const parts = path.split('/').filter(Boolean);
    let current = state;
    for (const part of parts) {
      if (current === undefined) return null;
      current = current[part];
    }
    return current ?? null;
  };

  const setValueAtPath = (path, value) => {
    const parts = path.split('/').filter(Boolean);
    let current = state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    if (value === null) {
      delete current[parts[parts.length - 1]];
    } else {
      current[parts[parts.length - 1]] = value;
    }
    notifyListeners(path);
  };

  return {
    ref: (path) => ({ path, toString: () => path }),
    onValue: (refObj, callback) => {
      state.listeners.set(refObj.path, callback);
      callback({ val: () => getValueAtPath(refObj.path) });
      return () => state.listeners.delete(refObj.path);
    },
    set: (refObj, value) => {
      setValueAtPath(refObj.path, value);
      return Promise.resolve();
    },
    update: (refObj, updates) => {
      Object.entries(updates).forEach(([key, value]) => {
        setValueAtPath(`${refObj.path}/${key}`, value);
      });
      return Promise.resolve();
    },
    remove: (refObj) => {
      setValueAtPath(refObj.path, null);
      return Promise.resolve();
    },
    onDisconnect: () => ({
      remove: () => Promise.resolve()
    }),
    serverTimestamp: () => Date.now(),
    getServerTimeOffset: () => state.serverTimeOffset
  };
};

const firebase = createFirebaseMock();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateClientId = () => {
  const stored = localStorage.getItem('wim_hof_client_id');
  if (stored) return stored;
  const id = 'client_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('wim_hof_client_id', id);
  return id;
};

const getNextSlotTimestamp = (serverTime) => {
  const currentSlot = Math.floor(serverTime / SLOT_INTERVAL_MS) * SLOT_INTERVAL_MS;
  const timeInSlot = serverTime - currentSlot;
  
  // If we're in the first 5 seconds of a slot, consider it "current session starting"
  if (timeInSlot < 5000) {
    return currentSlot;
  }
  return currentSlot + SLOT_INTERVAL_MS;
};

const formatTimeRemaining = (ms) => {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

const useClientId = () => {
  const [clientId] = useState(() => generateClientId());
  return clientId;
};

const useServerTime = () => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    // In real Firebase: ref(db, '.info/serverTimeOffset')
    const unsubscribe = firebase.onValue(
      firebase.ref('.info/serverTimeOffset'),
      (snap) => setOffset(snap.val() || 0)
    );
    return unsubscribe;
  }, []);

  const getServerTime = useCallback(() => Date.now() + offset, [offset]);

  return { getServerTime, offset };
};

const usePresence = (roomId, clientId, extraData = {}) => {
  const [onlineCount, setOnlineCount] = useState(0);
  const [clients, setClients] = useState({});

  useEffect(() => {
    if (!roomId || !clientId) return;

    const myRef = firebase.ref(`rooms/${roomId}/online/${clientId}`);
    const onlineRef = firebase.ref(`rooms/${roomId}/online`);

    // Register presence
    firebase.set(myRef, { 
      joinedAt: firebase.serverTimestamp(),
      ...extraData 
    });

    // Setup disconnect handler
    firebase.onDisconnect(myRef).remove();

    // Listen to online users
    const unsubscribe = firebase.onValue(onlineRef, (snap) => {
      const data = snap.val() || {};
      setClients(data);
      setOnlineCount(Object.keys(data).length);
    });

    return () => {
      unsubscribe();
      firebase.remove(myRef);
    };
  }, [roomId, clientId, JSON.stringify(extraData)]);

  return { onlineCount, clients };
};

const useRoomState = (roomId) => {
  const [roomState, setRoomState] = useState(null);

  useEffect(() => {
    if (!roomId) return;

    const roomRef = firebase.ref(`rooms/${roomId}`);
    const unsubscribe = firebase.onValue(roomRef, (snap) => {
      setRoomState(snap.val());
    });

    return unsubscribe;
  }, [roomId]);

  return roomState;
};

const useCountdown = (targetTimestamp, getServerTime) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!targetTimestamp) {
      setRemaining(0);
      return;
    }

    const update = () => {
      const serverTime = getServerTime();
      const diff = targetTimestamp - serverTime;
      setRemaining(Math.max(0, diff));
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [targetTimestamp, getServerTime]);

  return remaining;
};

const useAudioPlayback = (audioUrl) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const audioContextRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceRef = useRef(null);

  // Initialize AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Load audio
  useEffect(() => {
    if (!audioUrl) return;

    const loadAudio = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        audioBufferRef.current = buffer;
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load audio:', error);
      }
    };

    loadAudio();
  }, [audioUrl]);

  // Unlock audio (must be called from user interaction)
  const unlockAudio = useCallback(async () => {
    if (!audioContextRef.current) return false;
    
    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setIsUnlocked(true);
      return true;
    } catch (error) {
      console.error('Failed to unlock audio:', error);
      return false;
    }
  }, []);

  // Schedule playback at specific timestamp
  const schedulePlayback = useCallback((startTimestamp, getServerTime) => {
    if (!audioBufferRef.current || !audioContextRef.current) {
      console.warn('Audio not ready');
      return false;
    }

    if (audioContextRef.current.state === 'suspended') {
      console.warn('AudioContext suspended, need user interaction');
      return false;
    }

    const serverTime = getServerTime();
    const delayMs = startTimestamp - serverTime;

    if (delayMs < -1000) {
      console.warn('Start time already passed');
      return false;
    }

    // Cancel any existing playback
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(audioContextRef.current.destination);
    sourceRef.current = source;

    const delaySeconds = Math.max(0, delayMs / 1000);
    source.start(audioContextRef.current.currentTime + delaySeconds);

    // Track playing state
    setTimeout(() => setIsPlaying(true), Math.max(0, delayMs));
    source.onended = () => setIsPlaying(false);

    return true;
  }, []);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  return {
    isLoaded,
    isPlaying,
    isUnlocked,
    unlockAudio,
    schedulePlayback,
    stopPlayback
  };
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Animated breathing circle
const BreathingCircle = ({ isActive, phase }) => {
  return (
    <div className="breathing-container">
      <div className={`breathing-circle ${isActive ? 'active' : ''} ${phase}`}>
        <div className="breathing-inner">
          <div className="breathing-core" />
        </div>
      </div>
      <div className="breathing-rings">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`ring ring-${i + 1}`} />
        ))}
      </div>
    </div>
  );
};

// Online counter badge
const OnlineCounter = ({ count }) => (
  <div className="online-counter">
    <div className="online-dot" />
    <span>{count} {count === 1 ? 'человек' : 'человек'} онлайн</span>
  </div>
);

// Countdown timer display
const CountdownTimer = ({ remainingMs, label }) => (
  <div className="countdown-timer">
    <div className="countdown-label">{label}</div>
    <div className="countdown-time">{formatTimeRemaining(remainingMs)}</div>
  </div>
);

// Session status indicator
const SessionStatus = ({ isPlaying }) => (
  <div className={`session-status ${isPlaying ? 'playing' : 'waiting'}`}>
    <div className="status-indicator" />
    <span>{isPlaying ? 'Сессия идёт' : 'Ожидание'}</span>
  </div>
);

// Ready button for custom room
const ReadyButton = ({ isReady, onToggle, disabled }) => (
  <button 
    className={`ready-button ${isReady ? 'ready' : ''}`}
    onClick={onToggle}
    disabled={disabled}
  >
    {isReady ? '✓ Готов' : 'Готов'}
  </button>
);

// Preset selector for custom room
const PresetSelector = ({ selected, onChange, disabled }) => (
  <div className="preset-selector">
    <label>Выберите пресет:</label>
    <div className="preset-options">
      {PRESET_OPTIONS.map((preset) => (
        <button
          key={preset.id}
          className={`preset-option ${selected === preset.id ? 'selected' : ''}`}
          onClick={() => onChange(preset.id)}
          disabled={disabled}
        >
          {preset.label}
        </button>
      ))}
    </div>
  </div>
);

// Ready status for custom room
const ReadyStatus = ({ clients }) => {
  const clientList = Object.values(clients);
  const readyCount = clientList.filter(c => c.isReady).length;
  const totalCount = clientList.length;

  return (
    <div className="ready-status">
      <div className="ready-bar">
        <div 
          className="ready-fill" 
          style={{ width: `${totalCount > 0 ? (readyCount / totalCount) * 100 : 0}%` }} 
        />
      </div>
      <span>{readyCount} / {totalCount} готовы</span>
    </div>
  );
};

// Countdown overlay (3-2-1)
const CountdownOverlay = ({ seconds }) => {
  if (seconds <= 0 || seconds > 3) return null;

  return (
    <div className="countdown-overlay">
      <div className="countdown-number">{Math.ceil(seconds)}</div>
    </div>
  );
};

// Audio unlock modal
const AudioUnlockModal = ({ onUnlock }) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <div className="modal-icon">🔊</div>
      <h3>Включить звук</h3>
      <p>Нажмите кнопку, чтобы активировать аудио</p>
      <button className="unlock-button" onClick={onUnlock}>
        Включить звук
      </button>
    </div>
  </div>
);

// Room card for room list
const RoomCard = ({ roomId, config, onlineCount, onEnter }) => {
  const isCustom = config.type === 'ready';

  return (
    <div className={`room-card ${isCustom ? 'custom' : ''}`} onClick={onEnter}>
      <div className="room-card-header">
        <h3>{config.label}</h3>
        <OnlineCounter count={onlineCount} />
      </div>
      <div className="room-card-body">
        {isCustom ? (
          <p>Запуск по готовности всех участников</p>
        ) : (
          <p>Автозапуск каждые 30 минут</p>
        )}
      </div>
      <div className="room-card-footer">
        <span className="enter-hint">Нажмите, чтобы войти →</span>
      </div>
    </div>
  );
};

// ============================================================================
// PAGE COMPONENTS
// ============================================================================

// Room List Page
const RoomListPage = ({ onEnterRoom }) => {
  const [roomCounts, setRoomCounts] = useState({});

  useEffect(() => {
    const unsubscribes = Object.keys(ROOMS_CONFIG).map((roomId) => {
      return firebase.onValue(
        firebase.ref(`rooms/${roomId}/online`),
        (snap) => {
          const data = snap.val() || {};
          setRoomCounts(prev => ({
            ...prev,
            [roomId]: Object.keys(data).length
          }));
        }
      );
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  return (
    <div className="room-list-page">
      <header className="page-header">
        <h1>Wim Hof Breathing</h1>
        <p className="subtitle">Совместное дыхание в реальном времени</p>
      </header>

      <div className="rooms-grid">
        {Object.entries(ROOMS_CONFIG).map(([roomId, config]) => (
          <RoomCard
            key={roomId}
            roomId={roomId}
            config={config}
            onlineCount={roomCounts[roomId] || 0}
            onEnter={() => onEnterRoom(roomId)}
          />
        ))}
      </div>

      <footer className="page-footer">
        <p>Метод Вима Хофа • Синхронное дыхание</p>
      </footer>
    </div>
  );
};

// Auto Room Page
const AutoRoomPage = ({ roomId, onBack }) => {
  const clientId = useClientId();
  const { getServerTime } = useServerTime();
  const { onlineCount } = usePresence(roomId, clientId);
  const config = ROOMS_CONFIG[roomId];
  const audioUrl = AUDIO_URLS[roomId];

  const { 
    isLoaded, 
    isPlaying, 
    isUnlocked, 
    unlockAudio, 
    schedulePlayback 
  } = useAudioPlayback(audioUrl);

  const [nextSlot, setNextSlot] = useState(null);
  const [scheduledSlot, setScheduledSlot] = useState(null);
  const remaining = useCountdown(nextSlot, getServerTime);

  // Calculate next slot
  useEffect(() => {
    const updateSlot = () => {
      const serverTime = getServerTime();
      const next = getNextSlotTimestamp(serverTime);
      setNextSlot(next);
    };

    updateSlot();
    const interval = setInterval(updateSlot, 1000);
    return () => clearInterval(interval);
  }, [getServerTime]);

  // Schedule audio playback
  useEffect(() => {
    if (!isLoaded || !isUnlocked || !nextSlot) return;
    if (scheduledSlot === nextSlot) return;

    const serverTime = getServerTime();
    const timeUntilStart = nextSlot - serverTime;

    // Schedule if within 30 seconds of start
    if (timeUntilStart > 0 && timeUntilStart < 30000) {
      const success = schedulePlayback(nextSlot, getServerTime);
      if (success) {
        setScheduledSlot(nextSlot);
      }
    }
  }, [isLoaded, isUnlocked, nextSlot, scheduledSlot, getServerTime, schedulePlayback]);

  // Handle audio unlock
  const handleUnlock = async () => {
    await unlockAudio();
  };

  return (
    <div className="room-page auto-room">
      {!isUnlocked && <AudioUnlockModal onUnlock={handleUnlock} />}

      <header className="room-header">
        <button className="back-button" onClick={onBack}>← Назад</button>
        <h2>{config.label}</h2>
        <OnlineCounter count={onlineCount} />
      </header>

      <main className="room-content">
        <BreathingCircle isActive={isPlaying} phase={isPlaying ? 'inhale' : 'rest'} />
        
        <div className="room-info">
          <SessionStatus isPlaying={isPlaying} />
          
          {!isPlaying && (
            <CountdownTimer 
              remainingMs={remaining} 
              label="До следующей сессии" 
            />
          )}

          {isPlaying && (
            <div className="playing-message">
              <p>Дышите вместе с группой</p>
            </div>
          )}
        </div>

        <div className="room-meta">
          {!isLoaded && <p className="loading-audio">Загрузка аудио...</p>}
          {isLoaded && !isUnlocked && <p className="unlock-hint">Нажмите на модальное окно, чтобы включить звук</p>}
        </div>
      </main>
    </div>
  );
};

// Custom Ready Room Page
const CustomReadyRoomPage = ({ onBack }) => {
  const roomId = 'custom_ready';
  const clientId = useClientId();
  const { getServerTime } = useServerTime();
  const roomState = useRoomState(roomId);
  
  const [isReady, setIsReady] = useState(false);
  
  const { onlineCount, clients } = usePresence(roomId, clientId, { isReady });

  const selectedPreset = roomState?.selectedPreset || 'ru_4rounds';
  const status = roomState?.status || 'idle';
  const startTimestamp = roomState?.startTimestamp;

  const audioUrl = AUDIO_URLS[selectedPreset];
  const { 
    isLoaded, 
    isPlaying, 
    isUnlocked, 
    unlockAudio, 
    schedulePlayback 
  } = useAudioPlayback(audioUrl);

  const countdownRemaining = useCountdown(startTimestamp, getServerTime);
  const countdownSeconds = countdownRemaining / 1000;

  // Update isReady in Firebase when local state changes
  useEffect(() => {
    if (!clientId) return;
    const myRef = firebase.ref(`rooms/${roomId}/online/${clientId}`);
    firebase.update(myRef, { isReady });
  }, [isReady, clientId]);

  // Check if all are ready and trigger countdown
  useEffect(() => {
    if (status !== 'idle') return;
    
    const clientList = Object.values(clients);
    if (clientList.length === 0) return;
    
    const allReady = clientList.every(c => c.isReady);
    if (!allReady) return;

    // Start countdown
    const roomRef = firebase.ref(`rooms/${roomId}`);
    const startTime = getServerTime() + 3000;
    firebase.update(roomRef, {
      status: 'countdown',
      startTimestamp: startTime
    });
  }, [clients, status, getServerTime]);

  // Schedule playback when countdown starts
  useEffect(() => {
    if (status !== 'countdown' || !startTimestamp || !isLoaded || !isUnlocked) return;
    
    schedulePlayback(startTimestamp, getServerTime);
    
    // Update status to playing when countdown ends
    const timeUntilStart = startTimestamp - getServerTime();
    if (timeUntilStart > 0) {
      setTimeout(() => {
        firebase.update(firebase.ref(`rooms/${roomId}`), { status: 'playing' });
      }, timeUntilStart);
    }
  }, [status, startTimestamp, isLoaded, isUnlocked, getServerTime, schedulePlayback]);

  // Reset room after playback ends
  useEffect(() => {
    if (!isPlaying && status === 'playing') {
      // Reset room state
      firebase.update(firebase.ref(`rooms/${roomId}`), {
        status: 'idle',
        startTimestamp: null
      });
      
      // Reset all isReady flags
      Object.keys(clients).forEach(cid => {
        firebase.update(firebase.ref(`rooms/${roomId}/online/${cid}`), { isReady: false });
      });
      
      setIsReady(false);
    }
  }, [isPlaying, status, clients]);

  // Handle preset change
  const handlePresetChange = (preset) => {
    if (status !== 'idle') return;
    firebase.update(firebase.ref(`rooms/${roomId}`), { selectedPreset: preset });
  };

  // Handle ready toggle
  const handleReadyToggle = () => {
    setIsReady(!isReady);
  };

  const handleUnlock = async () => {
    await unlockAudio();
  };

  const canChangePreset = status === 'idle';
  const canToggleReady = status === 'idle' && isUnlocked;

  return (
    <div className="room-page custom-room">
      {!isUnlocked && <AudioUnlockModal onUnlock={handleUnlock} />}
      
      {status === 'countdown' && countdownSeconds <= 3 && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}

      <header className="room-header">
        <button className="back-button" onClick={onBack}>← Назад</button>
        <h2>Custom Room</h2>
        <OnlineCounter count={onlineCount} />
      </header>

      <main className="room-content">
        <BreathingCircle isActive={isPlaying} phase={isPlaying ? 'inhale' : 'rest'} />
        
        <div className="room-info">
          <SessionStatus isPlaying={isPlaying} />
          
          <PresetSelector 
            selected={selectedPreset}
            onChange={handlePresetChange}
            disabled={!canChangePreset}
          />

          <ReadyStatus clients={clients} />

          <ReadyButton 
            isReady={isReady}
            onToggle={handleReadyToggle}
            disabled={!canToggleReady}
          />

          {status === 'countdown' && (
            <div className="countdown-message">
              <p>Запуск через {Math.ceil(countdownSeconds)}...</p>
            </div>
          )}

          {isPlaying && (
            <div className="playing-message">
              <p>Дышите вместе с группой</p>
            </div>
          )}
        </div>

        <div className="room-meta">
          {!isLoaded && <p className="loading-audio">Загрузка аудио...</p>}
        </div>
      </main>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const [currentRoom, setCurrentRoom] = useState(null);

  const handleEnterRoom = (roomId) => {
    setCurrentRoom(roomId);
  };

  const handleBack = () => {
    setCurrentRoom(null);
  };

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --bg-primary: #0a0a0f;
          --bg-secondary: #12121a;
          --bg-card: #1a1a24;
          --text-primary: #f0f0f5;
          --text-secondary: #8888aa;
          --accent-primary: #4ecdc4;
          --accent-secondary: #45b7aa;
          --accent-glow: rgba(78, 205, 196, 0.3);
          --accent-warm: #ff6b6b;
          --success: #4ecdc4;
          --warning: #ffe66d;
        }

        body {
          font-family: 'Space Grotesk', sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
        }

        .app {
          min-height: 100vh;
          background: 
            radial-gradient(ellipse at 20% 0%, rgba(78, 205, 196, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(78, 205, 196, 0.05) 0%, transparent 50%),
            var(--bg-primary);
        }

        /* Room List Page */
        .room-list-page {
          min-height: 100vh;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          text-align: center;
          padding: 3rem 0;
        }

        .page-header h1 {
          font-size: 3rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, var(--text-primary), var(--accent-primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
          font-weight: 300;
        }

        .rooms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          padding: 2rem 0;
        }

        .room-card {
          background: var(--bg-card);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .room-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .room-card:hover {
          transform: translateY(-4px);
          border-color: rgba(78, 205, 196, 0.3);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .room-card:hover::before {
          opacity: 1;
        }

        .room-card.custom {
          border-color: rgba(255, 107, 107, 0.2);
        }

        .room-card.custom::before {
          background: linear-gradient(90deg, var(--accent-warm), #ff8e8e);
        }

        .room-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .room-card-header h3 {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .room-card-body {
          margin-bottom: 1.5rem;
        }

        .room-card-body p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .room-card-footer {
          display: flex;
          justify-content: flex-end;
        }

        .enter-hint {
          color: var(--accent-primary);
          font-size: 0.85rem;
          font-weight: 500;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .room-card:hover .enter-hint {
          opacity: 1;
        }

        .page-footer {
          text-align: center;
          padding: 3rem 0;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        /* Online Counter */
        .online-counter {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .online-dot {
          width: 8px;
          height: 8px;
          background: var(--success);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        /* Room Page */
        .room-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .room-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 2rem;
          background: var(--bg-secondary);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .back-button {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1rem;
          cursor: pointer;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }

        .room-header h2 {
          font-size: 1.3rem;
          font-weight: 600;
        }

        .room-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          gap: 2rem;
        }

        /* Breathing Circle */
        .breathing-container {
          position: relative;
          width: 280px;
          height: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .breathing-circle {
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 4s ease-in-out;
          box-shadow: 0 0 60px var(--accent-glow);
        }

        .breathing-circle.active {
          animation: breathe 8s ease-in-out infinite;
        }

        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.3); }
          50% { transform: scale(1.3); }
          75% { transform: scale(1); }
        }

        .breathing-inner {
          width: 80%;
          height: 80%;
          border-radius: 50%;
          background: rgba(10, 10, 15, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .breathing-core {
          width: 60%;
          height: 60%;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          opacity: 0.8;
        }

        .breathing-rings {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid var(--accent-primary);
          opacity: 0.2;
          animation: ring-expand 4s ease-out infinite;
        }

        .ring-1 { animation-delay: 0s; }
        .ring-2 { animation-delay: 1.3s; }
        .ring-3 { animation-delay: 2.6s; }

        @keyframes ring-expand {
          0% { transform: scale(0.5); opacity: 0.4; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        /* Room Info */
        .room-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          width: 100%;
          max-width: 400px;
        }

        /* Session Status */
        .session-status {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.5rem;
          background: var(--bg-card);
          border-radius: 100px;
          font-size: 0.95rem;
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--text-secondary);
        }

        .session-status.playing .status-indicator {
          background: var(--success);
          animation: pulse 1s infinite;
        }

        /* Countdown Timer */
        .countdown-timer {
          text-align: center;
        }

        .countdown-label {
          color: var(--text-secondary);
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }

        .countdown-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 3rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          color: var(--text-primary);
        }

        /* Preset Selector */
        .preset-selector {
          width: 100%;
        }

        .preset-selector label {
          display: block;
          color: var(--text-secondary);
          font-size: 0.85rem;
          margin-bottom: 0.75rem;
        }

        .preset-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .preset-option {
          background: var(--bg-card);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 0.75rem;
          color: var(--text-secondary);
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .preset-option:hover:not(:disabled) {
          border-color: rgba(78, 205, 196, 0.3);
          color: var(--text-primary);
        }

        .preset-option.selected {
          background: rgba(78, 205, 196, 0.15);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }

        .preset-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Ready Status */
        .ready-status {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .ready-bar {
          width: 100%;
          height: 8px;
          background: var(--bg-card);
          border-radius: 100px;
          overflow: hidden;
        }

        .ready-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
          border-radius: 100px;
          transition: width 0.3s ease;
        }

        .ready-status span {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        /* Ready Button */
        .ready-button {
          background: var(--bg-card);
          border: 2px solid var(--accent-primary);
          border-radius: 12px;
          padding: 1rem 3rem;
          color: var(--accent-primary);
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: inherit;
        }

        .ready-button:hover:not(:disabled) {
          background: rgba(78, 205, 196, 0.1);
          transform: translateY(-2px);
        }

        .ready-button.ready {
          background: var(--accent-primary);
          color: var(--bg-primary);
        }

        .ready-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Countdown Overlay */
        .countdown-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 10, 15, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .countdown-number {
          font-size: 15rem;
          font-weight: 700;
          color: var(--accent-primary);
          text-shadow: 0 0 100px var(--accent-glow);
          animation: countdown-pop 1s ease-out;
        }

        @keyframes countdown-pop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 10, 15, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 2rem;
        }

        .modal-content {
          background: var(--bg-card);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 3rem;
          text-align: center;
          max-width: 400px;
        }

        .modal-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .modal-content h3 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .modal-content p {
          color: var(--text-secondary);
          margin-bottom: 2rem;
        }

        .unlock-button {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          border: none;
          border-radius: 12px;
          padding: 1rem 2.5rem;
          color: var(--bg-primary);
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: inherit;
        }

        .unlock-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px var(--accent-glow);
        }

        /* Messages */
        .playing-message, .countdown-message {
          text-align: center;
          padding: 1rem;
        }

        .playing-message p, .countdown-message p {
          color: var(--accent-primary);
          font-size: 1.1rem;
        }

        .loading-audio, .unlock-hint {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .page-header h1 {
            font-size: 2rem;
          }

          .rooms-grid {
            grid-template-columns: 1fr;
          }

          .countdown-time {
            font-size: 2.5rem;
          }

          .breathing-container {
            width: 220px;
            height: 220px;
          }

          .breathing-circle {
            width: 120px;
            height: 120px;
          }

          .countdown-number {
            font-size: 10rem;
          }
        }
      `}</style>

      {currentRoom === null ? (
        <RoomListPage onEnterRoom={handleEnterRoom} />
      ) : currentRoom === 'custom_ready' ? (
        <CustomReadyRoomPage onBack={handleBack} />
      ) : (
        <AutoRoomPage roomId={currentRoom} onBack={handleBack} />
      )}
    </div>
  );
}
