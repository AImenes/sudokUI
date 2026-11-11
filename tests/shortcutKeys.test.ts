/**
 * The keyboard (src/ui/shortcutKeys.ts, App.tsx): shortcuts follow the
 * letter printed on a key, so Ctrl+Z undoes on German and French
 * keyboards and the key printed Z on a French one is not a wipe; letters of
 * other scripts keep the US places; and Space presses a button only when
 * the keyboard brought focus to it. The hunt of November 2026.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { shortcutKey, followKeyFocus } from '../src/ui/shortcutKeys';

/** a key as a keyboard sends it: its US place and the character printed on it */
const press = (code: string, key: string) => shortcutKey({ code, key });

describe('a shortcut follows the letter printed on the key', () => {
  it('on a US keyboard, as before', () => {
    expect(press('KeyZ', 'z')).toBe('KeyZ');
    expect(press('KeyW', 'w')).toBe('KeyW');
    expect(press('KeyS', 'S')).toBe('KeyS'); // with Shift
    expect(press('Digit4', '4')).toBe('Digit4');
    expect(press('Numpad7', '7')).toBe('Numpad7');
    for (const code of ['Space', 'Backspace', 'Delete', 'Escape', 'ArrowUp', 'Enter']) expect(press(code, code === 'Space' ? ' ' : code)).toBe(code);
  });

  it('on a German keyboard (QWERTZ): Z and Y are swapped, Ctrl+Z still undoes', () => {
    expect(press('KeyY', 'z')).toBe('KeyZ');
    expect(press('KeyZ', 'y')).toBe('KeyY');
  });

  it('on a French keyboard (AZERTY): Z is no wipe, A selects, M is M, the comma is nothing', () => {
    expect(press('KeyW', 'z')).toBe('KeyZ');
    expect(press('KeyZ', 'w')).toBe('KeyW');
    expect(press('KeyQ', 'a')).toBe('KeyA');
    expect(press('Semicolon', 'm')).toBe('KeyM');
    expect(press('KeyM', ',')).toBe('');
    // the digits need Shift there: unshifted the top row gives & é " ', and
    // the place still names the digit
    expect(press('Digit1', '&')).toBe('Digit1');
    expect(press('Digit2', 'é')).toBe('Digit2');
    expect(press('Digit3', '"')).toBe('Digit3');
  });

  it('a layout with punctuation on letter places (Dvorak) gives no letter shortcut by place', () => {
    expect(press('KeyJ', 'h')).toBe('KeyH'); // a Latin letter typed
    expect(press('KeyW', ',')).toBe('');
    expect(press('KeyZ', ';')).toBe('');
    expect(press('KeySlash', 'z')).toBe('KeyZ');
  });

  it('on a Hebrew keyboard, whose W place types an apostrophe, W still wipes once a Hebrew letter was typed', () => {
    expect(press('KeyH', 'י')).toBe('KeyH');
    expect(press('KeyW', "'")).toBe('KeyW');
    expect(press('KeyQ', '/')).toBe('KeyQ');
    // a letter typed with Ctrl, Alt or Cmd says nothing of the layout
    expect(shortcutKey({ code: 'KeyZ', key: 'z', ctrlKey: true })).toBe('KeyZ');
    expect(press('KeyW', "'")).toBe('KeyW');
    // switched to a Latin layout: punctuation is no shortcut again
    expect(press('KeyS', 's')).toBe('KeyS');
    expect(press('KeyW', ',')).toBe('');
    // Option on a Mac types a Greek letter there: the layout is still Latin
    expect(shortcutKey({ code: 'KeyP', key: 'π', altKey: true })).toBe('KeyP');
    expect(press('KeyM', ',')).toBe('');
  });

  it('a keydown with no key or code (an autofill suggestion picked) is no shortcut, and no error', () => {
    expect(shortcutKey({} as KeyboardEvent)).toBe('');
    expect(shortcutKey({ code: 'KeyW' } as KeyboardEvent)).toBe('KeyW');
    expect(shortcutKey({ key: 'w' } as KeyboardEvent)).toBe('KeyW');
  });

  it('another script, a dead key, an input method or Option on a Mac: by place, so the shortcuts stay', () => {
    expect(press('KeyZ', 'я')).toBe('KeyZ'); // Russian
    expect(press('KeyZ', 'ζ')).toBe('KeyZ'); // Greek
    expect(press('KeyW', '∑')).toBe('KeyW'); // Option+W on a Mac
    expect(press('KeyE', 'Dead')).toBe('KeyE');
    expect(press('KeyH', 'Process')).toBe('KeyH');
  });
});

describe('Space and the focused control', () => {
  // the browser's Element, as much of it as the test needs: a button and the board
  class FakeElement {
    constructor(readonly pressable: boolean) {}
    closest() {
      return this.pressable ? this : null;
    }
  }
  const had = 'Element' in globalThis;
  beforeAll(() => {
    if (!had) (globalThis as { Element?: unknown }).Element = FakeElement;
  });
  afterAll(() => {
    if (!had) delete (globalThis as { Element?: unknown }).Element;
  });

  /** a window stand-in that keeps the listeners, to send them events */
  function fakeWindow() {
    const on = new Map<string, (e: unknown) => void>();
    const target = {
      addEventListener: (type: string, fn: (e: unknown) => void) => on.set(type, fn),
      removeEventListener: (type: string) => on.delete(type)
    };
    return { target: target as unknown as Window, on };
  }
  const space = (target: unknown) => ({ code: 'Space', key: ' ', target }) as unknown as KeyboardEvent;

  it('a button the keyboard brought focus to takes Space; one the mouse pressed, or the board, leaves it to the mode', () => {
    const button = new FakeElement(true);
    const board = new FakeElement(false);
    const { target, on } = fakeWindow();
    const follow = followKeyFocus(target);
    const key = (k: string) => on.get('keydown')!({ key: k });
    // Tab to the button
    key('Tab');
    on.get('focusin')!({ target: button });
    expect(follow.spaceIsControls(space(button))).toBe(true);
    // the mouse clicks the button: Space must not press it again
    on.get('pointerdown')!({});
    on.get('focusin')!({ target: button });
    expect(follow.spaceIsControls(space(button))).toBe(false);
    // the button opened a dialog, and Escape gives focus back to it: the
    // mouse pressed it, so Space is still the mode's, and the dialog does
    // not open again
    key('Escape');
    on.get('focusin')!({ target: button });
    expect(follow.spaceIsControls(space(button))).toBe(false);
    // so after Enter or Ctrl+Z
    key('Enter');
    key('z');
    on.get('focusin')!({ target: button });
    expect(follow.spaceIsControls(space(button))).toBe(false);
    // Tab to it, open its dialog and Escape: back on the button by the
    // keyboard's way, so Space presses it again
    key('Tab');
    on.get('focusin')!({ target: button });
    key('Enter');
    key('Escape');
    on.get('focusin')!({ target: button });
    expect(follow.spaceIsControls(space(button))).toBe(true);
    // the board, reached by Tab, is no button: Space is the mode's
    on.get('focusin')!({ target: board });
    expect(follow.spaceIsControls(space(board))).toBe(false);
    // and the button it left no longer has focus from the keyboard
    expect(follow.spaceIsControls(space(button))).toBe(false);
    // Tab back to the button, then a click somewhere that takes no focus:
    // the mouse is in use again, and Space is the mode's
    key('Tab');
    on.get('focusin')!({ target: button });
    on.get('pointerdown')!({});
    expect(follow.spaceIsControls(space(button))).toBe(false);
    follow.stop();
    expect(on.size).toBe(0);
  });
});
