/**
 * Nothing waits forever and nothing goes blank: a worker that dies settles
 * every request waiting on it and is replaced; a lazily loaded file that
 * cannot be fetched leaves the generator without seeds rather than the
 * player without a game, and the guide closed rather than the app crashed;
 * Reload reloads, with a new service worker waiting or without one; the
 * pages kept for offline use exist; the app's health signals drive the
 * update bar.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k)
};

/** a Worker that never answers, and can be made to die */
class FakeWorker extends EventTarget {
  static made: FakeWorker[] = [];
  posted: unknown[] = [];
  terminated = false;
  constructor() {
    super();
    FakeWorker.made.push(this);
  }
  postMessage(m: unknown) {
    this.posted.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  die() {
    this.dispatchEvent(new Event('error'));
  }
}
(globalThis as any).Worker = FakeWorker;

const { requestPuzzle, justifyMove } = await import('../src/state/pools');
const { parseGrid } = await import('../src/engine/board');

describe('a worker that dies', () => {
  it('settles the requests waiting on it, and the next request gets a fresh worker', async () => {
    const a = requestPuzzle({ kind: 'level', level: 'Easy' }, { urgent: true });
    const b = requestPuzzle({ kind: 'tech', tech: 'X_WING' }, { urgent: true });
    const j = justifyMove(parseGrid('.'.repeat(81))!, { cell: 0, digit: 1, placed: true });
    expect(FakeWorker.made).toHaveLength(2); // the urgent one and the background one
    const [urgent, background] = FakeWorker.made;
    expect(urgent.posted).toHaveLength(2);
    urgent.die();
    expect(await a.promise).toBeNull();
    expect(await b.promise).toBeNull();
    expect(urgent.terminated).toBe(true);
    // the background worker is untouched; the justify request still waits on it
    expect(background.terminated).toBe(false);
    background.die();
    expect(await j).toBeNull();
    // the next request spawns anew
    requestPuzzle({ kind: 'level', level: 'Easy' }, { urgent: true });
    expect(FakeWorker.made).toHaveLength(3);
    expect(FakeWorker.made[2]).not.toBe(urgent);
  });

  it('a cancel after the death is harmless', async () => {
    const a = requestPuzzle({ kind: 'level', level: 'Easy' }, { urgent: true });
    // the urgent worker spawned at the end of the test above serves this one
    FakeWorker.made.at(-1)!.die();
    expect(await a.promise).toBeNull();
    expect(() => a.handle.cancel()).not.toThrow();
  });
});

describe('files that cannot be fetched', () => {
  it('seeds: none, so the generator searches instead', async () => {
    vi.doMock('../src/content/seeds.json', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const { seedPuzzles } = await import('../src/content/seeds');
    expect(await seedPuzzles('Nightmare')).toEqual([]);
    vi.doUnmock('../src/content/seeds.json');
  });

  it('practice puzzles: none, so the generator searches instead', async () => {
    vi.doMock('../src/content/practicePuzzles.json', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const { practiceSeeds } = await import('../src/content/practicePuzzles');
    expect(await practiceSeeds('AIC')).toEqual([]);
    vi.doUnmock('../src/content/practicePuzzles.json');
  });
});

const { partOrStandIn } = await import('../src/ui/lazyPart');
const { reloadIntoLatest } = await import('../src/state/appStatus');

describe('a part of the app whose file cannot be fetched', () => {
  const Part = () => null;
  const StandIn = () => null;

  it('is the part when its file comes', async () => {
    expect(await partOrStandIn(() => Promise.resolve(Part), StandIn)()).toEqual({ default: Part });
  });

  it("is the stand-in when Vite's preload error resolved the import to nothing", async () => {
    expect(await partOrStandIn(() => Promise.resolve(undefined), StandIn)()).toEqual({ default: StandIn });
  });

  it('is the stand-in when the import fails outright, so React.lazy never throws to the crash panel', async () => {
    const load = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
    expect(await partOrStandIn(load, StandIn)()).toEqual({ default: StandIn });
  });
});

describe('Reload', () => {
  /** a service worker that can be moved through its states */
  class FakeSW extends EventTarget {
    state = 'installed';
    become(state: string) {
      this.state = state;
      this.dispatchEvent(new Event('statechange'));
    }
  }

  /** a page with this service worker API (none: undefined), which records what happens */
  function page(serviceWorker?: object) {
    const done: string[] = [];
    vi.stubGlobal('window', { location: { reload: () => done.push('reload') } });
    vi.stubGlobal('navigator', serviceWorker ? { serviceWorker } : {});
    const skipWaiting = async () => void done.push('skip waiting');
    const save = () => void done.push('save');
    return { done, skipWaiting, save };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('with no service worker (an in-app browser), saves the game and reloads at once', async () => {
    const p = page();
    await reloadIntoLatest(p.skipWaiting, p.save);
    expect(p.done).toEqual(['save', 'reload']);
  });

  it('with no worker waiting (a file failed in a first visit, or another tab took the update), reloads at once', async () => {
    const p = page({ controller: null, getRegistration: async () => ({ waiting: null, active: new FakeSW() }) });
    await reloadIntoLatest(p.skipWaiting, p.save);
    expect(p.done).toEqual(['save', 'reload']);
    const q = page({ controller: {}, getRegistration: async () => undefined });
    await reloadIntoLatest(q.skipWaiting, q.save);
    expect(q.done).toEqual(['save', 'reload']);
    const r = page({ controller: {}, getRegistration: () => Promise.reject(new Error('blocked')) });
    await reloadIntoLatest(r.skipWaiting, r.save);
    expect(r.done).toEqual(['save', 'reload']);
  });

  it('with a worker waiting on a page the old one controls, asks it to take over (the plugin reloads), and reloads anyway if it never does', async () => {
    vi.useFakeTimers();
    const waiting = new FakeSW();
    const p = page({ controller: {}, getRegistration: async () => ({ waiting }) });
    await reloadIntoLatest(p.skipWaiting, p.save, 3000);
    expect(p.done).toEqual(['save', 'skip waiting']);
    waiting.become('activated');
    expect(p.done).toEqual(['save', 'skip waiting']);
    vi.advanceTimersByTime(3000);
    expect(p.done).toEqual(['save', 'skip waiting', 'reload']);
  });

  it('with a worker waiting on a page no worker controls, reloads once it has taken over', async () => {
    const waiting = new FakeSW();
    const p = page({ controller: null, getRegistration: async () => ({ waiting }) });
    await reloadIntoLatest(p.skipWaiting, p.save, 60_000);
    expect(p.done).toEqual(['save', 'skip waiting']);
    waiting.become('activating');
    expect(p.done).toEqual(['save', 'skip waiting']);
    waiting.become('activated');
    expect(p.done).toEqual(['save', 'skip waiting', 'reload']);
  });

  it('reloads even when the game cannot be written', async () => {
    const p = page();
    await reloadIntoLatest(p.skipWaiting, () => {
      throw new Error('quota');
    });
    expect(p.done).toEqual(['reload']);
  });
});

describe('the pages kept for offline use', () => {
  it('are pages the build writes, so the service worker can install them', async () => {
    const { OFFLINE_PAGES } = await import('../src/content/staticRoutes');
    const { buildLearnPages } = await import('../src/content/learnPages');
    const urls = new Set(buildLearnPages().map((p) => p.url));
    expect(OFFLINE_PAGES).toEqual(['/privacy/', '/nb/privacy/', '/es/privacy/']);
    for (const url of OFFLINE_PAGES) expect(urls.has(url), url).toBe(true);
  });
});

describe('app status', () => {
  it('a chunk failure outranks a routine update, and dismiss clears both', async () => {
    const { useAppStatus } = await import('../src/state/appStatus');
    const s = useAppStatus.getState();
    s.setUpdateReady('update');
    expect(useAppStatus.getState()).toMatchObject({ updateReady: true, reason: 'update' });
    s.setUpdateReady('chunk');
    s.setUpdateReady('update');
    expect(useAppStatus.getState().reason).toBe('chunk');
    s.setOfflineReady();
    s.dismiss();
    expect(useAppStatus.getState()).toMatchObject({ updateReady: false, offlineReady: false });
    let reloaded = false;
    s.setReload(() => {
      reloaded = true;
    });
    useAppStatus.getState().reload();
    expect(reloaded).toBe(true);
  });
});
