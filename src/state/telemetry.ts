// Counting plays (docs/online-goals.md, phase 3): what the app sends to
// POST /api/t (worker/telemetry.ts) so the owner can tell whether anyone
// plays, without identifying anyone.
//
// By default, while online: a `started` line at a game's first move, or
// when a shared position or a pasted grid opens with entries on it (a
// game opened and never touched is not counted; gameStore.ts) and a
// `completed` line when it is solved, each with the band, the time in
// 15-second buckets, whether display-mode: standalone matched, the app's
// version and where it ran (the installed app or a tab). Nothing is stored
// on the device for it, and offline nothing is sent and nothing is kept.
//
// With the Settings switch "Help count plays, including offline ones" on
// (countPlays in settings.ts), the same lines are kept here while offline,
// marked `offline`, and sent on the next open, when the app is hidden and
// when the connection returns; and the day the switch went on is kept so
// a line can say whether this device had played on an earlier day
// (`returning`). Both go the moment the switch goes off. That is the whole
// of what the opt-in stores: a queue and a date, no identifier, and the
// privacy page (src/content/privacy.ts) says so.
//
// The other switch, "Leave this device out of the counts" (dontCount),
// sends no line at all from this device, live or kept; it also takes the
// opt-in's queue and date with it. It is how the owner keeps their own and
// their testers' plays out of the numbers, and anyone may use it. (A
// landing is counted by the Worker from the page request itself, before
// any of this runs, when the request reaches it, so it cannot reach that.)
//
// Transport: navigator.sendBeacon, which survives a closing tab, with
// fetch keepalive as the other path. Live events wait a second for
// company and go in one batch; a batch never exceeds BATCH_MAX, the most
// points the Worker writes in one invocation.
import { create } from 'zustand';
import type { Level } from '../engine/ratings';
import { useSettings } from './settings';
import { bucketOf, localDateKey } from '../content/dailies';
import { playedFrom } from './dailyStats';

export const TELEMETRY_API = '/api/t';
/** the most events one request carries: what the Worker turns into points at most */
export const BATCH_MAX = 25;
/** where the opt-in's queue and date live, only while the switch is on */
export const STORAGE_KEY = 'sudokui-telemetry-v1';
/** how long a live event waits for company before it goes, in ms */
export const BATCH_DELAY = 1000;

/** one line, as the Worker checks it (worker/telemetry.ts, checkEvent) */
export interface PlayEvent {
  event: 'started' | 'completed';
  band: Level;
  /** the time in 15-second buckets, capped like the daily's; 0 for a start */
  bucket: number;
  /** display-mode: standalone matched */
  standalone: boolean;
  version: string;
  source: 'pwa' | 'tab';
  /** kept while offline and sent later: opt-in only */
  offline?: boolean;
  /** the switch is on */
  optin?: boolean;
  /** this device had played on an earlier day: opt-in only */
  returning?: boolean;
}

/** what the opt-in keeps on the device */
interface Kept {
  queue: PlayEvent[];
  /** the local day the counting began */
  firstSeen: string | null;
}

interface TelemetryState extends Kept {
  /** live events waiting for the next send, a second at most */
  pending: PlayEvent[];
  /** a game began or was solved: sent now while online, kept with the opt-in while offline, dropped otherwise */
  track(event: 'started' | 'completed', band: Level, seconds: number): void;
  /** sends what waits: the live batch at once, then the kept queue while online and opted in */
  flush(): Promise<void>;
  /** drops the queue and the date, here and from the device */
  forget(): void;
}

const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0';

const nothing = (): Kept => ({ queue: [], firstSeen: null });

/** what the device kept, if anything readable */
function kept(): Kept {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return nothing();
    const v = JSON.parse(raw) as Partial<Kept>;
    return { queue: Array.isArray(v.queue) ? v.queue : [], firstSeen: typeof v.firstSeen === 'string' ? v.firstSeen : null };
  } catch {
    return nothing();
  }
}

function keep(state: Kept): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // no storage: the queue lives for this session only
  }
}

function drop(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to remove
  }
}

const optedIn = () => useSettings.getState().countPlays && !useSettings.getState().dontCount;
const leftOut = () => useSettings.getState().dontCount;
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Sends a batch: sendBeacon, which the browser delivers even as the tab
 * closes, else fetch with keepalive. True when the browser took the
 * beacon or the server answered 2xx; a beacon's fate past that is not
 * known, which an estimate can bear.
 */
export async function deliver(events: PlayEvent[]): Promise<boolean> {
  const body = JSON.stringify(events);
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (typeof nav?.sendBeacon === 'function') {
    try {
      if (nav.sendBeacon(TELEMETRY_API, new Blob([body], { type: 'application/json' }))) return true;
    } catch {
      // a browser that refuses the beacon still has fetch
    }
  }
  try {
    const res = await fetch(TELEMETRY_API, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body });
    return res.ok;
  } catch {
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

export const useTelemetry = create<TelemetryState>()((set, get) => ({
  // the queue and the date exist only while the switch is on
  ...(optedIn() ? kept() : nothing()),
  pending: [],

  track: (event, band, seconds) => {
    // a device left out of the counts sends nothing and keeps nothing
    if (leftOut()) return;
    const source = playedFrom();
    const e: PlayEvent = { event, band, bucket: bucketOf(seconds), standalone: source === 'pwa', version: APP_VERSION, source };
    const optin = optedIn();
    if (optin) {
      const today = localDateKey();
      const first = get().firstSeen ?? today;
      if (!get().firstSeen) {
        set({ firstSeen: first });
        keep({ queue: get().queue, firstSeen: first });
      }
      e.optin = true;
      e.returning = first < today;
    }
    if (online()) {
      set((s) => ({ pending: [...s.pending, e] }));
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          void get().flush();
        }, BATCH_DELAY);
      }
      return;
    }
    // offline without the switch: dropped, nothing kept
    if (!optin) return;
    e.offline = true;
    const queue = [...get().queue, e];
    set({ queue });
    keep({ queue, firstSeen: get().firstSeen });
  },

  flush: async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const live = get().pending;
    if (live.length) {
      // a live line is never kept: sent once, whatever comes of it
      set({ pending: [] });
      for (let i = 0; i < live.length; i += BATCH_MAX) void deliver(live.slice(i, i + BATCH_MAX));
    }
    if (flushing || !optedIn() || !online() || !get().queue.length) return;
    flushing = true;
    try {
      while (get().queue.length) {
        const chunk = get().queue.slice(0, BATCH_MAX);
        if (!(await deliver(chunk))) break;
        // the switch went off while the batch travelled: what it kept is
        // gone already, and must not be written back
        if (!optedIn()) break;
        const queue = get().queue.slice(chunk.length);
        set({ queue });
        keep({ queue, firstSeen: get().firstSeen });
      }
    } finally {
      flushing = false;
    }
  },

  forget: () => {
    set({ queue: [], firstSeen: null });
    drop();
  }
}));

// the switch going off takes the queue and the date with it, whichever
// way it was turned; so does leaving the device out, which also drops
// whatever live line was still waiting to go. The switch going on picks up
// what the device kept: nothing when it is turned on here, but when it was
// turned on in another window (settings.ts follows that one), the queue
// and the date that window kept, which this window must add to, not write
// over
useSettings.subscribe((s, prev) => {
  if (!(prev.countPlays && !prev.dontCount) && s.countPlays && !s.dontCount) useTelemetry.setState(kept());
  if (prev.countPlays && !s.countPlays) useTelemetry.getState().forget();
  if (!prev.dontCount && s.dontCount) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    useTelemetry.setState({ pending: [] });
    useTelemetry.getState().forget();
  }
});
