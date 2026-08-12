// src/utils/versionCheck.ts
// Compares the running bundle against the one the server serves. If the
// server has a newer build, drops caches/SW and reloads so stale visitors
// pick up the update automatically. Never fires mid-session (audio playing).
import { isAppPlaying } from "./appState";

export function getBundleHash(): string | null {
  const script = Array.from(document.querySelectorAll("script[src]")).find(
    (s) => /\/assets\/index-[A-Za-z0-9_-]+\.js/.test(s.getAttribute("src") || ""),
  );
  const match = script?.getAttribute("src")?.match(/index-([A-Za-z0-9_-]+)\.js/);
  return match ? match[1] : null;
}

export async function checkForUpdate(): Promise<void> {
  // Only force once per session - avoids reload loops if the server is stale
  if (sessionStorage.getItem("versionReloaded")) return;

  const current = getBundleHash();
  if (!current) return;

  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store" });
    const html = await res.text();
    const latest = html.match(/index-([A-Za-z0-9_-]+)\.js/)?.[1];
    if (!latest || latest === current) return;

    // Never interrupt a running session - the update lands on next visit
    if (isAppPlaying()) return;

    sessionStorage.setItem("versionReloaded", "1");

    // Drop caches and unregister the old service worker
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    window.location.reload();
  } catch {
    // Offline or server unreachable - keep the current version
  }
}
