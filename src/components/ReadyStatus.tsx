// src/components/ReadyStatus.tsx
import type { ClientPresence } from '../types';

interface ReadyStatusProps {
  clients: Record<string, ClientPresence>;
}

export function ReadyStatus({ clients }: ReadyStatusProps) {
  const clientList = Object.values(clients);
  const readyCount = clientList.filter(c => c.isReady).length;
  const totalCount = clientList.length;

  return (
    <div className="ready-status">
      <div className="ready-bar">
        <div 
          className="ready-fill" 
          style={{ width: `${totalCount > 0 ? (readyCount / totalCount) * 100 : 0}%` }} 
        />
      </div>
      <span>{readyCount} / {totalCount} готовы</span>
    </div>
  );
}
