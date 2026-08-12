// src/hooks/useTogetherRoom.ts
// ============================================================================
// Together Room Hooks - State management and actions for Together rooms
// ============================================================================

import { useState, useEffect } from 'react';
import { ref, onValue, update, get } from 'firebase/database';
import { db } from '../firebase/config';
import { PRESENCE_MAX_AGE_MS, COUNTDOWN_DURATION_MS } from '../utils/constants';
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
// useTogetherActivity - Live activity for together rooms
// ============================================================================

export interface RoomActivity {
  onlineCount: number;
  isLive: boolean;
}

/**
 * Hook to watch live activity (online count + countdown status) for a list
 * of Together rooms. Used by the lobby (per-room badges) and the home page
 * (total online count).
 */
export function useTogetherActivity(presetIds: string[]): {
  activity: Record<string, RoomActivity>;
  totalOnline: number;
} {
  const [activity, setActivity] = useState<Record<string, RoomActivity>>({});

  useEffect(() => {
    if (presetIds.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    for (const presetId of presetIds) {
      const roomRef = ref(db, `rooms/together/${presetId}`);

      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val() as TogetherRoomState | null;
        // Only count active clients (with voiceName and not stale)
        const now = Date.now();
        const onlineCount = data?.online
          ? Object.values(
              data.online as Record<string, ClientPresence>,
            ).filter(
              (client) =>
                client.voiceName &&
                client.joinedAt &&
                now - client.joinedAt <= PRESENCE_MAX_AGE_MS,
            ).length
          : 0;
        const isLive =
          data?.status === "countdown" && data?.startTimestamp !== null;

        // Update state immutably
        setActivity(prev => ({
          ...prev,
          [presetId]: { onlineCount, isLive }
        }));
      });

      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetIds.join(',')]); // Use join to create stable dependency

  const totalOnline = Object.values(activity).reduce(
    (sum, a) => sum + a.onlineCount,
    0,
  );

  return { activity, totalOnline };
}

// ============================================================================
// Together Room Actions
// ============================================================================

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
