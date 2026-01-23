// src/components/BreathingCircle.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import "../styles/breathing-circle.css";
import type { PhaseType } from "../utils/phaseCues";

interface BreathingCircleProps {
  isActive: boolean;
  phase?: PhaseType | null;
  children?: ReactNode;
}

export function BreathingCircle({
  isActive,
  phase,
  children,
}: BreathingCircleProps) {
  const [scale, setScale] = useState(1);
  const [glowIntensity, setGlowIntensity] = useState(60);
  const [coreScale, setCoreScale] = useState(1);
  const frameRef = useRef<number>(0);

  // Animate based on phase - breathing phases get active pulsing, hold phases are calm
  useEffect(() => {
    if (!isActive) {
      // Reset to default when not active
      setScale(1);
      setGlowIntensity(60);
      setCoreScale(1);
      return;
    }

    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;

      // Different animation based on phase
      if (phase === "breathe") {
        // Active breathing - smooth inhale/exhale cycle (~4 seconds)
        // Sine wave for smooth breathing motion
        const breathCycle = Math.sin(elapsed * Math.PI / 2) * 0.5 + 0.5; // 0-1 over ~4s cycle
        const microVariation = Math.sin(elapsed * 5) * 0.05; // subtle fast variation

        const level = breathCycle + microVariation;

        // Scale: 1.0 to 1.5 during breathing
        const newScale = 1 + level * 0.5;
        setScale(newScale);

        // Glow: 50px to 120px
        const newGlow = 50 + level * 70;
        setGlowIntensity(newGlow);

        // Core pulses slightly
        const newCoreScale = 1 + level * 0.2;
        setCoreScale(newCoreScale);
      } else if (phase === "hold") {
        // Holding breath - calm, slightly contracted, minimal movement
        const subtleWave = Math.sin(elapsed * 0.8) * 0.05; // very slow, subtle

        setScale(0.9 + subtleWave);
        setGlowIntensity(40 + subtleWave * 20);
        setCoreScale(0.95 + subtleWave * 0.1);
      } else if (phase === "pause") {
        // Pause between actions - neutral state
        const gentleWave = Math.sin(elapsed * 1.2) * 0.08;

        setScale(1 + gentleWave);
        setGlowIntensity(55 + gentleWave * 15);
        setCoreScale(1 + gentleWave * 0.1);
      } else {
        // Intro/outro or unknown - gentle idle animation
        const idleWave = Math.sin(elapsed * 1) * 0.1;

        setScale(1 + idleWave);
        setGlowIntensity(60 + idleWave * 20);
        setCoreScale(1 + idleWave * 0.15);
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [isActive, phase]);

  // Determine CSS class based on state and phase
  const getCircleClass = () => {
    const classes = ["breathing-circle"];

    if (isActive) {
      classes.push("reactive");
    }

    if (phase) {
      classes.push(`phase-${phase}`);
    }

    return classes.join(" ");
  };

  // Inline styles for animated circle
  const reactiveStyle = isActive
    ? {
        transform: `scale(${scale})`,
        boxShadow: `0 0 ${glowIntensity}px var(--circle-glow, var(--accent-glow))`,
      }
    : undefined;

  // Core style for inner element
  const coreStyle = isActive
    ? {
        transform: `scale(${coreScale})`,
        boxShadow: `0 0 ${20 + (coreScale - 1) * 50}px var(--circle-glow, var(--accent-glow))`,
      }
    : undefined;

  // Phase class for container (affects rings too)
  const containerClass = phase
    ? `breathing-container phase-${phase}`
    : "breathing-container";

  return (
    <div className={containerClass}>
      <div className={getCircleClass()} style={reactiveStyle}>
        <div className="breathing-inner">
          <div className="breathing-core" style={coreStyle} />
        </div>
      </div>
      <div className="breathing-rings">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`ring ring-${i + 1} ${isActive ? "active" : ""}`}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
