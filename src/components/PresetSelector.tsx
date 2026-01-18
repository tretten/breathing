// src/components/PresetSelector.tsx
import { useAppContext } from '../context/AppContext';
import { PRESET_OPTIONS } from '../utils/constants';
import type { PresetId } from '../types';

interface PresetSelectorProps {
  selected: PresetId | null;
  preselected?: PresetId | null;
  onChange: (preset: PresetId) => void;
  disabled: boolean;
}

export function PresetSelector({ selected, preselected, onChange, disabled }: PresetSelectorProps) {
  const { language } = useAppContext();

  const label = language === 'en' ? 'Select preset:' : 'Выберите пресет:';

  const groupLabel = language === 'en' ? 'Breathing presets' : 'Пресеты дыхания';

  const getClassName = (presetId: PresetId) => {
    if (selected === presetId) return 'preset-option selected';
    if (!selected && preselected === presetId) return 'preset-option preselected';
    return 'preset-option';
  };

  return (
    <div className="preset-selector">
      <span id="preset-label">{label}</span>
      <div className="preset-options" role="group" aria-labelledby="preset-label" aria-label={groupLabel}>
        {PRESET_OPTIONS.map((preset) => (
          <button
            key={preset.id}
            className={getClassName(preset.id)}
            onClick={() => onChange(preset.id)}
            disabled={disabled}
            type="button"
            aria-pressed={selected === preset.id}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
