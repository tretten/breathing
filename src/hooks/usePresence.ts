// src/hooks/usePresence.ts
// ============================================================================
// usePresence - Manage user presence in a room
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, update, remove, onDisconnect } from 'firebase/database';
import { db } from '../firebase/config';
import { getOrCreateVoiceName } from '../utils/randomNames';
import { PRESENCE_MAX_AGE_MS, HEARTBEAT_INTERVAL_MS } from '../utils/constants';
import type { UsePresenceReturn, ClientPresence } from '../types';

interface UsePresenceOptions {
  isReady?: boolean;
}

/**
 * Hook to manage user presence in a Firebase room.
 *
 * Presence entries are written atomically (full object) and re-registered on
 * every reconnect (.info/connected). This prevents ghost entries: previously
 * a reconnect dropped the entry via onDisconnect and the heartbeat's update()
 * recreated it as a partial {lastSeen} record - counted but nameless, and the
 * owner's isReady was lost, blocking the room from ever starting.
 */
export function usePresence(
  roomPath: string | null,
  clientId: string,
  options: UsePresenceOptions = {}
): UsePresenceReturn {
  const [clients, setClients] = useState<Record<string, ClientPresence>>({});
  const { isReady } = options;
  const joinedRef = useRef(false);
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;

  useEffect(() => {
    if (!roomPath || !clientId) {
      return;
    }

    const myRef = ref(db, `rooms/${roomPath}/online/${clientId}`);
    const onlineRef = ref(db, `rooms/${roomPath}/online`);
    const connectedRef = ref(db, '.info/connected');

    // Register (or re-register after every reconnect). Always a full atomic
    // write so the entry can never be a nameless partial.
    const register = () => {
      set(myRef, {
        voiceName: getOrCreateVoiceName(),
        isReady: isReadyRef.current,
        lastSeen: Date.now(),
      }).catch((e) => console.warn('Failed to register presence:', e));
      onDisconnect(myRef).remove();
      joinedRef.current = true;
    };

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        register();
      }
    });

    // Listen to online users - the same freshness filter drives the count
    // and the participant list, so they can never disagree
    const unsubscribe = onValue(onlineRef, (snapshot) => {
      const data = snapshot.val() as Record<string, ClientPresence> | null;
      const now = Date.now();
      const activeClients: Record<string, ClientPresence> = {};

      if (data) {
        for (const [id, presence] of Object.entries(data)) {
          const isFresh =
            now - (presence.lastSeen || 0) <= PRESENCE_MAX_AGE_MS;
          // Always include our own entry, filter stale others
          if (id === clientId || isFresh) {
            activeClients[id] = presence;
          }
        }
      }

      setClients(activeClients);
    });

    // Heartbeat keeps lastSeen fresh - only after the entry exists, and it
    // updates (never creates) so a partial record can't sneak in
    const heartbeat = setInterval(() => {
      if (joinedRef.current) {
        update(myRef, { lastSeen: Date.now() }).catch(() => {});
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      unsubConnected();
      unsubscribe();
      clearInterval(heartbeat);
      joinedRef.current = false;
      remove(myRef);
    };
  }, [roomPath, clientId]);

  // Update isReady status when it changes (only after registration)
  useEffect(() => {
    if (!joinedRef.current || !roomPath || !clientId) {
      return;
    }

    update(ref(db, `rooms/${roomPath}/online/${clientId}`), { isReady }).catch(
      () => {}
    );
  }, [roomPath, clientId, isReady]);

  // Count at least ourselves (we're in the process of registering)
  const onlineCount = Math.max(1, Object.keys(clients).length);

  return { onlineCount, clients };
}
