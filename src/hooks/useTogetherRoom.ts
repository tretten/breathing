// src/hooks/useTogetherRoom.ts
// ============================================================================
// Together Room Hooks - State management and actions for Together rooms
// ============================================================================

import { useState, useEffect } from 'react';
import { ref, onValue, update, get } from 'firebase/database';
import { db } from '../firebase/config';
import { PRESENCE_MAX_AGE_MS } from '../utils/constants';
import type { TogetherRoomState, ClientPresence } from '../types';

// ============================================================================
// useTogetherRoomState - Subscribe to together room state by preset
// ============================================================================

/**
 * Hook to subscribe to a Together room's state in Firebase
 * Returns real-time room status, participants, and start timestamp
 */
export function useTogetherRoomState(presetId: string | null): TogetherRoomState | null {
  const [roomState, setRoomState] = useState<TogetherRoomState | null>(null);

  useEffect(() => {
    if (!presetId) return;

    const roomRef = ref(db, `rooms/together/${presetId}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomState({
          online: data.online || {},
          status: data.status || 'idle',
          startTimestamp: data.startTimestamp || null,
        });
      } else {
        // Room doesn't exist yet, return default state
        setRoomState({
          online: {},
          status: 'idle',
          startTimestamp: null,
        });
      }
    });

    return unsubscribe;
  }, [presetId]);

  return roomState;
}

// ============================================================================
// useTotalTogetherCount - Get total online count across all together rooms
// ============================================================================

/**
 * Hook to get the total number of users across all Together rooms
 * Useful for showing global activity on the home page
 * @param presetIds - List of preset IDs to monitor
 */
export function useTotalTogetherCount(presetIds: string[]): number {
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (presetIds.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    // Track counts per preset
    const counts: Record<string, number> = {};

    for (const presetId of presetIds) {
      const onlineRef = ref(db, `rooms/together/${presetId}/online`);

      const unsubscribe = onValue(onlineRef, (snapshot) => {
        const data = snapshot.val();
        const now = Date.now();
        // Only count active clients (with voiceName and not stale)
        const validCount = data
          ? Object.values(data).filter(
              (c: any) =>
                c.voiceName && c.joinedAt && now - c.joinedAt <= PRESENCE_MAX_AGE_MS,
            ).length
          : 0;
        counts[presetId] = validCount;

        // Calculate total
        const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
        setTotalCount(total);
      });

      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [presetIds.join(',')]); // Use join to create stable dependency

  return totalCount;
}

// ============================================================================
// Together Room Actions
// ============================================================================

// Countdown duration before session starts (3 seconds)
const COUNTDOWN_DURATION_MS = 3000;

/**
 * Start the countdown for a Together room session
 * Sets room status to 'countdown' and schedules playback start
 */
export async function startTogetherCountdown(
  presetId: string,
  getServerTime: () => number
): Promise<boolean> {
  const roomRef = ref(db, `rooms/together/${presetId}`);

  try {
    await update(roomRef, {
      status: 'countdown',
      startTimestamp: getServerTime() + COUNTDOWN_DURATION_MS,
    });
    return true;
  } catch (error) {
    console.error('Failed to start countdown:', error);
    return false;
  }
}

/**
 * Reset a Together room back to idle state
 * Called after session ends or when cleaning up abandoned sessions
 */
export async function resetTogetherRoom(presetId: string): Promise<void> {
  const roomRef = ref(db, `rooms/together/${presetId}`);
  const onlineRef = ref(db, `rooms/together/${presetId}/online`);

  // Reset room status
  await update(roomRef, {
    status: 'idle',
    startTimestamp: null,
  });

  // Reset isReady for all clients
  const snapshot = await get(onlineRef);
  const clients = snapshot.val() as Record<string, ClientPresence> | null;

  if (clients) {
    const updates: Record<string, boolean> = {};
    Object.keys(clients).forEach((clientId) => {
      updates[`${clientId}/isReady`] = false;
    });
    await update(onlineRef, updates);
  }
}
