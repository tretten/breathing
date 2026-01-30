// src/hooks/usePresence.ts
// ============================================================================
// usePresence - Manage user presence in a room
// ============================================================================

import { useState, useEffect } from 'react';
import {
  ref,
  onValue,
  set,
  update,
  remove,
  onDisconnect,
  get,
} from 'firebase/database';
import { db } from '../firebase/config';
import { getOrCreateVoiceName } from '../utils/randomNames';
import { PRESENCE_MAX_AGE_MS, HEARTBEAT_INTERVAL_MS } from '../utils/constants';
import type { UsePresenceReturn, ClientPresence } from '../types';

interface UsePresenceOptions {
  isReady?: boolean;
}

/**
 * Hook to manage user presence in a Firebase room
 * Handles registration, cleanup of stale entries, and real-time updates
 */
export function usePresence(
  roomPath: string | null,
  clientId: string,
  options: UsePresenceOptions = {}
): UsePresenceReturn {
  // Start with 1 to count ourselves before Firebase confirms (prevents showing 0)
  const [onlineCount, setOnlineCount] = useState<number>(roomPath ? 1 : 0);
  const [clients, setClients] = useState<Record<string, ClientPresence>>({});
  const { isReady } = options;

  // Register presence (only depends on roomPath and clientId)
  useEffect(() => {
    if (!roomPath || !clientId) {
      return;
    }

    const myRef = ref(db, `rooms/${roomPath}/online/${clientId}`);
    const onlineRef = ref(db, `rooms/${roomPath}/online`);

    // Clean up stale entries first, then register ourselves
    const cleanupAndRegister = async () => {
      try {
        // Get current entries
        const snapshot = await get(onlineRef);
        const data = snapshot.val() as Record<string, ClientPresence> | null;

        if (data) {
          const now = Date.now();
          const staleClientIds = Object.entries(data)
            .filter(([id, presence]) => {
              // Don't remove our own entry
              if (id === clientId) return false;
              // Remove only if joinedAt is too old (stale entry)
              return now - presence.joinedAt > PRESENCE_MAX_AGE_MS;
            })
            .map(([id]) => id);

          // Remove stale entries
          for (const staleId of staleClientIds) {
            await remove(ref(db, `rooms/${roomPath}/online/${staleId}`));
          }
        }
      } catch (e) {
        console.warn('Failed to cleanup stale presence entries:', e);
      }

      // Register presence with initial data (including voice name)
      const presenceData: ClientPresence = {
        joinedAt: Date.now(),
        isReady: false,
        voiceName: getOrCreateVoiceName(),
      };

      set(myRef, presenceData);
    };

    cleanupAndRegister();

    // Setup disconnect handler
    onDisconnect(myRef).remove();

    // Listen to online users - filter out stale entries
    const unsubscribe = onValue(onlineRef, (snapshot) => {
      const data = snapshot.val() as Record<string, ClientPresence> | null;

      // Filter out stale entries from display
      const now = Date.now();
      const activeClients: Record<string, ClientPresence> = {};

      if (data) {
        for (const [id, presence] of Object.entries(data)) {
          // Always include our own entry, filter stale others
          // Don't filter by voiceName - let the cache in useVoiceChat handle missing names
          const isNotStale = id === clientId || now - presence.joinedAt <= PRESENCE_MAX_AGE_MS;
          if (isNotStale) {
            activeClients[id] = presence;
          }
        }
      }

      setClients(activeClients);
      // Always count at least ourselves (we're in the process of registering even if not in data yet)
      const count = Object.keys(activeClients).length;
      setOnlineCount(count > 0 ? count : 1);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      remove(myRef);
    };
  }, [roomPath, clientId]);

  // Update isReady status when it changes (separate effect)
  useEffect(() => {
    if (!roomPath || !clientId || typeof isReady !== 'boolean') {
      return;
    }

    const myRef = ref(db, `rooms/${roomPath}/online/${clientId}`);
    update(myRef, { isReady });
  }, [roomPath, clientId, isReady]);

  // Heartbeat - update joinedAt periodically to stay "alive"
  useEffect(() => {
    if (!roomPath || !clientId) {
      return;
    }

    const myRef = ref(db, `rooms/${roomPath}/online/${clientId}`);

    const heartbeat = setInterval(() => {
      update(myRef, { joinedAt: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(heartbeat);
  }, [roomPath, clientId]);

  return { onlineCount, clients };
}
