// src/pages/TogetherLobbyPage.tsx
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  useOfflinePresets,
  useContentIndex,
  useBulkPresetMetadata,
  useTogetherActivity,
} from "../hooks";
import { TopBar } from "../components/TopBar";
import { PageFooter } from "../components/PageFooter";
import { FriendsIcon } from "../components/Icons";
import { PresetCard } from "../components/PresetCard";
import { splitPresetsByLang } from "../utils/helpers";

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
  const { activity } = useTogetherActivity(togetherPresets);

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
  const sortedPresets = splitPresetsByLang(presets);

  const isLoading = isLoadingIndex || isLoadingMetadata;
  const error = indexError || metadataError;

  return (
    <div className="wrap">
      <TopBar showBack onBack={handleBack} />

      <main className="main">
        <div className="center">
          <header className="hdr">
            <FriendsIcon className="ico" />
            <h1>{texts.title}</h1>
            <p className="subtitle">{texts.subtitle}</p>
          </header>

          {isLoading ? (
            <div className="loading">{texts.loading}</div>
          ) : error ? (
            <div className="err">
              <p>{texts.error}</p>
              <button
                className="btn btn--primary"
                onClick={() => window.location.reload()}
              >
                {texts.retry}
              </button>
            </div>
          ) : sortedPresets.length === 0 ? (
            <div className="empty">
              <p>{texts.empty}</p>
            </div>
          ) : (
            <div className="grid">
              {sortedPresets.map((preset) => {
                const roomActivity = activity[preset.id];
                const onlineCount = roomActivity?.onlineCount ?? 0;
                const isLive = roomActivity?.isLive ?? false;
                const hasActivity = onlineCount > 0 || isLive;

                return (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    lang={preset.lang}
                    isCached={isPresetCached(preset.id)}
                    isLive={isLive}
                    onClick={() => handleSelectPreset(preset.id)}
                    badge={
                      hasActivity && (
                        <span className={`badge ${isLive ? "is-live" : ""}`}>
                          {isLive && <span className="live-dot" />}
                          {isLive ? texts.live : onlineCount}
                          {isLive && onlineCount > 0 && ` · ${onlineCount}`}
                        </span>
                      )
                    }
                  />
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
