// src/hooks/useServerTime.ts
// ============================================================================
// useServerTime - Get Firebase server time with offset correction
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase/config';
import type { UseServerTimeReturn } from '../types';

/**
 * Hook to get accurate server time by applying Firebase's time offset
 * This ensures all clients have synchronized timing for session scheduling
 */
export function useServerTime(): UseServerTimeReturn {
  const [offset, setOffset] = useState<number>(0);

  useEffect(() => {
    const offsetRef = ref(db, '.info/serverTimeOffset');

    const unsubscribe = onValue(offsetRef, (snapshot) => {
      const value = snapshot.val();
      setOffset(typeof value === 'number' ? value : 0);
    });

    return unsubscribe;
  }, []);

  const getServerTime = useCallback((): number => {
    return Date.now() + offset;
  }, [offset]);

  return { getServerTime, offset };
}
