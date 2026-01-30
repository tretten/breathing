// Service Worker for offline audio caching
const CACHE_NAME = 'rooms-offline-v1';

// Install event - activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate event - claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch event - cache audio/json files automatically on first load
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle audio and json files from /content/
  if (!url.pathname.startsWith('/content/')) return;
  if (!url.pathname.match(/\.(mp3|json|ogg)$/)) return;

  event.respondWith(handleAudioRequest(event.request));
});

async function handleAudioRequest(request) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch (e) {
    // Cache API unavailable, just fetch from network
    return fetch(request);
  }

  // Try cache first
  try {
    const cachedResponse = await cache.match(request, { ignoreSearch: true });
    if (cachedResponse) {
      // Handle Range requests for cached content
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        return handleRangeRequest(cachedResponse, rangeHeader);
      }
      return cachedResponse;
    }
  } catch (e) {
    // Cache read error, continue to network
  }

  // Fetch from network
  const networkResponse = await fetch(request);

  // Only cache complete responses (status 200), not partial (206)
  if (networkResponse.ok && networkResponse.status === 200) {
    // Clone and cache (ignore errors)
    cache.put(request, networkResponse.clone()).catch(() => {});
  }

  return networkResponse;
}

// Handle Range requests by slicing the cached response
async function handleRangeRequest(cachedResponse, rangeHeader) {
  try {
    const arrayBuffer = await cachedResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const totalSize = bytes.length;

    // Parse Range header (e.g., "bytes=12345-" or "bytes=12345-67890")
    const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!rangeMatch) {
      // Invalid range, return full response
      return new Response(bytes, {
        status: 200,
        headers: cachedResponse.headers,
      });
    }

    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalSize - 1;

    // Validate range
    if (start >= totalSize || start > end) {
      return new Response(null, {
        status: 416,
        statusText: 'Range Not Satisfiable',
        headers: { 'Content-Range': `bytes */${totalSize}` },
      });
    }

    const clampedEnd = Math.min(end, totalSize - 1);
    const slicedBytes = bytes.slice(start, clampedEnd + 1);

    // Create new headers with range info
    const headers = new Headers(cachedResponse.headers);
    headers.set('Content-Range', `bytes ${start}-${clampedEnd}/${totalSize}`);
    headers.set('Content-Length', slicedBytes.length.toString());
    headers.set('Accept-Ranges', 'bytes');

    return new Response(slicedBytes, {
      status: 206,
      statusText: 'Partial Content',
      headers,
    });
  } catch (e) {
    // On error, return the original cached response
    return cachedResponse;
  }
}

// Pre-cache a full audio file (without Range headers)
async function cacheFullFile(url) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch (e) {
    return false; // Cache API unavailable
  }

  // Check if already cached
  try {
    const existing = await cache.match(url);
    if (existing) return true;
  } catch (e) {
    // Continue to fetch
  }

  try {
    // Fetch full file
    const response = await fetch(url);

    if (response.ok && response.status === 200) {
      await cache.put(url, response);
      return true;
    }
  } catch (error) {
    // Silently fail - caching is optional
  }

  return false;
}

// Message handler for checking cached status and manual caching
self.addEventListener('message', async (event) => {
  if (event.data.type === 'CHECK_CACHED') {
    const { urls } = event.data;
    const results = {};

    try {
      const cache = await caches.open(CACHE_NAME);
      for (const url of urls) {
        try {
          const cached = await cache.match(url, { ignoreSearch: true });
          results[url] = !!cached;
        } catch (e) {
          results[url] = false;
        }
      }
    } catch (e) {
      // Cache API unavailable, all false
      for (const url of urls) {
        results[url] = false;
      }
    }

    event.ports[0].postMessage({ results });
  }

  if (event.data.type === 'CACHE_FILES') {
    const { urls } = event.data;
    const results = {};

    for (const url of urls) {
      results[url] = await cacheFullFile(url);
    }

    event.ports[0].postMessage({ results });
  }
});
