// src/hooks/useContentIndex.ts
// ============================================================================
// Hook for loading content index (list of available presets)
// ============================================================================

import { useState, useEffect } from 'react';
import { CONTENT_INDEX_URL } from '../utils/constants';
import type { ContentIndex } from '../types';

interface UseContentIndexReturn {
  togetherPresets: string[];
  soloPresets: string[];
  isLoading: boolean;
  error: string | null;
}

// Cache the loaded index to avoid refetching
let cachedIndex: ContentIndex | null = null;

/**
 * Hook to load and cache the content index
 * Returns lists of available presets for together and solo modes
 */
export function useContentIndex(): UseContentIndexReturn {
  const [index, setIndex] = useState<ContentIndex | null>(cachedIndex);
  const [isLoading, setIsLoading] = useState(!cachedIndex);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedIndex) {
      setIndex(cachedIndex);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadIndex = async () => {
      try {
        const response = await fetch(CONTENT_INDEX_URL);
        if (!response.ok) {
          throw new Error(`Failed to load content index: ${response.status}`);
        }
        const data: ContentIndex = await response.json();

        // Validate structure
        if (!data || !Array.isArray(data.together) || !Array.isArray(data.solo)) {
          throw new Error('Invalid content index format');
        }

        if (isMounted) {
          cachedIndex = data;
          setIndex(data);
        }
      } catch (e) {
        console.error('Failed to load content index:', e);
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadIndex();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    togetherPresets: index?.together ?? [],
    soloPresets: index?.solo ?? [],
    isLoading,
    error,
  };
}

/**
 * Check if a preset ID is valid for a given mode
 */
export function isValidPreset(
  presetId: string | undefined,
  presets: string[]
): presetId is string {
  return !!presetId && presets.includes(presetId);
}
