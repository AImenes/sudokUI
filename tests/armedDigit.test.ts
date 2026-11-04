/**
 * Number-first entry and the number keys (the owner's report of 4 November
 * 2026, docs/candidates-2026-11.md): on his iPhone an armed digit "got stuck,
 * with no way to deselect". A tap on a cell selects it as it enters the
 * armed digit, and the armed key then entered into that selection instead
 * of putting the digit down; a phone has no Escape, and a tap on the cell
 * enters the digit again rather than letting go of it. Now, while a digit
 * is armed, the number keys choose the armed digit: the armed one again
 * puts it down whatever is selected, another arms that one, and nothing is
 * entered. And the click a browser sends after a tap on a key is matched
 * to the tap by time, not by its detail, so a tap counts once in Chromium's
 * order of events and in iOS Safari's (src/ui/keyTap.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';
import { TapGate } from '../src/ui/keyTap';

vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k)
  };
});

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const g = () => useGame.getState();
/** r9c1, empty in EASY (the owner's screenshot had r8c1 selected) */
const R9C1 = 72;
const R1C1 = 0;
/** a tap on a cell, as the board makes it (Grid.tsx): with a digit armed it selects the cell and enters the digit there */
function tapCell(cell: number) {
  const armed = g().armedDigit;
  g().select([cell], false);
  if (armed) g().input(armed);
}
const board = () => JSON.stringify(g().cells);

beforeEach(() => {
  useSettings.getState().set({ confirmAssist: false });
  g().startGame(EASY, 196, 'Easy');
  g().setMode('digit');
  g().select([], false);
});

describe('number-first entry: the number keys while a digit is armed', () => {
  it('a key with nothing selected arms its digit, and the same key puts it down', () => {
    g().numberKey(1);
    expect(g().armedDigit).toBe(1);
    g().numberKey(1);
    expect(g().armedDigit).toBe(null);
  });

  it('arm, tap a cell (the digit goes in and the cell is selected), tap the armed key: put down, nothing entered', () => {
    g().numberKey(1);
    tapCell(R9C1);
    expect(g().cells[R9C1].value).toBe(1);
    expect(g().selection).toEqual([R9C1]);
    expect(g().armedDigit).toBe(1);
    const before = board();
    const history = g().history.length;
    g().numberKey(1);
    // put down: the 1 stays where the tap put it, nothing taken off or added
    expect(g().armedDigit).toBe(null);
    expect(board()).toBe(before);
    expect(g().history).toHaveLength(history);
    // the cell is still selected, as a plain selection: a tap on it lets go
    expect(g().selection).toEqual([R9C1]);
  });

  it('the armed key puts the digit down over an empty selected cell too, with no mark put in', () => {
    g().numberKey(1);
    // a cell selected another way while 1 is armed (a drag from it, a Ctrl-click)
    useGame.setState({ selection: [R9C1] });
    const before = board();
    g().numberKey(1);
    expect(g().armedDigit).toBe(null);
    expect(board()).toBe(before);
    expect(g().cells[R9C1]).toMatchObject({ value: 0, corner: 0, center: 0 });
  });

  it('another key arms its digit in place of the armed one, and enters nothing', () => {
    g().numberKey(1);
    tapCell(R9C1);
    const before = board();
    g().numberKey(4);
    expect(g().armedDigit).toBe(4);
    expect(board()).toBe(before);
    // the cells now take the new digit
    tapCell(R1C1);
    expect(g().cells[R1C1].value).toBe(4);
    expect(g().cells[R9C1].value).toBe(1);
    expect(g().armedDigit).toBe(4);
  });

  it('in every mode: the armed key puts down the armed colour or mark as well', () => {
    for (const mode of ['corner', 'center', 'color'] as const) {
      g().setMode(mode);
      g().select([], false);
      g().numberKey(3);
      tapCell(R9C1);
      const before = board();
      g().numberKey(3);
      expect(g().armedDigit, mode).toBe(null);
      expect(board(), mode).toBe(before);
    }
  });

  it('with no digit armed a key enters into the selection, as ever', () => {
    g().select([R9C1], false);
    g().numberKey(5);
    expect(g().cells[R9C1].value).toBe(5);
    expect(g().armedDigit).toBe(null);
    // the same key again takes it off
    g().numberKey(5);
    expect(g().cells[R9C1].value).toBe(0);
  });

  it('an emptied selection puts the digit down too (Escape, a tap beside the board)', () => {
    g().numberKey(7);
    tapCell(R9C1);
    g().select([], false);
    expect(g().armedDigit).toBe(null);
  });

  it('a paused game takes no key: nothing is armed or put down', () => {
    g().togglePause();
    g().numberKey(2);
    expect(g().armedDigit).toBe(null);
    g().togglePause();
    g().numberKey(2);
    g().togglePause();
    g().numberKey(2);
    expect(g().armedDigit).toBe(2);
  });
});

describe('a tap on a key counts once, in any order of events (TapGate)', () => {
  /** a tap: the events in the order given, each at its own time; what acted, as 'lift' and 'click' */
  function run(events: ('down' | 'up' | 'leave' | 'cancel' | 'click' | 'hold')[], start = 0, gate = new TapGate<number>()) {
    const acted: string[] = [];
    let at = start;
    for (const e of events) {
      at += 20;
      if (e === 'down') gate.down(1);
      if (e === 'hold') gate.spend();
      if (e === 'up' && gate.up(1, true, at)) acted.push('lift');
      if ((e === 'leave' || e === 'cancel') && gate.up(1, false, at)) acted.push('lift');
      if (e === 'click' && gate.click(1, at)) acted.push('click');
    }
    return acted;
  }

  it("pointerdown, pointerup, pointerleave, click: the lift is the tap (Chromium, and iOS Safari whatever its click's detail, which is not read)", () => {
    expect(run(['down', 'up', 'leave', 'click'])).toEqual(['lift']);
  });

  it('a pointerleave before the pointerup: the click is the tap', () => {
    expect(run(['down', 'leave', 'up', 'click'])).toEqual(['click']);
  });

  it('a click before the lift: the click is the tap, and the lift is not', () => {
    expect(run(['down', 'click', 'up', 'leave'])).toEqual(['click']);
  });

  it('no click at all (iOS after a page change under the finger): the lift alone', () => {
    expect(run(['down', 'up', 'leave'])).toEqual(['lift']);
  });

  it('a hold that did its own thing (a corner mark): neither its lift nor its click', () => {
    expect(run(['down', 'hold', 'up', 'click'])).toEqual([]);
    expect(run(['down', 'hold', 'leave', 'click'])).toEqual([]);
  });

  it('a press the browser took for a scroll: nothing', () => {
    expect(run(['down', 'cancel'])).toEqual([]);
  });

  it('the keyboard or assistive technology: a click with no press before it', () => {
    expect(run(['click'])).toEqual(['click']);
    // and again after a tap, once that tap's click has come
    const gate = new TapGate<number>();
    expect(run(['down', 'up', 'click', 'click'], 0, gate)).toEqual(['lift', 'click']);
  });

  it('a click long after a press is a press of its own', () => {
    const gate = new TapGate<number>();
    gate.down(1);
    expect(gate.up(1, true, 0)).toBe(true);
    expect(gate.click(1, 5000)).toBe(true);
  });

  it('quick taps one after another: each counts once', () => {
    const gate = new TapGate<number>();
    expect(run(['down', 'up', 'click', 'down', 'up', 'click', 'down', 'up', 'leave', 'click'], 0, gate)).toEqual(['lift', 'lift', 'lift']);
  });

  it("another key's click or lift is not this press's", () => {
    const gate = new TapGate<number>();
    gate.down(1);
    // a second finger's key lifts: key 1's press goes on
    expect(gate.up(2, true, 10)).toBe(false);
    expect(gate.pressing).toBe(1);
    // the keyboard clicks key 2 meanwhile: its own press
    expect(gate.click(2, 20)).toBe(true);
    expect(gate.up(1, true, 30)).toBe(true);
    expect(gate.click(1, 40)).toBe(false);
  });
});
