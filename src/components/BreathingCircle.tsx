// src/components/BreathingCircle.tsx
import { useEffect, useRef, type ReactNode } from "react";
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
  const circRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);

  // Animate using direct DOM manipulation to avoid 60fps re-renders
  useEffect(() => {
    if (!isActive) {
      // Reset to default when not active
      if (circRef.current) {
        circRef.current.style.transform = '';
        circRef.current.style.boxShadow = '';
      }
      if (coreRef.current) {
        coreRef.current.style.transform = '';
        coreRef.current.style.boxShadow = '';
      }
      return;
    }

    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;

      let scale: number;
      let glowIntensity: number;
      let coreScale: number;

      // Different animation based on phase
      if (phase === "breathe") {
        // Active breathing - smooth inhale/exhale cycle (~4 seconds)
        const breathCycle = Math.sin(elapsed * Math.PI / 2) * 0.5 + 0.5;
        const microVariation = Math.sin(elapsed * 5) * 0.05;
        const level = breathCycle + microVariation;

        scale = 1 + level * 0.5;
        glowIntensity = 50 + level * 70;
        coreScale = 1 + level * 0.2;
      } else if (phase === "hold") {
        // Holding breath - calm, slightly contracted, minimal movement
        const subtleWave = Math.sin(elapsed * 0.8) * 0.05;

        scale = 0.9 + subtleWave;
        glowIntensity = 40 + subtleWave * 20;
        coreScale = 0.95 + subtleWave * 0.1;
      } else if (phase === "pause") {
        // Pause between actions - neutral state
        const gentleWave = Math.sin(elapsed * 1.2) * 0.08;

        scale = 1 + gentleWave;
        glowIntensity = 55 + gentleWave * 15;
        coreScale = 1 + gentleWave * 0.1;
      } else {
        // Intro/outro or unknown - gentle idle animation
        const idleWave = Math.sin(elapsed * 1) * 0.1;

        scale = 1 + idleWave;
        glowIntensity = 60 + idleWave * 20;
        coreScale = 1 + idleWave * 0.15;
      }

      if (circRef.current) {
        circRef.current.style.transform = `scale(${scale})`;
        circRef.current.style.boxShadow = `0 0 ${glowIntensity}px var(--circle-glow, var(--accent-glow))`;
      }

      if (coreRef.current) {
        coreRef.current.style.transform = `scale(${coreScale})`;
        coreRef.current.style.boxShadow = `0 0 ${20 + (coreScale - 1) * 50}px var(--circle-glow, var(--accent-glow))`;
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
    const classes = ["breath-circ"];

    if (isActive) {
      classes.push("reactive");
    }

    if (phase) {
      classes.push(`phase-${phase}`);
    }

    return classes.join(" ");
  };

  // Phase class for container (affects rings too)
  const containerClass = phase
    ? `breath phase-${phase}`
    : "breath";

  return (
    <div className={containerClass}>
      <div className={getCircleClass()} ref={circRef}>
        <div className="breath-in">
          <div className="breath-core" ref={coreRef} />
        </div>
      </div>
      <div className="rings">
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
