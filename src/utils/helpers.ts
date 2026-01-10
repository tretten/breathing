// src/utils/helpers.ts
// ============================================================================
// Utility Functions
// ============================================================================

import { SLOT_INTERVAL_MS, SESSION_WINDOW_MS } from './constants';

/**
 * Calculate the next session slot timestamp
 * Sessions start at every :00 and :30 minute mark
 */
export function getNextSlotTimestamp(serverTime: number): number {
  const currentSlot = Math.floor(serverTime / SLOT_INTERVAL_MS) * SLOT_INTERVAL_MS;
  const timeInSlot = serverTime - currentSlot;

  // If we're within the session window, consider it the current session
  if (timeInSlot < SESSION_WINDOW_MS) {
    return currentSlot;
  }
  
  return currentSlot + SLOT_INTERVAL_MS;
}

/**
 * Format milliseconds as MM:SS string
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00';
  
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds as human-readable string
 */
export function formatTimeReadable(ms: number): string {
  if (ms <= 0) return 'сейчас';
  
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes === 0) {
    return `${seconds} сек`;
  }
  
  if (seconds === 0) {
    return `${minutes} мин`;
  }
  
  return `${minutes} мин ${seconds} сек`;
}

/**
 * Generate a unique client ID
 */
export function generateClientId(): string {
  // Try to get from localStorage first
  const stored = localStorage.getItem('wim_hof_client_id');
  if (stored) return stored;
  
  // Generate new ID
  const id = 'client_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  localStorage.setItem('wim_hof_client_id', id);
  return id;
}

/**
 * Check if all clients in a room are ready
 */
export function areAllClientsReady(
  clients: Record<string, { isReady?: boolean }>
): boolean {
  const clientList = Object.values(clients);
  
  if (clientList.length === 0) {
    return false;
  }
  
  return clientList.every(client => client.isReady === true);
}

/**
 * Count ready clients
 */
export function countReadyClients(
  clients: Record<string, { isReady?: boolean }>
): { ready: number; total: number } {
  const clientList = Object.values(clients);
  const ready = clientList.filter(c => c.isReady === true).length;
  
  return {
    ready,
    total: clientList.length
  };
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Check if browser supports Web Audio API
 */
export function isWebAudioSupported(): boolean {
  return !!(window.AudioContext || (window as any).webkitAudioContext);
}

/**
 * Get session status message
 */
export function getSessionStatusMessage(
  isPlaying: boolean,
  remainingMs: number
): string {
  if (isPlaying) {
    return 'Сессия идёт';
  }
  
  if (remainingMs <= 0) {
    return 'Запуск...';
  }
  
  if (remainingMs < 60000) {
    return 'Скоро начнётся';
  }
  
  return 'Ожидание';
}
