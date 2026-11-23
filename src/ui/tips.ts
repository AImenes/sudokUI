/**
 * The pause card's tips ("Did you know?", src/ui/Grid.tsx): the one place a
 * tip never interrupts play. The owner's asking of 23 November 2026: a bank
 * of tips, from installing the app and the shortcuts to the tools (Scan,
 * Steps and the rest), and above all what makes this app special.
 *
 * A tip is shown only where it is true and useful: a shortcut where there
 * is a keyboard, a touch gesture where there is a touch screen, installing
 * where the app is not installed yet, the advent calendar in its season.
 * The first pause after the app opens shows one of the tips about what
 * makes the app special (gold); after that every tip that fits the device
 * comes round once, in a fresh order, before any comes again. Nothing is
 * stored for it: the order lives in memory and starts again with the app.
 *
 * Every tip is at most TIP_MAX characters in English, Norwegian and Spanish
 * (tests/tips.test.ts), so the card stays inside the board on a small phone.
 */
import { msg } from '../content/i18n';
import { localDateKey } from '../content/dailies';
import { lookAvailable } from '../content/season';
import { playedFrom } from '../state/dailyStats';

/** the longest a tip may be, in any of the three languages */
export const TIP_MAX = 100;

/** what a tip needs of the device or the day: a keyboard, a touch screen, a browser tab (the app not installed), the Christmas season */
export type TipNeed = 'keys' | 'touch' | 'tab' | 'advent';

export interface Tip {
  text: string;
  needs?: TipNeed[];
  /** says what makes the app special: one of these comes first */
  gold?: boolean;
}

export const TIPS: Tip[] = [
  { text: msg("A hint here draws the technique on your own grid and says why it works"), gold: true },
  { text: msg("Every hint is checked against the true solution before you see it"), gold: true },
  { text: msg("Hints follow your own pencil marks, so they continue from where you are"), gold: true },
  { text: msg("Practice makes a puzzle that needs the technique you pick"), gold: true },
  { text: msg("Free, with no ads, no account and no paywall"), gold: true },
  { text: msg("Your games stay on your device: nothing here identifies you"), gold: true },
  { text: msg("sudokUI works offline: load it once and it plays anywhere, even on a flight"), gold: true },
  { text: msg("Every puzzle carries a HoDoKu rating: the higher the number, the harder"), gold: true },
  { text: msg("sudokUI knows all the techniques human solvers use, from singles to chains"), gold: true },
  { text: msg("sudokUI is open source, and every message gets read: try Send feedback"), gold: true },
  { text: msg("Does a hint look wrong? Tap “Looks wrong?” under it and tell us"), gold: true },
  { text: msg("Scan lists every technique available right now, not just the easiest"), gold: true },
  { text: msg("Learn explains every technique, with a glossary and how the rating works"), gold: true },
  { text: msg("Hint works in three steps: it names the technique, shows it, then applies it") },
  { text: msg("Steps lists a complete solution path and points out its crux") },
  { text: msg("Share sends this exact puzzle, or your position, as a link or a picture") },
  { text: msg("After a win, Challenge a friend sends the same puzzle with your time to beat") },
  { text: msg("The daily puzzle is the same for everyone, and you can compare times") },
  { text: msg("Settings can hide the difficulty until the puzzle is solved") },
  { text: msg("Settings has several looks to choose from") },
  { text: msg("Auto candidates keeps every pencil mark up to date (it counts as help)") },
  { text: msg("Fill candidates writes every pencil mark in one go (it counts as help)") },
  { text: msg("Swap turns corner marks into centre marks, and back") },
  { text: msg("Colour mode paints cells: handy for following a chain by hand") },
  { text: msg("Import opens a puzzle you paste in as text") },
  { text: msg("The clock stops while the app is hidden, so a break costs no time") },
  { text: msg("Settings can switch off the fireworks on the win screen") },
  { text: msg("Pick a number with no cell selected to arm it: then a tap on a cell enters it") },
  { text: msg("New has a sudoku advent calendar: a door a day from 1 to 24 December"), needs: ['advent'] },
  { text: msg("Install sudokUI from your browser menu and it opens full screen, like an app"), needs: ['tab'] },
  { text: msg("On iPhone: Share → Add to Home Screen puts sudokUI beside your apps"), needs: ['tab', 'touch'] },
  { text: msg("Z, X, C and V switch between Digit, Corner, Centre and Colour"), needs: ['keys'] },
  { text: msg("H gives a hint: press again to see it on the board, and again to apply it"), needs: ['keys'] },
  { text: msg("Ctrl+Z undoes and Ctrl+Y redoes (Cmd on a Mac)"), needs: ['keys'] },
  { text: msg("W wipes the selected cells completely"), needs: ['keys'] },
  { text: msg("M turns multi-select on: a click adds or removes a cell"), needs: ['keys'] },
  { text: msg("B highlights the cells that have exactly two candidates"), needs: ['keys'] },
  { text: msg("Alt + drag selects a rectangle of cells (Option on a Mac)"), needs: ['keys'] },
  { text: msg("L opens Learn, N gives the next practice puzzle, P pauses"), needs: ['keys'] },
  { text: msg("Shift+S gathers corner and centre marks into one layer"), needs: ['keys'] },
  { text: msg("Arrow keys move the selection, and Shift + arrow extends it"), needs: ['keys'] },
  { text: msg("Hold a number in Digit mode to enter it as a corner mark"), needs: ['touch'] },
  { text: msg("Drag across the board to select several cells at once"), needs: ['touch'] },
  { text: msg("Long-press a digit on the board to select every cell with that digit"), needs: ['touch'] },
  { text: msg("Multi lets you tap cells one by one into a selection"), needs: ['touch'] },
  { text: msg("Hold Shift to type corner marks from digit mode"), needs: ['keys'] },
  { text: msg("Hold Ctrl or Alt to type centre marks anywhere"), needs: ['keys'] },
  { text: msg("Space cycles input modes · S swaps corner ↔ centre"), needs: ['keys'] },
  { text: msg("Double-click a digit to select all of its cells"), needs: ['keys'] },
  { text: msg("The address bar link always carries this exact puzzle"), needs: ['tab'] },
  { text: msg("Practice can start from the very beginning (see Settings)") },
  { text: msg("Finish without anything from the Assist box for an unassisted solve") },
  { text: msg("Hold a placed digit and its pencil marks light up too") },
  { text: msg("Ctrl+A selects the board, and Fill rebuilds every mark"), needs: ['keys'] },
  { text: msg("Hint reads your centre marks, so your eliminations carry over") }
];

/** what the device and the day offer, for choosing tips */
export type Device = Record<TipNeed, boolean>;

export function deviceNow(): Device {
  const is = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;
  return {
    keys: is('(hover: hover) and (pointer: fine)'),
    touch: is('(any-pointer: coarse)'),
    tab: playedFrom() === 'tab',
    advent: lookAvailable(localDateKey())
  };
}

/** the tips that fit a device */
export const tipsFor = (device: Device): Tip[] => TIPS.filter((tip) => (tip.needs ?? []).every((need) => device[need]));

/** deals tips: a gold one first, then every fitting tip once in a fresh order before any comes again, and never the same twice running */
export function tipDealer(random: () => number = Math.random) {
  let deck: string[] = [];
  let last = '';
  let dealt = false;
  const shuffled = (list: string[]) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return (device: Device): string => {
    const fit = tipsFor(device);
    if (!fit.length) return '';
    const pool = fit.map((tip) => tip.text);
    if (!dealt) {
      dealt = true;
      const gold = fit.filter((tip) => tip.gold).map((tip) => tip.text);
      if (gold.length) {
        last = gold[Math.floor(random() * gold.length) % gold.length];
        deck = shuffled(pool.filter((text) => text !== last));
        return last;
      }
    }
    // a device that changed (a keyboard plugged in, the season over) keeps only what still fits
    deck = deck.filter((text) => pool.includes(text));
    if (!deck.length) {
      deck = shuffled(pool);
      // the new round never opens with the tip the last one closed on
      if (deck.length > 1 && deck[deck.length - 1] === last) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    }
    last = deck.pop()!;
    return last;
  };
}

const deal = tipDealer();

/** the next tip for this device, now */
export const nextTip = (): string => deal(deviceNow());
