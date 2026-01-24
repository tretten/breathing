// src/pages/TogetherLobbyPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { useAppContext } from "../context/AppContext";
import { TopBar } from "../components/TopBar";
import { PageFooter } from "../components/PageFooter";
import { FriendsIcon } from "../components/Icons";
import {
  PRESET_IDS,
  type PresetId,
  type TogetherRoomState,
  type ClientPresence,
} from "../types";
import { AUDIO_URLS } from "../utils/constants";
import { getCueUrlFromAudioUrl } from "../utils/phaseCues";

interface PresetInfo {
  presetId: PresetId;
  lang: string;
  title: string;
  titleRu: string;
  onlineCount: number;
  isLive: boolean;
}

export function TogetherLobbyPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch preset titles from JSON files
  useEffect(() => {
    const fetchTitles = async () => {
      const infos: PresetInfo[] = [];

      for (const presetId of PRESET_IDS) {
        const audioUrl = AUDIO_URLS[presetId];
        const jsonUrl = getCueUrlFromAudioUrl(audioUrl);

        try {
          const response = await fetch(jsonUrl);
          const data = await response.json();
          infos.push({
            presetId,
            lang: data.lang || (presetId.startsWith("en_") ? "EN" : "RU"),
            title: data.title || presetId,
            titleRu: data.titleRu || data.title || presetId,
            onlineCount: 0,
            isLive: false,
          });
        } catch {
          infos.push({
            presetId,
            lang: presetId.startsWith("en_") ? "EN" : "RU",
            title: presetId,
            titleRu: presetId,
            onlineCount: 0,
            isLive: false,
          });
        }
      }

      setPresets(infos);
      setLoading(false);
    };

    fetchTitles();
  }, []);

  // Subscribe to all together rooms for live counts
  useEffect(() => {
    if (presets.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    for (const presetId of PRESET_IDS) {
      const roomRef = ref(db, `rooms/together/${presetId}`);

      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val() as TogetherRoomState | null;
        // Only count clients with voiceName (valid entries, not stale)
        const onlineCount = data?.online
          ? Object.values(data.online as Record<string, ClientPresence>).filter(
              (client) => client.voiceName,
            ).length
          : 0;
        const isLive =
          data?.status === "countdown" && data?.startTimestamp !== null;

        setPresets((prev) =>
          prev.map((p) =>
            p.presetId === presetId ? { ...p, onlineCount, isLive } : p,
          ),
        );
      });

      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [presets.length]);

  const handleSelectPreset = (presetId: PresetId) => {
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
          live: "Live",
        }
      : {
          title: "Вместе",
          subtitle: "Выбери пресет",
          live: "Live",
        };

  // Group presets by language (en first, then ru)
  const enPresets = presets.filter((p) => p.lang === "EN");
  const ruPresets = presets.filter((p) => p.lang !== "EN");
  const sortedPresets = [...enPresets, ...ruPresets];

  return (
    <div className="page-container">
      <TopBar showBack onBack={handleBack} />

      <main className="page-content">
        <div className="content-centered">
          <header className="page-header">
            <FriendsIcon className="page-icon" />
            <h1>{texts.title}</h1>
            <p className="subtitle">{texts.subtitle}</p>
          </header>

          {loading ? (
            <div className="loading">...</div>
          ) : (
            <div className="preset-grid">
              {sortedPresets.map((preset) => {
                const displayTitle =
                  language === "ru" ? preset.titleRu : preset.title;
                const hasActivity = preset.onlineCount > 0 || preset.isLive;

                return (
                  <button
                    key={preset.presetId}
                    className={`preset-card ${preset.isLive ? "is-live" : ""}`}
                    onClick={() => handleSelectPreset(preset.presetId)}
                  >
                    <span className="preset-lang">{preset.lang}</span>
                    <span className="preset-title">{displayTitle}</span>
                    {hasActivity && (
                      <span
                        className={`preset-badge ${preset.isLive ? "is-live" : ""}`}
                      >
                        {preset.isLive && <span className="live-dot" />}
                        {preset.isLive ? texts.live : preset.onlineCount}
                        {preset.isLive &&
                          preset.onlineCount > 0 &&
                          ` · ${preset.onlineCount}`}
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
