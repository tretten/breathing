// Self-check for sw.js handleRangeRequest (streaming 206 slicing)
// Run: node test-sw-range.js
const fs = require('fs');
const vm = require('vm');

const swSource = fs.readFileSync('public/sw.js', 'utf8');

// Minimal SW sandbox: the file defines functions + addEventListener at top
// level; we only need handleRangeRequest, so tolerate the rest.
const sandbox = {
  self: { addEventListener() {} },
  caches: { open: async () => ({ match: async () => null }) },
  fetch: async () => new Response(null, { status: 404 }),
  Response,
  Headers,
  ReadableStream,
};
vm.createContext(sandbox);
vm.runInContext(swSource, sandbox);

function makeCached() {
  const body = new Uint8Array(1000).map((_, i) => i % 256);
  return new Response(body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '1000' },
  });
}

function check(name, cond) {
  if (!cond) {
    console.error('FAIL:', name);
    process.exitCode = 1;
  } else {
    console.log('ok  :', name);
  }
}

(async () => {
  let res = await sandbox.handleRangeRequest(makeCached(), 'bytes=0-1');
  let buf = new Uint8Array(await res.arrayBuffer());
  check('probe bytes=0-1 is 206', res.status === 206);
  check('probe content-range', res.headers.get('Content-Range') === 'bytes 0-1/1000');
  check('probe accept-ranges', res.headers.get('Accept-Ranges') === 'bytes');
  check('probe length 2', buf.length === 2 && buf[0] === 0 && buf[1] === 1);

  res = await sandbox.handleRangeRequest(makeCached(), 'bytes=500-');
  buf = new Uint8Array(await res.arrayBuffer());
  check('open-ended bytes=500- is 206', res.status === 206);
  check('open-ended content-range', res.headers.get('Content-Range') === 'bytes 500-999/1000');
  check('open-ended length 500', buf.length === 500 && buf[0] === (500 % 256));

  res = await sandbox.handleRangeRequest(makeCached(), 'bytes=1000-');
  check('out-of-range is 416', res.status === 416);

  res = await sandbox.handleRangeRequest(makeCached(), 'bytes=0-');
  buf = new Uint8Array(await res.arrayBuffer());
  check('full range bytes=0- length 1000', res.status === 206 && buf.length === 1000);

  res = await sandbox.handleRangeRequest(makeCached(), 'garbage');
  check('invalid range falls back to 200', res.status === 200);

  if (!process.exitCode) console.log('ALL PASS');
})();
