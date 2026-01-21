// src/components/GlobalOnlineIndicator.tsx
import { useEffect, useState } from 'react';
import { ref, onValue, set, remove, onDisconnect } from 'firebase/database';
import { db } from '../firebase/config';
import { useAppContext } from '../context/AppContext';

// Get or create a persistent client ID
function getClientId(): string {
  const stored = localStorage.getItem('wim_hof_client_id');
  if (stored) return stored;

  const id = 'client_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  localStorage.setItem('wim_hof_client_id', id);
  return id;
}

export function GlobalOnlineIndicator() {
  const { language } = useAppContext();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const clientId = getClientId();
    const myPresenceRef = ref(db, `presence/${clientId}`);
    const presenceRef = ref(db, 'presence');

    // Register global presence
    set(myPresenceRef, {
      online: true,
      lastSeen: Date.now()
    });

    // Remove presence on disconnect
    onDisconnect(myPresenceRef).remove();

    // Listen to all online users
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      setOnlineCount(data ? Object.keys(data).length : 0);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      remove(myPresenceRef);
    };
  }, []);

  const text = language === 'en' ? 'online' : 'онлайн';
  const ariaLabel = language === 'en' ? `${onlineCount} users online` : `${onlineCount} пользователей онлайн`;

  return (
    <div className="global-online-indicator" role="status" aria-live="polite" aria-label={ariaLabel}>
      <span className="online-dot" aria-hidden="true" />
      <span>{onlineCount} {text}</span>
    </div>
  );
}
