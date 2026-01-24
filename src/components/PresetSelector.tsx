// src/components/PresetSelector.tsx
import { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { PRESET_IDS, type PresetId } from "../types";
import { AUDIO_URLS } from "../utils/constants";
import { getCueUrlFromAudioUrl } from "../utils/phaseCues";

interface PresetSelectorProps {
  selected: PresetId | null;
  onChange: (preset: PresetId) => void;
  disabled: boolean;
}

interface PresetInfo {
  id: PresetId;
  lang: string;
  title: string;
  titleRu: string;
}

export function PresetSelector({
  selected,
  onChange,
  disabled,
}: PresetSelectorProps) {
  const { language } = useAppContext();
  const [presets, setPresets] = useState<PresetInfo[]>([]);

  // Fetch preset info from JSON files
  useEffect(() => {
    const fetchPresets = async () => {
      const infos: PresetInfo[] = [];

      for (const presetId of PRESET_IDS) {
        const audioUrl = AUDIO_URLS[presetId];
        const jsonUrl = getCueUrlFromAudioUrl(audioUrl);

        try {
          const response = await fetch(jsonUrl);
          const data = await response.json();
          infos.push({
            id: presetId,
            lang: data.lang || (presetId.startsWith("en_") ? "EN" : "RU"),
            title: data.title || presetId,
            titleRu: data.titleRu || data.title || presetId,
          });
        } catch {
          infos.push({
            id: presetId,
            lang: presetId.startsWith("en_") ? "EN" : "RU",
            title: presetId,
            titleRu: presetId,
          });
        }
      }

      setPresets(infos);
    };

    fetchPresets();
  }, []);

  // Group presets by language (en first, then ru)
  const enPresets = presets.filter((p) => p.lang.startsWith("EN"));
  const ruPresets = presets.filter((p) => !p.lang.startsWith("EN"));
  const sortedPresets = [...enPresets, ...ruPresets];

  return (
    <div
      className="preset-grid"
      role="group"
      aria-label={language === "en" ? "Select preset" : "Выберите пресет"}
    >
      {sortedPresets.map((preset) => {
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
