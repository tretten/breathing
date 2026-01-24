// src/components/PresetSelector.tsx
import { useAppContext } from "../context/AppContext";
import type { PresetId } from "../types";

interface PresetSelectorProps {
  selected: PresetId | null;
  onChange: (preset: PresetId) => void;
  disabled: boolean;
}

interface PresetInfo {
  id: PresetId;
  lang: "EN" | "RU";
  title: string;
  titleRu: string;
}

const PRESETS: PresetInfo[] = [
  { id: "en_3rounds", lang: "EN", title: "3 rounds", titleRu: "3 раунда" },
  { id: "en_4rounds", lang: "EN", title: "4 rounds", titleRu: "4 раунда" },
  { id: "ru_3rounds", lang: "RU", title: "3 rounds", titleRu: "3 раунда" },
  { id: "ru_4rounds", lang: "RU", title: "4 rounds", titleRu: "4 раунда" },
];

export function PresetSelector({
  selected,
  onChange,
  disabled,
}: PresetSelectorProps) {
  const { language } = useAppContext();

  return (
    <div
      className="preset-grid"
      role="group"
      aria-label={language === "en" ? "Select preset" : "Выберите пресет"}
    >
      {PRESETS.map((preset) => {
        const isSelected = selected === preset.id;
        const displayTitle = language === "ru" ? preset.titleRu : preset.title;

        return (
          <button
            key={preset.id}
            className={`preset-card ${isSelected ? "selected" : ""}`}
            onClick={() => onChange(preset.id)}
            disabled={disabled}
            type="button"
            aria-pressed={isSelected}
          >
            <span className="preset-lang">{preset.lang}</span>
            <span className="preset-title">{displayTitle}</span>
          </button>
        );
      })}
    </div>
  );
}
