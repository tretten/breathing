// src/hooks/usePresetMetadata.ts
// ============================================================================
// Hook for loading preset metadata from JSON files
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { getMetadataUrl } from '../utils/constants';
import type { PresetMetadata } from '../types';

type PresetInfo = PresetMetadata;

interface UseBulkPresetMetadataReturn {
  presets: PresetInfo[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Create fallback metadata when fetch fails
 */
function createFallbackMetadata(presetId: string): PresetInfo {
  return {
    id: presetId,
    lang: presetId.startsWith('en_') ? 'EN' : 'RU',
    title: presetId,
    titleRu: presetId,
  };
}

/**
 * Hook to load metadata for multiple presets in parallel
 * Includes proper cleanup to prevent state updates after unmount
 */
export function useBulkPresetMetadata(presetIds: string[]): UseBulkPresetMetadataReturn {
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize the key for stable dependency comparison
  const presetIdsKey = useMemo(() => presetIds.join(','), [presetIds]);

  useEffect(() => {
    if (presetIds.length === 0) {
      setPresets([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchAllMetadata = async () => {
      try {
        // Fetch all metadata in parallel
        const promises = presetIds.map(async (presetId) => {
          try {
            const response = await fetch(getMetadataUrl(presetId), {
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            return {
              id: presetId,
              lang: data.lang || (presetId.startsWith('en_') ? 'EN' : 'RU'),
              title: data.title || presetId,
              titleRu: data.titleRu || data.title || presetId,
              url: data.url,
            } as PresetInfo;
          } catch (fetchError) {
            // Ignore abort errors
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              throw fetchError;
            }
            console.warn(`Failed to load metadata for ${presetId}:`, fetchError);
            return createFallbackMetadata(presetId);
          }
        });

        const results = await Promise.all(promises);

        if (isMounted) {
          setPresets(results);
          setError(null);
          setIsLoading(false);
        }
      } catch (e) {
        // Ignore abort errors
        if (e instanceof Error && e.name === 'AbortError') {
          return;
        }

        console.error('Failed to fetch preset metadata:', e);

        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Unknown error');
          // Set fallback presets on error
          setPresets(presetIds.map(createFallbackMetadata));
          setIsLoading(false);
        }
      }
    };

    fetchAllMetadata();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [presetIdsKey]);

  return { presets, isLoading, error };
}

/**
 * Hook to load metadata for a single preset
 */
export function usePresetMetadata(presetId: string | null) {
  const [metadata, setMetadata] = useState<PresetMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!presetId) {
      setMetadata(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);

    const loadMetadata = async () => {
      try {
        const response = await fetch(getMetadataUrl(presetId), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (isMounted) {
          setMetadata({
            id: presetId,
            lang: data.lang || (presetId.startsWith('en_') ? 'EN' : 'RU'),
            title: data.title || presetId,
            titleRu: data.titleRu || data.title || presetId,
            url: data.url,
          });
          setError(null);
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return;
        }

        console.warn(`Failed to load metadata for ${presetId}:`, e);

        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Unknown error');
          // Set fallback metadata
          setMetadata({
            id: presetId,
            lang: presetId.startsWith('en_') ? 'EN' : 'RU',
            title: presetId,
            titleRu: presetId,
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMetadata();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [presetId]);

  return { metadata, isLoading, error };
}
