/**
 * One page of the app plays at a time (src/state/play.ts, docs/architecture.md
 * "One page plays at a time"), tested without a browser: pages of one
 * browser are Play objects over one lock manager, one channel and one
 * storage, all fakes that keep the browser's rules (an exclusive lock
 * granted in turn, ifAvailable, steal, a wait called off by its signal; a
 * channel that reaches every other page, a little later). A page that
 * holds the play writes; every other page writes nothing. A page in view
 * at start-up takes the play, asking the holder, which writes first and
 * lets go; a hidden one takes it only if no page holds it, and else the
 * first time it is shown. A view shown again asks a hidden holder only. A
 * holder that does not answer has the play taken after the wait, and finds
 * out before its next write. Without Web Locks a page plays alone.
 */
import { describe, it, expect } from 'vitest';
import { Play, HOLDER_KEY, SAVES } from '../src/state/play';
import type { Locks, Channel, Store } from '../src/state/play';

const GAME = SAVES[0];

/** a lock manager of one browser: one exclusive lock per name, granted in turn */
class FakeLocks implements Locks {
  private held = new Map<string, { stolen: (e: Error) => void }>();
  private queue = new Map<string, Array<() => void>>();
  /** a page frozen as its lock is stolen hears of it only once it wakes, perhaps after its first handlers ran */
  late: (() => void)[] | null = null;
  request(name: string, options: LockOptions, callback: (lock: Lock | null) => unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const queue = this.queue.get(name) ?? [];
      this.queue.set(name, queue);
      const grant = () => {
        let over = false;
        const entry = {
          stolen: (e: Error) => {
            over = true;
            reject(e);
          }
        };
        this.held.set(name, entry);
        Promise.resolve(callback({ name, mode: 'exclusive' } as Lock)).then(
          (v) => {
            if (this.held.get(name) === entry) this.held.delete(name);
            if (!over) resolve(v);
            this.next(name);
          },
          (e) => {
            if (this.held.get(name) === entry) this.held.delete(name);
            if (!over) reject(e);
            this.next(name);
          }
        );
      };
      if (options.steal) {
        const was = this.held.get(name);
        this.held.delete(name);
        const tell = () => was?.stolen(new DOMException('stolen', 'AbortError'));
        if (this.late) this.late.push(tell);
        else tell();
        return grant();
      }
      const free = !this.held.has(name) && !queue.length;
      if (options.ifAvailable) {
        if (!free) return void Promise.resolve(callback(null)).then(resolve, reject);
        return grant();
      }
      if (free) return grant();
      queue.push(grant);
      options.signal?.addEventListener('abort', () => {
        const at = queue.indexOf(grant);
        if (at < 0) return;
        queue.splice(at, 1);
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  }
  private next(name: string) {
    if (this.held.has(name)) return;
    this.queue.get(name)?.shift()?.();
  }
  /** the page holding the lock closed: the browser lets the lock go, and the page hears nothing more */
  close(name: string) {
    this.held.delete(name);
    this.next(name);
  }
}

/** a channel between the pages of one browser: each message reaches every other page, a little later; a frozen page hears nothing */
class Hub {
  ends: { channel: Channel; frozen: () => boolean }[] = [];
  open(frozen: () => boolean): Channel {
    const channel: Channel = {
      onmessage: null,
      postMessage: (data) => {
        for (const end of this.ends)
          if (end.channel !== channel)
            setTimeout(() => {
              if (!end.frozen()) end.channel.onmessage?.({ data } as MessageEvent);
            }, 1);
      }
    };
    this.ends.push({ channel, frozen });
    return channel;
  }
}

class Browser {
  locks = new FakeLocks();
  hub = new Hub();
  data = new Map<string, string>();
  storage: Store = {
    getItem: (k) => this.data.get(k) ?? null,
    setItem: (k, v) => void this.data.set(k, v),
    removeItem: (k) => void this.data.delete(k)
  };
  /** a page of the app, in view or hidden; frozen, it hears nothing */
  page(name: string, { hidden = false } = {}) {
    const state = { hidden, frozen: false, gave: 0, taken: [] as boolean[], lost: 0, gives: `${name} gave` };
    const play: Play = new Play({
      locks: this.locks,
      channel: () => this.hub.open(() => state.frozen),
      storage: () => this.storage,
      hidden: () => state.hidden,
      id: name,
      wait: 40
    });
    const save = play.storage();
    play.hooks = {
      // as the app does: its state written before it lets go
      give: () => {
        state.gave++;
        save.setItem(GAME, state.gives);
      },
      taken: (changed) => void state.taken.push(changed),
      lost: () => void state.lost++
    };
    // the page read the save as it started
    save.getItem(GAME);
    return { play, state, save, write: (v: string) => save.setItem(GAME, v) };
  }
}

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

describe('one page plays at a time', () => {
  it('a page alone takes the play at start-up and writes', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    expect(a.play.role).toBe('player');
    expect(b.data.get(HOLDER_KEY)).toBe('a');
    a.write('a moved');
    expect(b.data.get(GAME)).toBe('a moved');
    expect(a.state.taken).toEqual([false]);
  });

  it('a page in view at start-up takes the play from the holder, which writes first, lets go and writes nothing more', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.write('a moved');
    const c = b.page('c');
    await c.play.boot();
    expect(c.play.role).toBe('player');
    expect(a.play.role).toBe('view');
    expect(a.state.gave).toBe(1);
    expect(a.state.lost).toBe(1);
    // what the holder wrote as it let go is what the new page reads: changed since it started
    expect(c.state.taken).toEqual([true]);
    expect(b.data.get(GAME)).toBe('a gave');
    a.write('a again');
    expect(b.data.get(GAME)).toBe('a gave');
    c.write('c moved');
    expect(b.data.get(GAME)).toBe('c moved');
  });

  it('a page that comes up hidden while another plays is a view and writes nothing, and takes the play the first time it is shown, from a holder in view too', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const h = b.page('h', { hidden: true });
    await h.play.boot();
    expect(h.play.role).toBe('view');
    expect(a.play.role).toBe('player');
    h.write('h moved');
    expect(b.data.get(GAME)).toBeUndefined();
    h.state.hidden = false;
    expect(await h.play.shown()).toBe('held');
    expect(a.play.role).toBe('view');
    expect(h.play.role).toBe('player');
  });

  it('a page that comes up hidden with no page playing takes the play', async () => {
    const b = new Browser();
    const h = b.page('h', { hidden: true });
    await h.play.boot();
    expect(h.play.role).toBe('player');
  });

  it('a view shown again takes the play back from a hidden holder, but not from one in view: then it stays a view, until Play here', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const c = b.page('c');
    await c.play.boot();
    expect(a.play.role).toBe('view');
    // two windows side by side: a is shown again, c is in view
    expect(await a.play.shown()).toBe('busy');
    expect(a.play.role).toBe('view');
    expect(c.play.role).toBe('player');
    expect(c.state.gave).toBe(0);
    // the player switched tabs in one window: c is hidden now
    c.state.hidden = true;
    expect(await a.play.shown()).toBe('held');
    expect(a.play.role).toBe('player');
    expect(c.play.role).toBe('view');
    expect(c.state.gave).toBe(1);
    // and Play here takes it from a holder in view
    c.state.hidden = false;
    expect(await c.play.here()).toBe('held');
    expect(a.play.role).toBe('view');
  });

  it('a page takes back the play with nothing changed since it last wrote: it is told so, and goes on as it is; with a change, it is told that', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.write('a won');
    // a won game is written the same as long as nothing happens to it
    a.state.gives = 'a won';
    const c = b.page('c');
    c.state.gives = 'a won';
    await c.play.boot();
    expect(c.state.taken).toEqual([false]);
    // the player switches back: c is hidden, a shown
    c.state.hidden = true;
    expect(await a.play.shown()).toBe('held');
    expect(a.state.taken).toEqual([false, false]);
    // a move made in c meanwhile is a change
    c.state.hidden = false;
    expect(await c.play.here()).toBe('held');
    c.write('c moved');
    c.state.gives = 'c moved';
    c.state.hidden = true;
    expect(await a.play.shown()).toBe('held');
    expect(a.state.taken).toEqual([false, false, true]);
  });

  it('the holder closed: the view takes the play when shown, at once', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const c = b.page('c');
    await c.play.boot();
    // c closes: the browser lets its lock go
    c.state.frozen = true;
    b.locks.close('sudokui-play');
    const start = Date.now();
    expect(await a.play.shown()).toBe('held');
    expect(Date.now() - start).toBeLessThan(30);
  });

  it('a frozen holder has the play taken after the wait, and once it wakes it writes nothing: another page’s name is in storage', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.state.frozen = true;
    b.locks.late = [];
    const c = b.page('c');
    const start = Date.now();
    await c.play.boot();
    expect(Date.now() - start).toBeGreaterThanOrEqual(35);
    expect(c.play.role).toBe('player');
    expect(b.data.get(HOLDER_KEY)).toBe('c');
    expect(a.state.gave).toBe(0);
    c.write('c moved');
    // a wakes, and runs a handler before it hears that its lock went:
    // the write is refused, and it is a view
    a.state.frozen = false;
    expect(a.play.role).toBe('player');
    a.write('a woke');
    expect(b.data.get(GAME)).toBe('c moved');
    expect(a.play.role).toBe('view');
    await tick();
    expect(a.state.lost).toBe(1);
    // the browser's word comes after: nothing more happens
    for (const tell of b.locks.late) tell();
    await tick();
    expect(a.state.lost).toBe(1);
    expect(c.play.role).toBe('player');
  });

  it('a holder whose lock was taken from it is a view, even before it writes', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.state.frozen = true;
    const c = b.page('c');
    await c.play.boot();
    await tick();
    // the browser told it the lock went (the request's promise)
    expect(a.play.role).toBe('view');
    expect(a.play.mayWrite()).toBe(false);
  });

  it('a page reloading writes nothing more', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.play.leave();
    a.write('after');
    expect(b.data.get(GAME)).toBeUndefined();
  });

  it('a page going into the back-forward cache gives the play up as asked would, so the next page does not wait', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.play.away();
    expect(a.state.gave).toBe(1);
    a.state.frozen = true;
    const c = b.page('c');
    const start = Date.now();
    await c.play.boot();
    expect(Date.now() - start).toBeLessThan(30);
    expect(c.play.role).toBe('player');
  });

  it('without Web Locks every page plays as one window does: no wait, no view', async () => {
    const data = new Map<string, string>();
    const storage: Store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
    const page = () => new Play({ locks: null, channel: () => null, storage: () => storage, hidden: () => false });
    const a = page();
    const c = page();
    await a.boot();
    await c.boot();
    expect(a.role).toBe('solo');
    expect(c.role).toBe('solo');
    a.storage().setItem(GAME, 'a');
    c.storage().setItem(GAME, 'c');
    expect(data.get(GAME)).toBe('c');
    expect(data.has(HOLDER_KEY)).toBe(false);
  });
});
