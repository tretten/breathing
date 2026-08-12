// src/components/GlobalOnlineIndicator.tsx
import { useEffect, useState } from "react";
import { ref, onValue, set, remove, onDisconnect, get } from "firebase/database";
import { db } from "../firebase/config";
import { useAppContext } from "../context/AppContext";
import { getClientId } from "../hooks";
import { PRESENCE_MAX_AGE_MS, HEARTBEAT_INTERVAL_MS } from "../utils/constants";

export function GlobalOnlineIndicator() {
  const { language } = useAppContext();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const clientId = getClientId();
    const myPresenceRef = ref(db, `presence/${clientId}`);
    const presenceRef = ref(db, "presence");

    // Prune ghost entries from crashed tabs / old sessions, then register
    get(presenceRef).then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        for (const [id, presence] of Object.entries(data) as [string, { lastSeen?: number }][]) {
          if (id !== clientId && now - (presence.lastSeen || 0) > PRESENCE_MAX_AGE_MS) {
            remove(ref(db, `presence/${id}`));
          }
        }
      }
    });

    // Register presence + heartbeat to keep lastSeen fresh
    const writeHeartbeat = () => {
      set(myPresenceRef, { online: true, lastSeen: Date.now() });
    };
    writeHeartbeat();
    const heartbeat = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Remove presence on disconnect
    onDisconnect(myPresenceRef).remove();

    // Listen to all online users (count only fresh entries)
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      const now = Date.now();
      const liveCount = data
        ? Object.entries(data as Record<string, { lastSeen?: number }>).filter(
            ([id, p]) => id === clientId || now - (p.lastSeen || 0) <= PRESENCE_MAX_AGE_MS,
          ).length
        : 0;
      setOnlineCount(liveCount);
    });

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeat);
      unsubscribe();
      remove(myPresenceRef);
    };
  }, []);

  const text = language === "en" ? "online" : "онлайн";
  const ariaLabel =
    language === "en"
      ? `${onlineCount} users online`
      : `${onlineCount} пользователей онлайн`;

  return (
    <div
      className="presence"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <span className="dot" aria-hidden="true" />
      <span>
        {onlineCount} {text}
      </span>
    </div>
  );
}