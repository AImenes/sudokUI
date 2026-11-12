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
  /** which locks are held and asked for, as navigator.locks.query() says */
  async query(): Promise<LockManagerSnapshot> {
    return {
      held: [...this.held.keys()].map((name) => ({ name, mode: 'exclusive' as const })),
      pending: [...this.queue.entries()].flatMap(([name, q]) => q.map(() => ({ name, mode: 'exclusive' as const })))
    };
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
    const state = { hidden, frozen: false, gave: 0, taken: [] as boolean[], back: [] as boolean[], lost: 0, gives: `${name} gave` };
    const play: Play = new Play({
      locks: this.locks,
      channel: () => this.hub.open(() => state.frozen),
      storage: () => this.storage,
      hidden: () => state.hidden,
      id: name,
      wait: 40,
      gone: 30,
      settle: 30
    });
    const save = play.storage();
    play.hooks = {
      // as the app does: its state written before it lets go
      give: () => {
        state.gave++;
        save.setItem(GAME, state.gives);
      },
      taken: (changed, back) => {
        state.taken.push(changed);
        state.back.push(back);
      },
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

  it('the holder closed beside a view in view: the view takes the play after the wait, by itself; of two views in view, one', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const d = b.page('d');
    await d.play.boot();
    const c = b.page('c');
    await c.play.boot();
    expect([a.play.role, d.play.role, c.play.role]).toEqual(['view', 'view', 'player']);
    const takes = a.state.taken.length + d.state.taken.length;
    // c closes (pagehide): it says so, and the browser lets its lock go
    c.play.gone();
    c.state.frozen = true;
    b.locks.close('sudokui-play');
    await tick(100);
    expect([a.play.role, d.play.role].sort()).toEqual(['player', 'view']);
    expect(a.state.taken.length + d.state.taken.length).toBe(takes + 1);
  });

  it('the holder reloading beside a view in view: the reloaded page takes the play back within the wait, and the view stays a view', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const c = b.page('c');
    await c.play.boot();
    c.play.gone();
    c.state.frozen = true;
    b.locks.close('sudokui-play');
    // the same tab's new document, a moment later
    const c2 = b.page('c2');
    await c2.play.boot();
    await tick(100);
    expect(c2.play.role).toBe('player');
    expect(a.play.role).toBe('view');
    expect(a.state.taken).toEqual([false]);
  });

  it('a holder in view that kept the play from a page shown again tells it once it is hidden itself, and that page takes it', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const c = b.page('c');
    await c.play.boot();
    // a is shown before c knows it is hidden: c keeps it
    expect(await a.play.shown()).toBe('busy');
    c.state.hidden = true;
    c.play.hide();
    await tick(100);
    expect(a.play.role).toBe('player');
    expect(c.play.role).toBe('view');
  });

  it('a holder hidden says so every time: a view in view that it took the play from takes it after the moment, a hidden view does not', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const h = b.page('h');
    await h.play.boot();
    h.state.hidden = true;
    h.play.hide();
    // two windows side by side: c took the play from a at its own start, and nobody asked it
    const c = b.page('c');
    await c.play.boot();
    expect([a.play.role, h.play.role, c.play.role]).toEqual(['view', 'view', 'player']);
    // c's window minimised: a, the only page in view, takes the play; h, hidden, does not
    c.state.hidden = true;
    c.play.hide();
    await tick(100);
    expect(a.play.role).toBe('player');
    expect(h.play.role).toBe('view');
    expect(c.play.role).toBe('view');
  });

  it('a holder hidden as the player turns to another tab in its window: that tab takes the play, and a window beside it in view stays a view', async () => {
    const b = new Browser();
    const d = b.page('d');
    await d.play.boot();
    const t = b.page('t');
    await t.play.boot();
    t.state.hidden = true;
    t.play.hide();
    const a = b.page('a');
    await a.play.boot();
    await tick(100);
    expect([d.play.role, t.play.role, a.play.role]).toEqual(['view', 'view', 'player']);
    // a hidden as its window shows t: t is shown at once, d (another window, in view) hears a is hidden
    a.state.hidden = true;
    a.play.hide();
    t.state.hidden = false;
    expect(await t.play.shown()).toBe('held');
    await tick(100);
    expect([d.play.role, t.play.role, a.play.role]).toEqual(['view', 'player', 'view']);
  });

  it('a view in view whose window gets the focus asks as one shown again does: from a hidden holder or none it takes the play, beside one in view it stays a view, and Play here then still hands over', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const c = b.page('c');
    await c.play.boot();
    expect(a.play.role).toBe('view');
    // c in view beside it: a stays a view
    a.play.focused();
    await tick(100);
    expect([a.play.role, c.play.role]).toEqual(['view', 'player']);
    // Play here pressed as the focus came: the play comes to a all the same
    a.play.focused();
    expect(await a.play.here()).toBe('held');
    expect([a.play.role, c.play.role]).toEqual(['player', 'view']);
    // a's renderer crashes in view: the browser lets its lock go, and no word comes
    c.state.hidden = true;
    c.state.hidden = false;
    expect(await c.play.here()).toBe('held');
    c.state.frozen = true;
    b.locks.close('sudokui-play');
    a.play.focused();
    await tick(100);
    expect(a.play.role).toBe('player');
    // a page that has never played leaves the focus alone (being shown decides for it)
    const h = b.page('h', { hidden: true });
    await h.play.boot();
    h.state.hidden = false;
    h.play.focused();
    await tick(100);
    expect(h.play.role).toBe('view');
  });

  it('a holder that went without a word (its renderer crashed): a view in view finds no page holds the play and takes it after the moment; while one holds it, or hidden, it does nothing', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const c = b.page('c');
    await c.play.boot();
    await a.play.check();
    expect([a.play.role, c.play.role]).toEqual(['view', 'player']);
    c.state.frozen = true;
    b.locks.close('sudokui-play');
    a.state.hidden = true;
    await a.play.check();
    expect(a.play.role).toBe('view');
    a.state.hidden = false;
    await a.play.check();
    await tick(20);
    expect(a.play.role).toBe('player');
  });

  it('a lock the browser refuses (site data blocked), thrown or rejected: the page plays alone, with no cover, and Play here has nothing to do', async () => {
    const data = new Map<string, string>();
    const storage: Store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
    const denied = () => Object.assign(new Error('The request was denied.'), { name: 'SecurityError' });
    const thrown = new Play({ locks: { request: () => { throw denied(); } }, channel: () => null, storage: () => storage, hidden: () => false, wait: 20 });
    await thrown.boot();
    expect(thrown.role).toBe('solo');
    expect(thrown.acts()).toBe(true);
    expect(await thrown.here()).toBe('held');
    const rejected = new Play({ locks: { request: () => Promise.reject(denied()) }, channel: () => null, storage: () => storage, hidden: () => true, wait: 20 });
    await rejected.boot();
    expect(rejected.role).toBe('solo');
    expect(rejected.acts()).toBe(true);
    rejected.storage().setItem(GAME, 'alone');
    expect(data.get(GAME)).toBe('alone');
  });

  it('two views shown at once while the holder is hidden: one takes it, the other hears no from it rather than taking it from a page in view', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const d = b.page('d');
    await d.play.boot();
    const c = b.page('c');
    await c.play.boot();
    c.state.hidden = true;
    const gave = { a: a.state.gave, d: d.state.gave };
    const [ra, rd] = await Promise.all([a.play.shown(), d.play.shown()]);
    expect([ra, rd].sort()).toEqual(['busy', 'held']);
    await tick(100);
    const held = ra === 'held' ? a : d;
    const other = ra === 'held' ? d : a;
    expect(held.play.role).toBe('player');
    expect(other.play.role).toBe('view');
    // the one that took it gave nothing: the other was told no, and did not take it
    expect(held.state.gave).toBe(gave[held === a ? 'a' : 'd']);
  });

  it('a holder shown again that finds a save written outside the play (a tab of an older build) is told, as a page given the play is', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.write('a moved');
    a.state.hidden = true;
    expect(a.play.shown()).toBeNull();
    expect(a.state.taken).toEqual([false]);
    // an old tab writes the save, which goes round the play
    b.data.set(GAME, 'old tab moved');
    a.state.hidden = false;
    expect(a.play.shown()).toBeNull();
    expect(a.state.taken).toEqual([false, true]);
  });

  it('a holder whose name was replaced while it was frozen, shown again, is a view and takes the play back from the hidden holder', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.state.frozen = true;
    b.locks.late = [];
    const c = b.page('c');
    await c.play.boot();
    c.state.hidden = true;
    // a wakes and is shown before the browser's word of the steal
    a.state.frozen = false;
    expect(a.play.role).toBe('player');
    expect(await a.play.shown()).toBe('held');
    expect(a.play.role).toBe('player');
    expect(c.play.role).toBe('view');
    for (const tell of b.locks.late) tell();
  });

  it('a page that reloaded itself to take the play back takes it as a page shown again does: not from a holder in view', async () => {
    const b = new Browser();
    const c = b.page('c');
    await c.play.boot();
    const a = b.page('a');
    await a.play.boot(true);
    expect(a.play.role).toBe('view');
    expect(c.play.role).toBe('player');
    c.state.hidden = true;
    expect(await a.play.shown()).toBe('held');
  });

  it('a page Play here reloaded takes the play as a page that starts does: from a window beside it in view that took it meanwhile too', async () => {
    const b = new Browser();
    const c = b.page('c');
    await c.play.boot();
    const a = b.page('a');
    await a.play.boot(true, true);
    expect(a.play.role).toBe('player');
    expect(c.play.role).toBe('view');
    expect(c.state.gave).toBe(1);
  });

  it('shown again and told no by a holder in view, a page draws no cover for a moment: the holder hidden within it, it takes the play, never shown as a view', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const c = b.page('c');
    await c.play.boot();
    // what the cover is drawn by: a view that is not taking the play
    const covered: boolean[] = [];
    a.play.onChange = () => covered.push(a.play.role === 'view' && !a.play.taking);
    // a shown before c's hide comes: told no, it waits a moment
    expect(await a.play.shown()).toBe('busy');
    expect(a.play.role).toBe('view');
    expect(a.play.taking).toBe(true);
    c.state.hidden = true;
    c.play.hide();
    await tick(100);
    expect(a.play.role).toBe('player');
    expect(covered).not.toContain(true);
    // c shown again beside a in view, told no with nothing after it: the cover comes once the moment is over
    c.state.hidden = false;
    expect(await c.play.shown()).toBe('busy');
    expect(c.play.taking).toBe(true);
    await tick(60);
    expect(c.play.role).toBe('view');
    expect(c.play.taking).toBe(false);
  });

  it('a page in view reloading to start from the saves keeps the play from a window beside it that asks, which stays a view; the reloaded page takes it back', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    const c = b.page('c');
    await c.play.boot();
    // c, in view, reloads (it came back to a game another page played on)
    c.play.leave();
    // a, a view in view beside it, asks as one shown again does (its window got the focus, or the holder's gone)
    a.play.focused();
    await tick(100);
    expect(a.play.role).toBe('view');
    expect(a.state.taken).toEqual([false]);
    // the reloaded page: the lock went with the old one
    c.state.frozen = true;
    b.locks.close('sudokui-play');
    const c2 = b.page('c2');
    await c2.play.boot(true);
    expect(c2.play.role).toBe('player');
    expect(a.play.role).toBe('view');
  });

  it('a page come back from the back-forward cache is told so as it takes the play again, and takes it as a page that starts does', async () => {
    const b = new Browser();
    const a = b.page('a');
    await a.play.boot();
    a.play.away();
    a.state.frozen = true;
    const c = b.page('c');
    await c.play.boot();
    // Back: a is shown again; c, the page left, beside it in view does not keep it
    a.state.frozen = false;
    expect(await a.play.shown()).toBe('held');
    expect(a.state.back).toEqual([false, true]);
    c.state.hidden = true;
    c.state.hidden = false;
    expect(await c.play.here()).toBe('held');
    expect(c.state.back).toEqual([false, false]);
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
