import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Settings {
  theme: 'dark' | 'light';
  highlightPeers: boolean;
  highlightSameDigit: boolean;
  showTimer: boolean;
  toggleTheme: () => void;
  set: (p: Partial<Omit<Settings, 'toggleTheme' | 'set'>>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'dark',
      highlightPeers: true,
      highlightSameDigit: true,
      showTimer: true,
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      set: (p) => set(p)
    }),
    { name: 'sudokui-settings-v1' }
  )
);
