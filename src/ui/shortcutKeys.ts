// Which shortcut a key press is, and when a key is the focused control's
// rather than the board's (App.tsx, the window's key handler).

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
 * (AZERTY's comma where QWERTY has M) is no letter: no shortcut.
 */
export function shortcutKey(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  if (/^[a-z]$/i.test(e.key)) return 'Key' + e.key.toUpperCase();
  if (e.code.startsWith('Key') && /^[\x21-\x7e]$/.test(e.key)) return '';
  return e.code;
}

/** what Space presses when it has focus: the browser's own controls and the app's roles for them */
const PRESSABLE =
  'button, a[href], summary, select, [role=button], [role=switch], [role=tab], [role=checkbox], [role=radio], [role=menuitem], [role=option]';

/**
 * Follows how focus arrived: by a key (Tab, or a key that opened or closed
 * something and so moved focus), or by a pointer. Space then presses a
 * control the keyboard brought focus to, as the browser does, and leaves
 * a control the mouse or a finger last pressed to the board's own Space
 * (the mode): a number key clicked and then Space must not enter its digit
 * again. Returns the test and the way to stop following.
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
  const onKey = () => {
    byKey = true;
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
