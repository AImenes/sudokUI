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
