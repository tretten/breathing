// src/hooks/useOfflinePresets.ts
// ============================================================================
// Hook for checking offline preset availability
// Presets are automatically cached by Service Worker on first playback
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getAudioUrl, getMetadataUrl } from '../utils/constants';
import { useContentIndex } from './useContentIndex';

interface UseOfflinePresetsReturn {
  /** Which presets are cached and available offline */
  cachedPresets: Set<string>;
  /** Whether service worker is available */
  isSupported: boolean;
  /** Check which presets are cached */
  checkCachedPresets: () => Promise<void>;
  /** Check if a specific preset is cached */
  isPresetCached: (preset: string) => boolean;
  /** Cache a preset for offline use */
  cachePreset: (preset: string) => Promise<void>;
}

/**
 * Get full URLs for a preset (audio + json)
 */
function getPresetUrls(presetId: string): string[] {
  const audioUrl = getAudioUrl(presetId);
  const jsonUrl = getMetadataUrl(presetId);
  // Convert to absolute URLs for cache matching
  const base = window.location.origin;
  return [new URL(audioUrl, base).href, new URL(jsonUrl, base).href];
}

/**
 * Send message to service worker and wait for response
 */
async function sendToServiceWorker<T>(message: object): Promise<T> {
  const registration = await navigator.serviceWorker.ready;
  const sw = registration.active;

  if (!sw) {
    throw new Error('No active service worker');
  }

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      reject(new Error('Service worker message timeout'));
    }, 5000);

    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(event.data);
    };

    channel.port1.onmessageerror = () => {
      clearTimeout(timeout);
      reject(new Error('Message error'));
    };

    sw.postMessage(message, [channel.port2]);
  });
}

export function useOfflinePresets(): UseOfflinePresetsReturn {
  const [cachedPresets, setCachedPresets] = useState<Set<string>>(new Set());
  const [isSupported, setIsSupported] = useState(false);
  const { togetherPresets, soloPresets } = useContentIndex();

  // Combine all presets for checking
  const allPresets = [...new Set([...togetherPresets, ...soloPresets])];

  // Check if service worker is supported
  useEffect(() => {
    setIsSupported('serviceWorker' in navigator);
  }, []);

  // Check which presets are cached
  const checkCachedPresets = useCallback(async () => {
    if (!isSupported || allPresets.length === 0) return;

    try {
      // Collect all URLs for all presets
      const allUrls: string[] = [];
      for (const presetId of allPresets) {
        allUrls.push(...getPresetUrls(presetId));
      }

      const response = await sendToServiceWorker<{ results: Record<string, boolean> }>({
        type: 'CHECK_CACHED',
        urls: allUrls,
      });

      // Determine which presets have all files cached
      const cached = new Set<string>();
      for (const presetId of allPresets) {
        const urls = getPresetUrls(presetId);
        const allCached = urls.every((url) => response.results[url]);
        if (allCached) {
          cached.add(presetId);
        }
      }

      setCachedPresets(cached);
    } catch (error) {
      console.warn('Failed to check cached presets:', error);
    }
  }, [isSupported, allPresets.join(',')]);

  // Check on mount and when service worker becomes available
  useEffect(() => {
    if (isSupported && allPresets.length > 0) {
      navigator.serviceWorker.ready.then(() => {
        checkCachedPresets();
      });
    }
  }, [isSupported, checkCachedPresets, allPresets.length]);

  // Periodically re-check cache status (to detect new cached presets after playback)
  useEffect(() => {
    if (!isSupported || allPresets.length === 0) return;

    const interval = setInterval(() => {
      checkCachedPresets();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isSupported, checkCachedPresets, allPresets.length]);

  // Check if specific preset is cached
  const isPresetCached = useCallback((preset: string) => {
    return cachedPresets.has(preset);
  }, [cachedPresets]);

  // Cache a preset for offline use
  const cachePreset = useCallback(async (preset: string) => {
    if (!isSupported) return;
    if (cachedPresets.has(preset)) return; // Already cached

    try {
      const urls = getPresetUrls(preset);
      await sendToServiceWorker({
        type: 'CACHE_FILES',
        urls,
      });
      // Refresh cache status
      await checkCachedPresets();
    } catch (error) {
      console.warn('Failed to cache preset:', error);
    }
  }, [isSupported, cachedPresets, checkCachedPresets]);

  return {
    cachedPresets,
    isSupported,
    checkCachedPresets,
    isPresetCached,
    cachePreset,
  };
}
