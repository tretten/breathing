// Smoke test for the together-room data layer against the real Firebase DB.
// Run: node test-room-flow.mjs
// Uses a throwaway room (rooms/together/test-flow-*), cleans up after itself.
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, update, remove, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyAJbZ5eVH7GySL6d5kl2n2DvE7OLrdCvSE',
  authDomain: 'breathing-stan.firebaseapp.com',
  databaseURL: 'https://breathing-stan-default-rtdb.firebaseio.com',
  projectId: 'breathing-stan',
  storageBucket: 'breathing-stan.firebasestorage.app',
  messagingSenderId: '839370645444',
  appId: '1:839370645444:web:ab9c853e5b048cacce0e91',
};

const PRESENCE_MAX_AGE_MS = 2 * 60 * 1000;

const app = initializeApp(firebaseConfig, 'test-flow');
const db = getDatabase(app);
const ROOM = `test-flow-${Date.now()}`;
const base = `rooms/together/${ROOM}`;
const A = 'client_test_a';
const B = 'client_test_b';

let failures = 0;
function check(name, cond) {
  if (!cond) {
    console.error('FAIL:', name);
    failures++;
  } else {
    console.log('ok  :', name);
  }
}

function presence(ready) {
  return { voiceName: JSON.stringify({ adj: 1, noun: 1 }), isReady: ready, lastSeen: Date.now() };
}

const getOnline = async () => (await get(ref(db, `${base}/online`))).val() || {};

try {
  // 1. Both clients join with full atomic entries
  await set(ref(db, `${base}/online/${A}`), presence(false));
  await set(ref(db, `${base}/online/${B}`), presence(false));
  let online = await getOnline();
  check('both registered with voiceName+lastSeen',
    online[A]?.voiceName && online[A]?.lastSeen && online[B]?.voiceName && online[B]?.lastSeen);

  // 2. Both press ready
  await update(ref(db, `${base}/online/${A}`), { isReady: true });
  await update(ref(db, `${base}/online/${B}`), { isReady: true });
  online = await getOnline();
  const readyCount = Object.values(online).filter((p) => p.isReady).length;
  const onlineCount = Object.values(online).filter(
    (p) => p.voiceName && p.lastSeen && Date.now() - p.lastSeen <= PRESENCE_MAX_AGE_MS,
  ).length;
  check('allReady: 2/2, count matches list', readyCount === 2 && readyCount === onlineCount);

  // 3. Countdown write (same shape as startTogetherCountdown - update on
  //    child keys, matching the DB rules)
  const startTimestamp = Date.now() + 3000;
  await update(ref(db, base), { status: 'countdown', startTimestamp });
  const room = (await get(ref(db, base))).val();
  check('countdown written with startTimestamp in future',
    room.status === 'countdown' && room.startTimestamp === startTimestamp);

  // 4. Reset (same shape as resetTogetherRoom): status idle + isReady cleared
  await update(ref(db, base), { status: 'idle', startTimestamp: null });
  await update(ref(db, `${base}/online/${A}`), { isReady: false });
  await update(ref(db, `${base}/online/${B}`), { isReady: false });
  online = await getOnline();
  const readyAfterReset = Object.values(online).filter((p) => p.isReady).length;
  check('reset clears ready flags', readyAfterReset === 0);

  // 5. Ghost scenario that used to break counts: entry removed by
  //    onDisconnect, then a bare heartbeat update() recreates it nameless.
  //    The fix keeps heartbeat writes out of the create path (update only
  //    runs after a full registration), so here we verify the count stays
  //    consistent when the entry is gone.
  await remove(ref(db, `${base}/online/${A}`));
  online = await getOnline();
  const countAfterLeave = Object.values(online).filter(
    (p) => p.voiceName && p.lastSeen && Date.now() - p.lastSeen <= PRESENCE_MAX_AGE_MS,
  ).length;
  check('leaver no longer counted', countAfterLeave === 1 && !online[A]);
} finally {
  // Clean up child paths (the rules allow writes per-child, not the room root)
  await Promise.all([
    remove(ref(db, `${base}/online/${A}`)),
    remove(ref(db, `${base}/online/${B}`)),
    remove(ref(db, `${base}/status`)),
    remove(ref(db, `${base}/startTimestamp`)),
  ]);
  console.log(failures ? `${failures} FAILED` : 'ALL PASS');
  process.exit(failures ? 1 : 0);
}
