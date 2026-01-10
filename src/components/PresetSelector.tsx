// src/components/PresetSelector.tsx
import { useAppContext } from '../context/AppContext';
import { PRESET_OPTIONS } from '../utils/constants';
import type { PresetId } from '../types';

interface PresetSelectorProps {
  selected: PresetId | null;
  onChange: (preset: PresetId) => void;
  disabled: boolean;
}

export function PresetSelector({ selected, onChange, disabled }: PresetSelectorProps) {
  const { language } = useAppContext();

  const label = language === 'en' ? 'Select preset:' : 'Выберите пресет:';

  return (
    <div className="preset-selector">
      <label>{label}</label>
      <div className="preset-options">
        {PRESET_OPTIONS.map((preset) => (
          <button
            key={preset.id}
            className={`preset-option ${selected === preset.id ? 'selected' : ''}`}
            onClick={() => onChange(preset.id)}
            disabled={disabled}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
