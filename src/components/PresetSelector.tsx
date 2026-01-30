// src/components/PresetSelector.tsx
import { useAppContext } from "../context/AppContext";
import {
  useOfflinePresets,
  useContentIndex,
  useBulkPresetMetadata,
} from "../hooks";

interface PresetSelectorProps {
  selected: string | null;
  onChange: (preset: string) => void;
  disabled: boolean;
}

export function PresetSelector({
  selected,
  onChange,
  disabled,
}: PresetSelectorProps) {
  const { language } = useAppContext();
  const { isPresetCached } = useOfflinePresets();
  const { soloPresets, isLoading: isLoadingIndex, error: indexError } = useContentIndex();
  const { presets, isLoading: isLoadingMetadata, error: metadataError } = useBulkPresetMetadata(soloPresets);

  // Group presets by language (en first, then ru)
  const enPresets = presets.filter((p) => p.lang.startsWith("EN"));
  const ruPresets = presets.filter((p) => !p.lang.startsWith("EN"));
  const sortedPresets = [...enPresets, ...ruPresets];

  const isLoading = isLoadingIndex || isLoadingMetadata;
  const error = indexError || metadataError;

  const texts = language === "en"
    ? {
        error: "Failed to load presets",
        retry: "Retry",
        empty: "No presets available",
      }
    : {
        error: "Не удалось загрузить пресеты",
        retry: "Повторить",
        empty: "Нет доступных пресетов",
      };

  if (isLoading) {
    return <div className="loading">...</div>;
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{texts.error}</p>
        <button
          className="btn btn--primary"
          onClick={() => window.location.reload()}
        >
          {texts.retry}
        </button>
      </div>
    );
  }

  if (sortedPresets.length === 0) {
    return (
      <div className="empty-state">
        <p>{texts.empty}</p>
      </div>
    );
  }

  return (
    <div
      className="preset-grid"
      role="group"
      aria-label={language === "en" ? "Select preset" : "Выберите пресет"}
    >
      {sortedPresets.map((preset) => {
        const isSelected = selected === preset.id;
        const displayTitle = language === "ru" ? preset.titleRu || preset.title : preset.title;
        const isCached = isPresetCached(preset.id);

        return (
          <button
            key={preset.id}
            className={`card ${isSelected ? "selected" : ""}`}
            onClick={() => onChange(preset.id)}
            disabled={disabled}
            type="button"
            aria-pressed={isSelected}
          >
            <span className="preset-lang">{preset.lang}</span>
            <h3 className="card-title">{displayTitle}</h3>
            {isCached && (
              <span
                className="preset-offline-badge"
                title={language === "ru" ? "Доступен офлайн" : "Available offline"}
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
  );
}
