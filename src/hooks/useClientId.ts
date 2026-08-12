// src/hooks/useClientId.ts
// ============================================================================
// getClientId - Generate and persist anonymous client ID
// ============================================================================

import { STORAGE_KEY_CLIENT_ID } from "../utils/storageKeys";

/**
 * Generate a unique client ID
 */
function generateClientId(): string {
  return "client_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/**
 * Get or create a persistent client ID from localStorage
 */
export function getClientId(): string {
  const stored = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
  if (stored) return stored;

  const id = generateClientId();
  localStorage.setItem(STORAGE_KEY_CLIENT_ID, id);
  return id;
}
