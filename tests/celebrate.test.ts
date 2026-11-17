import { afterEach, describe, expect, it, vi } from 'vitest';
import { BIT_SECONDS, ROCKETS_AT, SHOW_SECONDS, VOLLEYS_AT, paletteOf, startShow } from '../src/ui/celebrate';

/** a canvas as the show uses one: its size, and a context that counts what is drawn */
function fakeCanvas(width = 900, height = 700, context = true) {
  const drawn = { rects: 0, lines: 0, clears: 0, colors: new Set<string>() };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    setTransform: () => {},
    clearRect: () => void drawn.clears++,
    fillRect() {
      drawn.rects++;
      drawn.colors.add(String(this.fillStyle));
    },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke() {
      drawn.lines++;
      drawn.colors.add(String(this.strokeStyle));
    }
  };
  const canvas = { clientWidth: width, clientHeight: height, width: 0, height: 0, getContext: () => (context ? ctx : null) };
  return { canvas: canvas as unknown as HTMLCanvasElement, drawn };
}

/** frames by hand: each call of run() plays the frame waiting, at the time given */
function frames() {
  let waiting: ((now: number) => void) | null = null;
  let asked = 0;
  vi.stubGlobal('requestAnimationFrame', (f: (now: number) => void) => {
    waiting = f;
    return ++asked;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    waiting = null;
  });
  return {
    run(now: number) {
      const f = waiting;
      waiting = null;
      f?.(now);
    },
    pending: () => waiting !== null
  };
}

/** the same numbers every run */
const seeded = () => {
  let s = 12345;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

afterEach(() => vi.unstubAllGlobals());

describe('the win screen’s show', () => {
  it('fires its volleys and rockets, rains, bursts, then ends by itself and clears the canvas', () => {
    const f = frames();
    const { canvas, drawn } = fakeCanvas();
    const palette = paletteOf('dark');
    const show = startShow(canvas, palette, seeded());
    expect(show.running()).toBe(true);
    expect(canvas.width).toBe(900);
    let t = 0;
    let peak = 0;
    let sparks = 0;
    // sixty frames a second until it stops; it must, well inside the longest a piece may live
    for (; show.running() && t < (SHOW_SECONDS + BIT_SECONDS + 2) * 60; t++) {
      const before = { rects: drawn.rects, lines: drawn.lines };
      f.run((t * 1000) / 60);
      peak = Math.max(peak, drawn.rects - before.rects);
      sparks = Math.max(sparks, drawn.lines - before.lines);
    }
    expect(show.running()).toBe(false);
    expect(f.pending()).toBe(false);
    // it lasted past its last rocket, and not past what a piece may live
    expect(t / 60).toBeGreaterThan(ROCKETS_AT[ROCKETS_AT.length - 1]);
    expect(t / 60).toBeLessThan(SHOW_SECONDS + BIT_SECONDS + 1);
    // confetti by the hundred at once, and a burst's sparks as lines
    expect(peak).toBeGreaterThan(200);
    expect(sparks).toBeGreaterThan(50);
    expect(VOLLEYS_AT).toHaveLength(3);
    // only the look's colours
    for (const c of drawn.colors) expect(palette).toContain(c);
    expect(drawn.colors.size).toBeGreaterThan(3);
  });

  it('makes fewer pieces on a phone, stops when told, and is nothing without a canvas to draw on or frames to ask for', () => {
    const f = frames();
    const wide = fakeCanvas(1280, 800);
    const phone = fakeCanvas(390, 844);
    const a = startShow(wide.canvas, paletteOf(undefined), seeded());
    f.run(0);
    f.run(16);
    a.stop();
    expect(a.running()).toBe(false);
    expect(f.pending()).toBe(false);
    const b = startShow(phone.canvas, paletteOf(undefined), seeded());
    f.run(0);
    f.run(16);
    b.stop();
    // the first volley, drawn in the second frame
    expect(phone.drawn.rects).toBeGreaterThan(40);
    expect(phone.drawn.rects).toBeLessThan(wide.drawn.rects);
    // stopping twice is nothing
    b.stop();
    expect(startShow(fakeCanvas(900, 700, false).canvas, paletteOf('dark')).running()).toBe(false);
    expect(startShow(fakeCanvas(0, 0).canvas, paletteOf('dark')).running()).toBe(false);
    expect(startShow(fakeCanvas().canvas, []).running()).toBe(false);
    vi.unstubAllGlobals();
    vi.stubGlobal('requestAnimationFrame', undefined);
    expect(startShow(fakeCanvas().canvas, paletteOf('dark')).running()).toBe(false);
  });

  it('wears snow, gold, berries and spruce at Christmas and a rainbow otherwise', () => {
    expect(paletteOf('christmas')).toEqual(['#e6eeea', '#f2c75c', '#d4455f', '#4fa37d']);
    expect(paletteOf('dark')).toHaveLength(7);
    expect(paletteOf('light')).toEqual(paletteOf(undefined));
  });
});
