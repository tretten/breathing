// src/components/BreathingCircle.tsx
import { useEffect, useRef, useState } from 'react';
import '../styles/breathing-circle.css';

interface BreathingCircleProps {
  isActive: boolean;
  getAudioLevel?: () => number;
}

export function BreathingCircle({ isActive, getAudioLevel }: BreathingCircleProps) {
  const [scale, setScale] = useState(1);
  const [glowIntensity, setGlowIntensity] = useState(60);
  const frameRef = useRef<number>(0);
  const smoothedLevelRef = useRef(0);

  // Animate based on audio level when active
  useEffect(() => {
    if (!isActive || !getAudioLevel) {
      // Reset to default when not active
      setScale(1);
      setGlowIntensity(60);
      return;
    }

    const animate = () => {
      const rawLevel = getAudioLevel();

      // Faster smoothing for more responsive animation
      smoothedLevelRef.current += (rawLevel - smoothedLevelRef.current) * 0.25;
      const level = smoothedLevelRef.current;

      // Apply curve for more dramatic effect at higher levels
      const boostedLevel = Math.pow(level, 0.7) * 1.5;

      // Scale: 1.0 to 1.8 based on audio level
      const newScale = 1 + Math.min(boostedLevel, 1) * 0.8;
      setScale(newScale);

      // Glow: 40px to 150px based on audio level
      const newGlow = 40 + Math.min(boostedLevel, 1) * 110;
      setGlowIntensity(newGlow);

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [isActive, getAudioLevel]);

  // Determine CSS class based on state
  // When not active: no special class (static dimmed appearance)
  // When active with audio: reactive (JS-controlled)
  // When active without audio: active (CSS animation fallback)
  const circleClass = isActive
    ? (getAudioLevel ? 'breathing-circle reactive' : 'breathing-circle active')
    : 'breathing-circle';

  // Inline styles for reactive mode
  const reactiveStyle = isActive && getAudioLevel ? {
    transform: `scale(${scale})`,
    boxShadow: `0 0 ${glowIntensity}px var(--accent-glow)`
  } : undefined;

  return (
    <div className="breathing-container">
      <div className={circleClass} style={reactiveStyle}>
        <div className="breathing-inner">
          <div className="breathing-core" />
        </div>
      </div>
      <div className="breathing-rings">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`ring ring-${i + 1} ${isActive ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
