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

// Handle Range requests by streaming a slice of the cached response.
// Streams instead of arrayBuffer() so multi-MB files never get copied into
// memory on every seek (that crashed iOS Safari), while still returning a
// proper 206 that iOS Safari requires for media playback.
async function handleRangeRequest(cachedResponse, rangeHeader) {
  const totalSize = Number(cachedResponse.headers.get('Content-Length') || 0);
  const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);

  // No usable range/body/size: fall back to the full response
  if (!rangeMatch || !totalSize || !cachedResponse.body) {
    return cachedResponse;
  }

  const start = parseInt(rangeMatch[1], 10);
  const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalSize - 1;

  if (start >= totalSize || start > end) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${totalSize}` },
    });
  }

  const clampedEnd = Math.min(end, totalSize - 1);
  const length = clampedEnd - start + 1;

  const reader = cachedResponse.body.getReader();
  let position = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      let chunk;
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        chunk = value;
      } catch (e) {
        controller.error(e);
        return;
      }

      const chunkStart = position;
      const chunkEnd = chunkStart + chunk.length;
      position = chunkEnd;

      // Bytes we still need: [start, start + length)
      const from = Math.max(chunkStart, start);
      const to = Math.min(chunkEnd, start + length);
      if (from < to) {
        controller.enqueue(chunk.subarray(from - chunkStart, to - chunkStart));
        if (to >= start + length) {
          controller.close();
        }
      }
      // Chunks before `start` or after the slice are skipped - pull() is
      // called again when enqueue()d data is consumed.
    },
    cancel() {
      reader.cancel();
    },
  });

  const headers = new Headers(cachedResponse.headers);
  headers.set('Content-Range', `bytes ${start}-${clampedEnd}/${totalSize}`);
  headers.set('Content-Length', length.toString());
  headers.set('Accept-Ranges', 'bytes');

  return new Response(stream, {
    status: 206,
    statusText: 'Partial Content',
    headers,
  });
}
