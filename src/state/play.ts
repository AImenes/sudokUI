// One page of the app plays at a time (docs/architecture.md, "One page
// plays at a time"): of every tab and window of the app open in this
// browser, only the page that holds the play writes the game save, the
// record and the dailies' save; every other open page is a view that
// writes nothing, behind a cover with Play here (src/ui/App.tsx). The play
// is a Web Lock (navigator.locks), so a page that closes or crashes lets
// go of it by itself. A page that wants it asks the holder over a
// BroadcastChannel: the holder writes its state, its clock included, lets
// go and becomes a view; a holder that does not answer (a frozen or
// discarded tab) has it taken after WAIT_MS. A holder that closes says so,
// and a page in view then takes the play unless a page reloading took it
// back first (GONE_MS). Nothing here leaves the device: the holder's page
// name (a random string) is kept in this browser's storage, so a page that
// wakes after losing the play while it was frozen sees at once, before it
// writes, that it no longer holds it. Without Web Locks every page plays
// as one window does.
import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';

/** the lock and the channel the app's pages share */
export const PLAY_NAME = 'sudokui-play';
/** where the holder keeps its page name, in this browser's storage */
export const HOLDER_KEY = 'sudokui-play';
/** the saves only the page that plays writes */
export const SAVES = ['sudokui-game-v1', 'sudokui-stats-v1', 'sudokui-daily-v1'] as const;
/** how long the holder is given to answer before the play is taken from it */
export const WAIT_MS = 1500;
/** how long a page in view waits, once the holder said it closes, before it takes the play: a page reloading takes it back itself within it */
export const GONE_MS = 1000;

/**
 * What this page is: waiting for its first claim (before the first
 * render), the page that plays, a view, a page on its way out (a reload:
 * it writes nothing more), or alone because the browser has no Web Locks
 * (it plays as one window does)
 */
export type Role = 'waiting' | 'player' | 'view' | 'leaving' | 'solo';

/** the part of navigator.locks this needs */
export interface Locks {
  request(name: string, options: LockOptions, callback: (lock: Lock | null) => unknown): Promise<unknown>;
}

/** the part of a BroadcastChannel this needs */
export interface Channel {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

/** what a page reads and writes the saves through */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PlayDeps {
  /** navigator.locks, or null where there is none */
  locks: Locks | null;
  /** a channel to the app's other pages, or null */
  channel: () => Channel | null;
  storage: () => Store | null;
  hidden: () => boolean;
  id?: string;
  wait?: number;
  /** GONE_MS */
  gone?: number;
}

/** what the app does as the play comes and goes (src/main.tsx) */
export interface PlayHooks {
  /** this page is about to let go: write its state, its clock included (setAway(true) and a write of the game) */
  give(): void;
  /**
   * this page holds the play now (or, holding it, found a save written
   * outside the play); `changed`: a save differs from what it last wrote or
   * read; `back`: it came back from the back-forward cache (Back or Forward)
   */
  taken(changed: boolean, back: boolean): void;
  /** this page let go of the play, or had it taken: it is a view; `away`: it went into the back-forward cache */
  lost(away: boolean): void;
}

type Want = { want: string; ask: number; ifHidden: boolean };
/**
 * want: a page asks for the play; busy: the holder in view keeps it; free:
 * the holder that kept it from a page in view is hidden now; gone: the
 * holder closed, or left for another page
 */
type Message = Want | { busy: string; ask: number } | { free: string } | { gone: string };

const randomId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* an old browser: Math.random below */
  }
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

/**
 * The play, for one page. The app has one (`play`, below); the tests make
 * several over one fake lock manager, channel and storage, as pages of
 * one browser.
 */
export class Play {
  role: Role;
  readonly id: string;
  /** an attempt to take the play is under way (the cover stays down meanwhile) */
  taking = false;
  /** this page has held the play (a page shown again asks only a hidden holder for it) */
  everHeld = false;
  hooks: PlayHooks = { give: () => {}, taken: () => {}, lost: () => {} };
  /** told whenever role or taking changes (the UI's store) */
  onChange: () => void = () => {};

  private readonly wait: number;
  private readonly goneWait: number;
  private goneTimer: ReturnType<typeof setTimeout> | null = null;
  /** asks heard while this page was taking the play itself, answered once it holds it */
  private wants: { m: Want; at: number }[] = [];
  /** this holder kept the play from a page in view since it was last hidden */
  private refused = false;
  /** this page went into the back-forward cache, and has not held the play since */
  private cached = false;
  private grant: { release: () => void } | null = null;
  private channel: Channel | null = null;
  private asks = 0;
  private busy: ((ask: number) => void) | null = null;
  private pending: Promise<'held' | 'busy'> | null = null;
  /** the holder's name could not be written (storage full or blocked): writes are not held to it */
  private nameless = false;
  /** each save as this page last wrote or read it */
  private readonly seen = new Map<string, string | null>();

  constructor(private readonly deps: PlayDeps) {
    this.id = deps.id ?? randomId();
    this.wait = deps.wait ?? WAIT_MS;
    this.goneWait = deps.gone ?? GONE_MS;
    this.role = deps.locks ? 'waiting' : 'solo';
  }

  /** this page may act on the game: it holds the play, or plays alone */
  acts(): boolean {
    return this.role === 'player' || this.role === 'solo';
  }

  /**
   * This page may write the saves now: it holds the play, and the holder's
   * name in storage is still its own. A page that finds another's there
   * lost the play while it could not hear (frozen): it is a view from now.
   */
  mayWrite(): boolean {
    if (this.role === 'solo') return true;
    if (this.role !== 'player') return false;
    let holder: string | null = null;
    try {
      holder = this.deps.storage()?.getItem(HOLDER_KEY) ?? null;
    } catch {
      return false;
    }
    if (holder === this.id || this.nameless) return true;
    this.lose();
    return false;
  }

  /** a save read through this page (persist's storage): what it now knows the save to be */
  read(key: string, value: string | null) {
    this.seen.set(key, value);
  }

  /** a save as this page last wrote or read it (undefined: never) */
  last(key: string): string | null | undefined {
    return this.seen.get(key);
  }

  /** whether a save differs from what this page last wrote or read */
  changed(): boolean {
    const store = this.deps.storage();
    if (!store) return false;
    return SAVES.some((key) => {
      if (!this.seen.has(key)) return false;
      try {
        return store.getItem(key) !== this.seen.get(key);
      } catch {
        return false;
      }
    });
  }

  /** the saves this page reads differently now (to read them again) */
  changedSaves(): string[] {
    const store = this.deps.storage();
    if (!store) return [];
    return SAVES.filter((key) => {
      try {
        return store.getItem(key) !== (this.seen.get(key) ?? null);
      } catch {
        return false;
      }
    });
  }

  /**
   * The storage the persisted stores use for the saves: it reads as
   * localStorage does, noting what it read, and writes only while this page
   * may (mayWrite).
   */
  storage(): StateStorage {
    return {
      getItem: (name) => {
        let value: string | null = null;
        try {
          value = this.deps.storage()?.getItem(name) ?? null;
        } catch {
          value = null;
        }
        this.read(name, value);
        return value;
      },
      setItem: (name, value) => {
        if (!this.mayWrite()) return;
        this.deps.storage()?.setItem(name, value);
        this.read(name, value);
      },
      removeItem: (name) => {
        if (!this.mayWrite()) return;
        this.deps.storage()?.removeItem(name);
        this.read(name, null);
      }
    };
  }

  /**
   * At start-up, before the first render. A page in view takes the play
   * (the player opened it: a new tab, a link from a chat app, a reload),
   * from the holder if another page has it. A page that comes up hidden
   * takes it only when no page holds it; otherwise it is a view until it
   * is first shown (shown). A page that reloaded itself to take the play
   * back (`again`: src/main.tsx) takes it as a page shown again does, from
   * no page or a hidden one: a reload never takes it from the window the
   * player is in.
   */
  async boot(again = false): Promise<void> {
    if (!this.deps.locks) return;
    this.listen();
    if (again) this.everHeld = true;
    if (this.deps.hidden()) {
      if (await this.request({ ifAvailable: true })) return void this.held();
      this.become('view');
      // shown while it asked: it takes the play as a page shown does
      if (!this.deps.hidden()) await this.take(this.everHeld);
      return;
    }
    await this.take(again);
  }

  /**
   * The page is shown again. A view that has never played takes the play,
   * as at start-up; one that has asks for it, and the holder gives it only
   * if it is hidden itself (the player switched tabs in one window): beside
   * a holder in view (two windows side by side) it stays a view, with Play
   * here. A page come back from the back-forward cache takes it as a page
   * that starts does: the player went Back or Forward to it. A holder whose
   * name was replaced while it could not hear (frozen) finds out now and
   * asks as a view; one that finds a save written outside the play (a tab
   * of an older build, a page without Web Locks) reads the saves again, as
   * a page given the play does (taken).
   */
  shown(): Promise<'held' | 'busy'> | null {
    if (this.role === 'player' && this.mayWrite()) {
      if (this.changed()) this.hooks.taken(true, false);
      return null;
    }
    if (this.role !== 'view') return null;
    return this.take(this.everHeld && !this.cached);
  }

  /** the page is hidden: a holder that kept the play from a page in view tells it that it can have it now */
  hide() {
    if (this.role !== 'player' || !this.refused) return;
    this.refused = false;
    this.post({ free: this.id });
  }

  /** Play here, on the cover: the play comes to this page, as at start-up */
  here(): Promise<'held' | 'busy'> {
    return this.take(false);
  }

  /**
   * The page goes into the browser's back-forward cache (pagehide with
   * `persisted`): it gives the play up as a holder asked for it would, so
   * the next page does not wait for a page that cannot answer.
   */
  away() {
    this.cached = true;
    if (this.role !== 'player' || !this.grant) return;
    this.give(true);
    this.post({ gone: this.id });
  }

  /**
   * The page closes, or leaves for another (pagehide, not into the
   * back-forward cache): a page in view is told, and takes the play unless
   * a page takes it back meanwhile (a reload of this one)
   */
  gone() {
    if (this.role === 'player') this.post({ gone: this.id });
  }

  /** this page reloads: it writes nothing more, and the lock goes with it */
  leave() {
    if (this.role === 'solo') return;
    this.become('leaving');
  }

  /**
   * Asks for the play: at once when no page holds it; otherwise the holder
   * is asked over the channel (it writes, then lets go), and one that does
   * not answer within `wait` has it taken (steal: a frozen or discarded
   * tab). With `ifHidden`, a holder in view keeps it and says so ('busy').
   */
  private take(ifHidden: boolean): Promise<'held' | 'busy'> {
    if (this.acts()) return Promise.resolve('held');
    if (this.pending) return this.pending;
    this.setTaking(true);
    this.pending = (async (): Promise<'held' | 'busy'> => {
      try {
        if (await this.request({ ifAvailable: true })) return this.held();
        const ask = ++this.asks;
        const abort = typeof AbortController === 'function' ? new AbortController() : null;
        // the request waiting behind the holder: once the answer is in, a
        // grant that comes too late is let go at once
        let over = false;
        const outcome = await new Promise<'held' | 'busy' | 'late'>((settle) => {
          const timer = setTimeout(() => settle('late'), this.wait);
          const done = (how: 'held' | 'busy' | 'late') => {
            clearTimeout(timer);
            settle(how);
          };
          this.busy = (n) => n === ask && done('busy');
          void this.request(abort ? { signal: abort.signal } : {}, () => !over).then((got) => got && done('held'));
          this.post({ want: this.id, ask, ifHidden });
        });
        over = true;
        this.busy = null;
        // granted as the answer came (the lock is this page's all the same)
        if (outcome === 'held' || this.grant) return this.held();
        abort?.abort();
        if (outcome === 'busy') {
          this.become('view');
          return 'busy';
        }
        // no answer: the holder is frozen, or went without letting go
        if (await this.request({ steal: true })) return this.held();
        this.become('view');
        return 'busy';
      } finally {
        this.pending = null;
        this.setTaking(false);
      }
    })();
    return this.pending;
  }

  /** the lock is this page's: its name goes into storage, and the app is told whether the saves changed meanwhile */
  private held(): 'held' {
    try {
      this.deps.storage()?.setItem(HOLDER_KEY, this.id);
      this.nameless = false;
    } catch {
      // storage full or blocked: the lock alone says who plays
      this.nameless = true;
    }
    const changed = this.changed();
    const back = this.cached;
    this.cached = false;
    this.everHeld = true;
    this.become('player');
    this.hooks.taken(changed, back);
    // the pages that asked meanwhile are answered now, as any ask is: so
    // none of them waits and then takes it from a page in view
    const wants = this.wants.splice(0);
    if (wants.length)
      queueMicrotask(() => {
        for (const { m, at } of wants) if (Date.now() - at < this.wait && this.role === 'player' && this.grant) this.answer(m);
      });
    return 'held';
  }

  /** asked for the play: the state is written, the lock let go, and this page is a view */
  private give(away = false) {
    try {
      this.hooks.give();
    } catch {
      /* whatever failed, the play still goes */
    }
    const grant = this.grant;
    this.grant = null;
    this.refused = false;
    this.become('view');
    grant?.release();
    this.hooks.lost(away);
  }

  /** an ask, answered: a holder in view keeps the play from a page shown again, any other ask is given it */
  private answer(m: Want) {
    if (m.ifHidden && !this.deps.hidden()) {
      this.refused = true;
      return this.post({ busy: m.want, ask: m.ask });
    }
    this.give();
  }

  /** the play was taken from this page (stolen, or another's name in storage): a view, writing nothing */
  private lose() {
    if (this.role !== 'player') return;
    const grant = this.grant;
    this.grant = null;
    this.become('view');
    grant?.release();
    // not within the write that found it out
    queueMicrotask(() => this.hooks.lost(false));
  }

  /**
   * One request for the lock. True once it is held (until released, or
   * stolen: then lose); false when it was not available (ifAvailable),
   * the wait was called off, or the browser refused.
   */
  private request(options: LockOptions, wanted: () => boolean = () => true): Promise<boolean> {
    const locks = this.deps.locks;
    if (!locks) return Promise.resolve(false);
    return new Promise<boolean>((answer) => {
      let mine: { release: () => void } | null = null;
      let asked: Promise<unknown>;
      try {
        asked = locks.request(PLAY_NAME, { mode: 'exclusive', ...options }, (lock) => {
          if (!lock || !wanted()) return void answer(false);
          return new Promise<void>((release) => {
            mine = { release };
            this.grant = mine;
            answer(true);
          });
        });
      } catch {
        // the browser refused the request: the page goes on as a view rather than hang
        return answer(false);
      }
      asked.then(
        () => {
          if (mine && this.grant === mine) this.grant = null;
        },
        () => {
          if (!mine) return answer(false);
          if (this.grant === mine) this.lose();
        }
      );
    });
  }

  private listen() {
    if (this.channel) return;
    try {
      this.channel = this.deps.channel();
    } catch {
      this.channel = null;
    }
    if (!this.channel) return;
    this.channel.onmessage = (e: MessageEvent) => this.heard(e.data as Message | null);
  }

  private heard(m: Message | null) {
    if (!m || typeof m !== 'object') return;
    if ('want' in m && typeof m.want === 'string' && m.want !== this.id) {
      // asked while this page is taking the play itself: answered once it holds it
      if (this.pending && this.role !== 'player') return void this.wants.push({ m, at: Date.now() });
      if (this.role !== 'player' || !this.grant) return;
      this.answer(m);
    } else if ('busy' in m && m.busy === this.id) {
      this.busy?.(m.ask);
    } else if ('free' in m && typeof m.free === 'string' && m.free !== this.id) {
      // the holder that kept the play from this page in view is hidden now
      if (this.role === 'view' && !this.deps.hidden() && !this.pending) void this.take(true);
    } else if ('gone' in m && typeof m.gone === 'string' && m.gone !== this.id) {
      // the holder closed: a page in view takes the play, unless a page
      // took it back meanwhile (a reload of that one), which keeps it
      if (this.role !== 'view' || this.deps.hidden()) return;
      if (this.goneTimer) clearTimeout(this.goneTimer);
      this.goneTimer = setTimeout(() => {
        this.goneTimer = null;
        if (this.role === 'view' && !this.deps.hidden() && !this.pending) void this.take(true);
      }, this.goneWait);
    }
  }

  private post(m: Message) {
    try {
      this.channel?.postMessage(m);
    } catch {
      /* the channel closed: the wait then decides */
    }
  }

  private become(role: Role) {
    if (this.role === role) return;
    this.role = role;
    this.onChange();
  }

  private setTaking(taking: boolean) {
    if (this.taking === taking) return;
    this.taking = taking;
    this.onChange();
  }
}

/** this browser's storage, or null where it cannot be had */
const local = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const locks: Locks | null =
  typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function'
    ? (navigator.locks as unknown as Locks)
    : null;

/** this page's play */
export const play = new Play({
  locks,
  channel: () => (typeof BroadcastChannel === 'function' ? new BroadcastChannel(PLAY_NAME) : null),
  storage: local,
  hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
});

/** this page has acted on the game: its start-up (App's boot) has run, so a save changed meanwhile is a reason to reload, not just to read it again */
let actedYet = false;
export const acted = () => actedYet;
export function markActed() {
  actedYet = true;
}

/** what the page shows of it: the cover, while a view in view (src/ui/App.tsx) */
export const usePlay = create<{ role: Role; taking: boolean; hidden: boolean }>(() => ({
  role: play.role,
  taking: play.taking,
  hidden: typeof document !== 'undefined' && document.visibilityState === 'hidden'
}));
play.onChange = () => usePlay.setState({ role: play.role, taking: play.taking });

/**
 * Starts the play at start-up (src/main.tsx): claims it (`again`: the page
 * reloaded itself to take it back, Play.boot), and follows the page being
 * shown (a view then asks for it) or hidden, going into the back-forward
 * cache (it gives it up) and coming back from it, and closing.
 */
export function startPlay(again = false): Promise<void> {
  if (typeof window !== 'undefined' && locks) {
    const onShown = () => {
      const hidden = document.visibilityState === 'hidden';
      // the cover never shows to a page nobody sees, nor flashes up as a
      // page shown again takes the play back: the attempt starts first
      if (hidden) play.hide();
      else void play.shown();
      usePlay.setState({ hidden });
    };
    document.addEventListener('visibilitychange', onShown);
    window.addEventListener('pageshow', onShown);
    window.addEventListener('pagehide', (e) => {
      if (e.persisted) play.away();
      else play.gone();
    });
  }
  return play.boot(again);
}
