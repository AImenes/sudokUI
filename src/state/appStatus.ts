// What the app knows about its own health: a new version waiting to be
// installed, offline readiness, a chunk that failed to load. Set from
// src/main.tsx (the service worker's callbacks and Vite's preload error),
// shown by the update bar in App. Kept apart from the game so a reload
// prompt never touches play state.
import { create } from 'zustand';

export interface AppStatus {
  /** a new build is ready: the player chooses when to reload */
  updateReady: boolean;
  /** why: a routine update, or a chunk this version can no longer load */
  reason: 'update' | 'chunk' | null;
  /** the app is fully cached for offline play (said once) */
  offlineReady: boolean;
  /** reload into the new version; set by main.tsx */
  reload: () => void;
  setUpdateReady: (reason: 'update' | 'chunk') => void;
  setOfflineReady: () => void;
  dismiss: () => void;
  setReload: (fn: () => void) => void;
}

/**
 * Reloads into the newest build, the game saved first. A new service
 * worker waiting (a routine update) is asked to take over, and the page
 * reloads once it has: vite-plugin-pwa reloads a page the old worker
 * controlled, and this a page no worker controlled yet (a first visit).
 * With none waiting, the page reloads at once: a file that failed in a
 * tab no worker controls, a browser without service workers, or another
 * tab took the update already. Should the worker never take over, the
 * page reloads anyway after `wait` ms.
 */
export async function reloadIntoLatest(skipWaiting: () => Promise<void>, save: () => void, wait = 3000): Promise<void> {
  try {
    save();
  } catch {
    /* storage unavailable: the reload goes ahead */
  }
  const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
  const waiting = sw ? await sw.getRegistration().then((r) => r?.waiting ?? null, () => null) : null;
  if (!sw || !waiting) return window.location.reload();
  if (!sw.controller) {
    waiting.addEventListener('statechange', () => {
      if (waiting.state === 'activated') window.location.reload();
    });
  }
  await skipWaiting().catch(() => {});
  setTimeout(() => window.location.reload(), wait);
}

export const useAppStatus = create<AppStatus>()((set) => ({
  updateReady: false,
  reason: null,
  offlineReady: false,
  reload: () => window.location.reload(),
  setUpdateReady: (reason) => set((s) => ({ updateReady: true, reason: s.reason === 'chunk' ? 'chunk' : reason })),
  setOfflineReady: () => set({ offlineReady: true }),
  dismiss: () => set({ updateReady: false, offlineReady: false }),
  setReload: (fn) => set({ reload: fn })
}));
