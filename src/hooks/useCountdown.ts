// src/hooks/useCountdown.ts
// ============================================================================
// useCountdown - Countdown timer to target timestamp
// ============================================================================

import { useState, useEffect } from 'react';

/**
 * Hook to count down to a target timestamp using server time
 * Returns remaining milliseconds, updating every 100ms
 */
export function useCountdown(
  targetTimestamp: number | null,
  getServerTime: () => number
): number {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!targetTimestamp) {
      setRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const serverTime = getServerTime();
      const diff = targetTimestamp - serverTime;
      setRemaining(Math.max(0, diff));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 100);

    return () => clearInterval(interval);
  }, [targetTimestamp, getServerTime]);

  return remaining;
}

/**
 * Hook to calculate the next session slot (every 30 minutes)
 * Returns the timestamp of the next slot
 */
export function useNextSlot(getServerTime: () => number): number | null {
  const [nextSlot, setNextSlot] = useState<number | null>(null);

  // 30 minutes in milliseconds
  const SLOT_INTERVAL_MS = 30 * 60 * 1000;
  // Window for considering current slot as "starting now"
  const SLOT_WINDOW_MS = 5000;

  useEffect(() => {
    const calculateNextSlot = () => {
      const serverTime = getServerTime();
      const currentSlot = Math.floor(serverTime / SLOT_INTERVAL_MS) * SLOT_INTERVAL_MS;
      const timeInSlot = serverTime - currentSlot;

      // If within first 5 seconds, this is the current session starting
      if (timeInSlot < SLOT_WINDOW_MS) {
        setNextSlot(currentSlot);
      } else {
        setNextSlot(currentSlot + SLOT_INTERVAL_MS);
      }
    };

    calculateNextSlot();
    const interval = setInterval(calculateNextSlot, 1000);

    return () => clearInterval(interval);
  }, [getServerTime]);

  return nextSlot;
}
