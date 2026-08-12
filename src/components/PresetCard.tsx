// src/components/PresetCard.tsx
import type { ReactNode } from "react";
import { useAppContext } from "../context/AppContext";
import { OfflineIcon } from "./Icons";

interface PresetCardProps {
  preset: { title: string; titleRu?: string };
  lang: string;
  isCached: boolean;
  isLive?: boolean;
  badge?: ReactNode;
  onClick: () => void;
}

export function PresetCard({
  preset,
  lang,
  isCached,
  isLive,
  badge,
  onClick,
}: PresetCardProps) {
  const { language } = useAppContext();

  const displayTitle =
    language === "ru" ? preset.titleRu || preset.title : preset.title;

  return (
    <button
      type="button"
      className={`card ${isLive ? "is-live" : ""}`}
      onClick={onClick}
    >
      <span className="lang">{lang}</span>
      <span className="card-ttl">{displayTitle}</span>
      {isCached && (
        <span
          className="offline"
          title={language === "ru" ? "Доступен офлайн" : "Available offline"}
        >
          <OfflineIcon size={12} />
        </span>
      )}
      {badge}
    </button>
  );
}
