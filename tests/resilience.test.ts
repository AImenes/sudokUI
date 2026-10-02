/**
 * Nothing waits forever and nothing goes blank: a worker that dies settles
 * every request waiting on it and is replaced; a lazily loaded file that
 * cannot be fetched leaves the generator without seeds rather than the
 * player without a game; the app's health signals drive the update bar.
 */
import { describe, it, expect, vi } from 'vitest';

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
