// src/pages/TogetherLobbyPage.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { useAppContext } from "../context/AppContext";
import {
  useOfflinePresets,
  useContentIndex,
  useBulkPresetMetadata,
} from "../hooks";
import { TopBar } from "../components/TopBar";
import { PageFooter } from "../components/PageFooter";
import { FriendsIcon } from "../components/Icons";
import { type TogetherRoomState, type ClientPresence } from "../types";
import { PRESENCE_MAX_AGE_MS } from "../utils/constants";

interface RoomActivityData {
  onlineCount: number;
  isLive: boolean;
}

export function TogetherLobbyPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();
  const { isPresetCached } = useOfflinePresets();
  const {
    togetherPresets,
    isLoading: isLoadingIndex,
    error: indexError,
  } = useContentIndex();
  const {
    presets,
    isLoading: isLoadingMetadata,
    error: metadataError,
  } = useBulkPresetMetadata(togetherPresets);

  // Track room activity in state instead of mutating presets
  const [roomActivity, setRoomActivity] = useState<Record<string, RoomActivityData>>({});

  // Memoize preset IDs for stable dependency
  const presetIds = useMemo(() => presets.map(p => p.id), [presets]);

  // Subscribe to all together rooms for live counts
  useEffect(() => {
    if (presetIds.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    for (const presetId of presetIds) {
      const roomRef = ref(db, `rooms/together/${presetId}`);

      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val() as TogetherRoomState | null;
        // Only count active clients (with voiceName and not stale)
        const now = Date.now();
        const onlineCount = data?.online
          ? Object.values(
              data.online as Record<string, ClientPresence>,
            ).filter(
              (client) =>
                client.voiceName &&
                client.joinedAt &&
                now - client.joinedAt <= PRESENCE_MAX_AGE_MS,
            ).length
          : 0;
        const isLive =
          data?.status === "countdown" && data?.startTimestamp !== null;

        // Update state immutably
        setRoomActivity(prev => ({
          ...prev,
          [presetId]: { onlineCount, isLive }
        }));
      });

      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [presetIds]);

  const handleSelectPreset = (presetId: string) => {
    navigate(`/room/${presetId}`);
  };

  const handleBack = () => {
    navigate("/");
  };

  const texts =
    language === "en"
      ? {
          title: "Together",
          subtitle: "Choose preset",
          loading: "Loading...",
          live: "Live",
          error: "Failed to load presets",
          retry: "Retry",
          empty: "No presets available",
        }
      : {
          title: "Вместе",
          subtitle: "Выбери пресет",
          loading: "Загрузка...",
          live: "Live",
          error: "Не удалось загрузить пресеты",
          retry: "Повторить",
          empty: "Нет доступных пресетов",
        };

  // Group presets by language (en first, then ru)
  const enPresets = presets.filter((p) => p.lang.startsWith("EN"));
  const ruPresets = presets.filter((p) => !p.lang.startsWith("EN"));
  const sortedPresets = [...enPresets, ...ruPresets];

  const isLoading = isLoadingIndex || isLoadingMetadata;
  const error = indexError || metadataError;

  return (
    <div className="app-container">
      <TopBar showBack onBack={handleBack} />

      <main className="app-content">
        <div className="content-centered">
          <header className="app-header">
            <FriendsIcon className="app-icon" />
            <h1>{texts.title}</h1>
            <p className="subtitle">{texts.subtitle}</p>
          </header>

          {isLoading ? (
            <div className="loading">{texts.loading}</div>
          ) : error ? (
            <div className="error-state">
              <p>{texts.error}</p>
              <button
                className="btn btn--primary"
                onClick={() => window.location.reload()}
              >
                {texts.retry}
              </button>
            </div>
          ) : sortedPresets.length === 0 ? (
            <div className="empty-state">
              <p>{texts.empty}</p>
            </div>
          ) : (
            <div className="preset-grid">
              {sortedPresets.map((preset) => {
                const displayTitle =
                  language === "ru"
                    ? preset.titleRu || preset.title
                    : preset.title;
                const activity = roomActivity[preset.id];
                const onlineCount = activity?.onlineCount ?? 0;
                const isLive = activity?.isLive ?? false;
                const hasActivity = onlineCount > 0 || isLive;
                const isCached = isPresetCached(preset.id);

                return (
                  <button
                    key={preset.id}
                    className={`card ${isLive ? "is-live" : ""}`}
                    onClick={() => handleSelectPreset(preset.id)}
                  >
                    <span className="preset-lang">{preset.lang}</span>
                    <h3 className="card-title">{displayTitle}</h3>
                    {isCached && (
                      <span
                        className="preset-offline-badge"
                        title={
                          language === "ru"
                            ? "Доступен офлайн"
                            : "Available offline"
                        }
                      >
                        <svg
                          width="12"
                          height="12"
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
                    {hasActivity && (
                      <span
                        className={`card-badge ${isLive ? "is-live" : ""}`}
                      >
                        {isLive && <span className="live-dot" />}
                        {isLive ? texts.live : onlineCount}
                        {isLive && onlineCount > 0 && ` · ${onlineCount}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <PageFooter />
        </div>
      </main>
    </div>
  );
}
