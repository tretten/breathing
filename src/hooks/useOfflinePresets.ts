// src/hooks/useOfflinePresets.ts
// ============================================================================
// Hook for checking offline preset availability
// Presets are automatically cached by Service Worker on first playback
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAudioUrl, getMetadataUrl } from '../utils/constants';
import { useContentIndex } from './useContentIndex';

// Must match CACHE_NAME in public/sw.js
const CACHE_NAME = 'rooms-offline-v3';

interface UseOfflinePresetsReturn {
  /** Which presets are cached and available offline */
  cachedPresets: Set<string>;
  /** Whether Cache Storage API is available */
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

export function useOfflinePresets(): UseOfflinePresetsReturn {
  const [cachedPresets, setCachedPresets] = useState<Set<string>>(new Set());
  const isSupported = useMemo(() => 'caches' in window, []);
  const { togetherPresets, soloPresets } = useContentIndex();

  // Combine all presets for checking
  const allPresets = useMemo(
    () => [...new Set([...togetherPresets, ...soloPresets])],
    [togetherPresets, soloPresets]
  );

  // Check which presets are cached
  const checkCachedPresets = useCallback(async () => {
    if (!isSupported || allPresets.length === 0) return;

    try {
      const cache = await caches.open(CACHE_NAME);

      const cached = new Set<string>();
      for (const presetId of allPresets) {
        const urls = getPresetUrls(presetId);
        const results = await Promise.all(
          urls.map((url) => cache.match(url, { ignoreSearch: true }))
        );
        if (results.every(Boolean)) {
          cached.add(presetId);
        }
      }

      setCachedPresets(cached);
    } catch (error) {
      console.warn('Failed to check cached presets:', error);
    }
  }, [isSupported, allPresets]);

  // Check on mount and when preset list changes
  useEffect(() => {
    if (isSupported && allPresets.length > 0) {
      checkCachedPresets();
    }
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
      const cache = await caches.open(CACHE_NAME);
      for (const url of getPresetUrls(preset)) {
        const response = await fetch(url);
        if (response.ok && response.status === 200) {
          await cache.put(url, response).catch(() => {});
        }
      }
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
