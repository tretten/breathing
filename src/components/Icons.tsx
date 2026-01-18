// src/components/Icons.tsx
// SVG icons with stroke-based design, using currentColor for flexibility

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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Central breath flow */}
      <path d="M12 2v3" />
      <path d="M12 6v2" opacity="0.7" />

      {/* Lungs */}
      <path d="M12 8c-2.5 0-4.5 1.5-4.5 4v3c0 2.5 1.5 4.5 4.5 4.5" />
      <path d="M12 8c2.5 0 4.5 1.5 4.5 4v3c0 2.5-1.5 4.5-4.5 4.5" />

      {/* Inner lung detail */}
      <path d="M9 13c-1 0-1.5 0.5-1.5 1s0.5 1 1.5 1" opacity="0.6" />
      <path d="M15 13c1 0 1.5 0.5 1.5 1s-0.5 1-1.5 1" opacity="0.6" />

      {/* Air waves - left side */}
      <path d="M3 8c1.5-1 3-1 4.5 0" opacity="0.5" />
      <path d="M2 11c1 0 2 0.5 3 0" opacity="0.4" />
      <path d="M3 14c1 0.5 2 0.5 3 0" opacity="0.3" />

      {/* Air waves - right side */}
      <path d="M16.5 8c1.5-1 3-1 4.5 0" opacity="0.5" />
      <path d="M19 11c1 0 2 0.5 3 0" opacity="0.4" />
      <path d="M18 14c1 0.5 2 0.5 3 0" opacity="0.3" />

      {/* Top breath indicators */}
      <path d="M9 4c0.5-0.5 1-0.5 1.5 0" opacity="0.4" />
      <path d="M13.5 4c0.5-0.5 1-0.5 1.5 0" opacity="0.4" />
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Head */}
      <circle cx="12" cy="5" r="2.5" />
      {/* Body */}
      <path d="M12 8v4" />
      {/* Arms in meditation pose */}
      <path d="M7 12c0 0 2 1 5 1s5-1 5-1" />
      <path d="M7 12c-1 1-1.5 2-1.5 3" />
      <path d="M17 12c1 1 1.5 2 1.5 3" />
      {/* Legs crossed */}
      <path d="M6 20c1-3 3-4 6-4s5 1 6 4" />
      <path d="M7 22h10" />
      {/* Breathing waves */}
      <path d="M3 6c1-0.5 2-0.5 3 0" opacity="0.5" />
      <path d="M18 6c1-0.5 2-0.5 3 0" opacity="0.5" />
      <path d="M2 9c1 0 1.5 0.5 2.5 0" opacity="0.4" />
      <path d="M19.5 9c1 0 1.5 0.5 2.5 0" opacity="0.4" />
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Left person */}
      <circle cx="4" cy="5" r="2" />
      <path d="M2 14c0-2 1-3 2-3s2 1 2 3" />

      {/* Center person */}
      <circle cx="12" cy="5" r="2" />
      <path d="M10 14c0-2 1-3 2-3s2 1 2 3" />

      {/* Right person */}
      <circle cx="20" cy="5" r="2" />
      <path d="M18 14c0-2 1-3 2-3s2 1 2 3" />

      {/* Breathing waves between left and center */}
      <path d="M6.5 9c1 0.5 2 0.5 3 0" opacity="0.5" />
      <path d="M7 11c0.8 0 1.5 0.5 2.5 0" opacity="0.4" />

      {/* Breathing waves between center and right */}
      <path d="M14.5 9c1 0.5 2 0.5 3 0" opacity="0.5" />
      <path d="M15 11c0.8 0 1.5 0.5 2.5 0" opacity="0.4" />

      {/* Connection line */}
      <path d="M4 17h16" opacity="0.3" />

      {/* Ground dots */}
      <circle cx="4" cy="20" r="0.5" fill="currentColor" opacity="0.4" />
      <circle cx="12" cy="20" r="0.5" fill="currentColor" opacity="0.4" />
      <circle cx="20" cy="20" r="0.5" fill="currentColor" opacity="0.4" />
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
        fontSize="12"
        fontWeight="600"
        fontFamily="inherit"
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
        fontSize="12"
        fontWeight="600"
        fontFamily="inherit"
      >
        EN
      </text>
    </svg>
  );
}
