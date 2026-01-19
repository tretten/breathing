// src/components/Icons.tsx
// Minimalist SVG icons - Endel-inspired clean geometric design

interface IconProps {
  className?: string;
  size?: number;
}

export function BreathingIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Concentric breathing circles */}
      <circle cx="12" cy="12" r="3" opacity="1" />
      <circle cx="12" cy="12" r="6" opacity="0.6" />
      <circle cx="12" cy="12" r="9" opacity="0.3" />
    </svg>
  );
}

export function MeditationIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Minimalist figure */}
      <circle cx="12" cy="6" r="2" />
      <path d="M12 8v4" />
      {/* Simplified lotus position */}
      <path d="M8 16c0-2 2-4 4-4s4 2 4 4" />
      <path d="M6 20c0-2 3-3 6-3s6 1 6 3" />
    </svg>
  );
}

export function FriendsIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Three connected circles */}
      <circle cx="12" cy="8" r="3" />
      <circle cx="5" cy="14" r="2.5" opacity="0.7" />
      <circle cx="19" cy="14" r="2.5" opacity="0.7" />
      {/* Connection lines */}
      <path d="M9.5 10L6.5 12" opacity="0.5" />
      <path d="M14.5 10L17.5 12" opacity="0.5" />
    </svg>
  );
}

export function LangRuIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
        fontWeight="500"
        fontFamily="inherit"
        letterSpacing="0.05em"
      >
        RU
      </text>
    </svg>
  );
}

export function LangEnIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
        fontWeight="500"
        fontFamily="inherit"
        letterSpacing="0.05em"
      >
        EN
      </text>
    </svg>
  );
}
