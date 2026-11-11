// Which shortcut a key press is, and when a key is the focused control's
// rather than the board's (App.tsx, the window's key handler).

/** whether the last plain letter typed was a Latin one (until one is
 *  typed, a layout is taken to be Latin): see shortcutKey */
let latinLayout = true;

/**
 * The key a shortcut names, in KeyboardEvent.code's spelling ('KeyZ',
 * 'Digit4', 'Space'). Letters go by the character printed on the key, not
 * by its place: Ctrl+Z undoes on a German (QWERTZ) or French (AZERTY)
 * keyboard too, where Z sits elsewhere, and the key printed W is the one
 * that wipes. Everything else goes by its place: the digits (AZERTY's give
 * & é " ... without Shift), the arrows, Space and Backspace; and so does a
 * letter of another script (Cyrillic, Greek), a dead key, an input
 * method's key or Option on a Mac, so those players keep the shortcuts of
 * the US places. The punctuation a Latin layout puts on a letter's place
 * (AZERTY's comma where QWERTY has M) is no letter: no shortcut. A layout
 * of another script may put punctuation there too (Hebrew's ' where US
 * has W) and have no Latin W anywhere, so once the last plain letter typed
 * was of another script, that punctuation goes by its place as well.
 */
export function shortcutKey(
  e: Partial<Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey'>>
): string {
  // a keydown may carry neither (Chrome's, when an autofill suggestion is picked)
  const key = typeof e.key === 'string' ? e.key : '';
  const code = typeof e.code === 'string' ? e.code : '';
  // a letter typed with no modifier says which script the layout types
  if (/^\p{L}$/u.test(key) && !e.altKey && !e.ctrlKey && !e.metaKey) latinLayout = /^\p{Script=Latin}$/u.test(key);
  if (/^[a-z]$/i.test(key)) return 'Key' + key.toUpperCase();
  if (code.startsWith('Key') && /^[\x21-\x7e]$/.test(key) && latinLayout) return '';
  return code;
}

/** what Space presses when it has focus: the browser's own controls and the app's roles for them */
const PRESSABLE =
  'button, a[href], summary, select, [role=button], [role=switch], [role=tab], [role=checkbox], [role=radio], [role=menuitem], [role=option]';

/**
 * Follows how the player moves focus: with Tab, or with a pointer. Space
 * then presses a control that focus came to while the player was using
 * Tab, as the browser does, and leaves a control the mouse or a finger
 * last pressed to the board's own Space (the mode): a number key clicked
 * and then Space must not enter its digit again. Only Tab counts: Escape,
 * Enter or Ctrl+Z after a click also move focus (a dialog or the chain
 * trainer gives it back to the button the mouse pressed), and Space there
 * must still change the mode, not open the dialog again. Returns the test
 * and the way to stop following.
 */
export function followKeyFocus(target: Window = window) {
  let byKey = false;
  let keyFocused: EventTarget | null = null;
  // a press of the mouse or a finger anywhere ends the keyboard's claim,
  // also where it moves no focus (a click on the page beside the board)
  const onPointer = () => {
    byKey = false;
    keyFocused = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') byKey = true;
  };
  const onFocus = (e: FocusEvent) => {
    keyFocused = byKey ? e.target : null;
  };
  target.addEventListener('pointerdown', onPointer, true);
  target.addEventListener('keydown', onKey, true);
  target.addEventListener('focusin', onFocus, true);
  return {
    /** Space is the focused control's: the keyboard brought focus to it */
    spaceIsControls: (e: KeyboardEvent) =>
      e.target === keyFocused && e.target instanceof Element && !!e.target.closest(PRESSABLE),
    stop: () => {
      target.removeEventListener('pointerdown', onPointer, true);
      target.removeEventListener('keydown', onKey, true);
      target.removeEventListener('focusin', onFocus, true);
    }
  };
}
