// src/pages/SoloLobbyPage.tsx
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  useOfflinePresets,
  useContentIndex,
  useBulkPresetMetadata,
} from "../hooks";
import { TopBar } from "../components/TopBar";
import { PageFooter } from "../components/PageFooter";
import { MeditationIcon } from "../components/Icons";

export function SoloLobbyPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();
  const { isPresetCached } = useOfflinePresets();
  const {
    soloPresets,
    isLoading: isLoadingIndex,
    error: indexError,
  } = useContentIndex();
  const {
    presets,
    isLoading: isLoadingMetadata,
    error: metadataError,
  } = useBulkPresetMetadata(soloPresets);

  const handleSelectPreset = (presetId: string) => {
    navigate(`/solo/${presetId}`);
  };

  const handleBack = () => {
    navigate("/");
  };

  const texts =
    language === "en"
      ? {
          title: "Solo",
          subtitle: "Choose preset",
          loading: "Loading...",
          error: "Failed to load presets",
          retry: "Retry",
          empty: "No presets available",
        }
      : {
          title: "Соло",
          subtitle: "Выбери пресет",
          loading: "Загрузка...",
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
    <div className="wrap">
      <TopBar showBack onBack={handleBack} />

      <main className="main">
        <div className="center">
          <header className="hdr">
            <MeditationIcon className="ico" />
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
                const displayTitle =
                  language === "ru"
                    ? preset.titleRu || preset.title
                    : preset.title;
                const isCached = isPresetCached(preset.id);

                return (
                  <button
                    key={preset.id}
                    className="card"
                    onClick={() => handleSelectPreset(preset.id)}
                  >
                    <span className="lang">{preset.lang}</span>
                    <h3 className="card-ttl">{displayTitle}</h3>
                    {isCached && (
                      <span
                        className="offline"
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
