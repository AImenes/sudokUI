// The daily's global statistics on this device (docs/online-goals.md,
// phase 2): what the server knows about a day (how many played, the
// median, the histogram), fetched when the win screen opens; and the
// player's own result, sent only when the player asks, with a random
// token kept here so a second send is a no-op. A result that cannot be
// sent (offline, the server down or over its cap) waits and goes on the
// next open. Nothing here identifies the player: the token is a value for
// one day's result and nothing else, and the server stores no more than
// the result (worker/daily.ts). With the player's one tap of consent (the
// Settings switch, offered on the win screen once a time has gone in),
// each later unassisted daily solve sends the same result by itself
// (gameStore.ts, recordWin). The day's own solve is kept here too, on the
// device only, so its share line can be built again after the win screen
// has closed.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DailyStats } from '../content/dailies';
import type { Level } from '../engine/ratings';
import { useSettings } from './settings';

/** one player's result for a daily, as the server takes it */
export interface DailyResult {
  no: number;
  /** the finished grid, 81 digits */
  grid: string;
  seconds: number;
  hints: number;
  unassisted: boolean;
  /** queued by the switch, not by a tap: kept on the device only, never sent, and dropped once the switch is off */
  auto?: boolean;
}

export type SubmitOutcome = 'accepted' | 'repeat' | 'offline' | 'refused' | 'unavailable';

/** a daily this device solved, as the win screen showed it: what its share line is built from, then and later */
export interface PlayedDaily {
  /** the day, 2026-10-08 */
  date: string;
  level: Level;
  score: number;
  /** the solve time, whole seconds */
  seconds: number;
  /** something from the Assist box was used */
  assisted: boolean;
}

/** how many days of solves the device keeps for their share line */
const PLAYED_KEPT = 31;

interface DailyStatsState {
  /** the random value that stands for this device in a day's results, by number */
  tokens: Record<string, string>;
  /** the seconds this device has submitted, by number: the panel shows the percentile from then on */
  submitted: Record<string, number>;
  /** results that could not be sent, by number, sent on the next open */
  pending: Record<string, DailyResult>;
  /** the latest statistics seen, by number; a fetch never replaces a fuller answer with an emptier one */
  stats: Record<string, DailyStats>;
  /** the dailies solved on this device, by number: the first solve of each, or a later unassisted one in place of one with help (gameStore.ts, recordDaily); never sent */
  played: Record<string, PlayedDaily>;
  /** the numbers whose result is on its way right now; not kept */
  inFlight: Record<string, boolean>;
  /** keeps a daily's solve for its share line */
  recordPlayed(no: number, played: PlayedDaily): void;
  /** the day's statistics, fresh from the server; null when they cannot be had right now */
  fetchStats(no: number): Promise<DailyStats | null>;
  /** sends the player's result; what came of it */
  submit(result: DailyResult): Promise<SubmitOutcome>;
  /** sends the results that were waiting, if any */
  flushPending(): Promise<void>;
}

/** a token for a day: random, kept, never derived from anything about the player */
function makeToken(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  c?.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const api = (no: number, route: 'stats' | 'result') => `/api/daily/${no}/${route}`;

/** installed app or a tab: the one thing the result says about where it was played */
export const playedFrom = (): 'pwa' | 'tab' =>
  typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches ? 'pwa' : 'tab';

/** the server's count only grows: an answer from a cache a minute old never wins over a newer one */
const fuller = (prev: DailyStats | undefined, next: DailyStats) => (prev && prev.count > next.count ? prev : next);

const without = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _gone, ...rest } = record;
  return rest;
};

/** what the store keeps on the device */
type Kept = Pick<DailyStatsState, 'tokens' | 'submitted' | 'pending' | 'stats' | 'played'>;

/**
 * What the device kept, brought up to version 1, when the statistics came
 * to count unassisted solves only. A day's statistics kept from before
 * counted assisted times too, and a fetch never lets a smaller count
 * replace a kept one, so they would stick: they go, and the next fetch
 * brings the day back. The tokens, the times sent and what waits to be
 * sent all stay.
 */
export function migrateKept(persisted: unknown, version: number): Kept {
  const s = persisted as Kept;
  return version < 1 ? { ...s, stats: {} } : s;
}

export const useDailyStats = create<DailyStatsState>()(
  persist(
    (set, get) => ({
      tokens: {},
      submitted: {},
      pending: {},
      stats: {},
      played: {},
      inFlight: {},

      // the PLAYED_KEPT dailies with the highest numbers, whatever order
      // they were solved in: never more than that many days of solves
      recordPlayed: (no, played) =>
        set((s) => ({
          played: Object.fromEntries(
            [...Object.entries(s.played).filter(([k]) => Number(k) !== no), [String(no), played] as const]
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .slice(0, PLAYED_KEPT)
          )
        })),

      fetchStats: async (no) => {
        try {
          const res = await fetch(api(no, 'stats'), { headers: { accept: 'application/json' } });
          if (!res.ok) return null;
          const stats = (await res.json()) as DailyStats;
          if (typeof stats?.count !== 'number') return null;
          set((s) => ({ stats: { ...s.stats, [no]: fuller(s.stats[no], stats) } }));
          return get().stats[no];
        } catch {
          return null;
        }
      },

      submit: async (result) => {
        const key = String(result.no);
        const token = get().tokens[key] ?? makeToken();
        set((s) => ({ tokens: { ...s.tokens, [key]: token } }));
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          set((s) => ({ pending: { ...s.pending, [key]: result } }));
          return 'offline';
        }
        // on its way: the win screen says so, whether a tap or the switch sent it
        set((s) => ({ inFlight: { ...s.inFlight, [key]: true } }));
        try {
          let res: Response;
          try {
            res = await fetch(api(result.no, 'result'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              // the fields by name: a result an older build kept also carries
              // where the app ran, which is no longer sent
              body: JSON.stringify({ no: result.no, grid: result.grid, seconds: result.seconds, hints: result.hints, unassisted: result.unassisted, token })
            });
          } catch {
            set((s) => ({ pending: { ...s.pending, [key]: result } }));
            return 'unavailable';
          }
          if (res.status === 400) {
            // the server will never take it: nothing to retry
            set((s) => ({ pending: without(s.pending, key) }));
            return 'refused';
          }
          if (!res.ok) {
            set((s) => ({ pending: { ...s.pending, [key]: result } }));
            return 'unavailable';
          }
          let body: { accepted?: boolean; stats?: DailyStats };
          try {
            body = (await res.json()) as { accepted?: boolean; stats?: DailyStats };
          } catch {
            body = {};
          }
          if (typeof body.accepted !== 'boolean' || typeof body.stats?.count !== 'number') {
            set((s) => ({ pending: { ...s.pending, [key]: result } }));
            return 'unavailable';
          }
          const { accepted, stats } = body;
          set((s) => ({
            // the time the server holds is the first one it took
            submitted: { ...s.submitted, [key]: accepted ? result.seconds : (s.submitted[key] ?? result.seconds) },
            stats: { ...s.stats, [key]: fuller(s.stats[key], stats) },
            pending: without(s.pending, key)
          }));
          return accepted ? 'accepted' : 'repeat';
        } finally {
          set((s) => ({ inFlight: without(s.inFlight, key) }));
        }
      },

      // a time the switch queued while offline goes only while the switch is
      // still on; turned off, it is dropped (the privacy page: off again, a
      // time goes only when you tap the button)
      flushPending: async () => {
        const auto = useSettings.getState().autoSendDaily;
        for (const result of Object.values(get().pending)) {
          if (result.auto && !auto) set((s) => ({ pending: without(s.pending, String(result.no)) }));
          else await get().submit(result);
        }
      }
    }),
    {
      name: 'sudokui-daily-v1',
      version: 1,
      migrate: migrateKept,
      partialize: (s): Kept => ({ tokens: s.tokens, submitted: s.submitted, pending: s.pending, stats: s.stats, played: s.played })
    }
  )
);

// the dailies another window of the app played and sent (a second tab, the
// installed app's window) are taken in while this one is hidden, as its
// game is (gameStore.ts), so this window's next save (its win screen
// fetching the day's numbers is one) does not drop a time sent there, or
// its token
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'sudokui-daily-v1' && e.newValue && document.visibilityState === 'hidden') void useDailyStats.persist.rehydrate();
  });
}
