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
import { PresetCard } from "../components/PresetCard";
import { splitPresetsByLang } from "../utils/helpers";

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
  const sortedPresets = splitPresetsByLang(presets);

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
              {sortedPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  lang={preset.lang}
                  isCached={isPresetCached(preset.id)}
                  onClick={() => handleSelectPreset(preset.id)}
                />
              ))}
            </div>
          )}

          <PageFooter />
        </div>
      </main>
    </div>
  );
}
