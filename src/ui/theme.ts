/**
 * The look on screen. The player chooses a theme or Match device
 * (src/state/settings.ts, ThemeChoice); under Match device the look is the
 * app's Daylight while the device is set to light and its Dark while it is
 * set to dark, and it follows the device the moment the device changes,
 * with the app open. Whatever is shown, the browser's bar and an installed
 * app's status bar wear the top bar's own colour (theme-color), so the two
 * never disagree. The shared picture is not a view of the page: it stays
 * light whatever is shown (src/content/boardImage.ts).
 */
import { useSyncExternalStore } from 'react';
import { useSettings, deviceIsLight, onDeviceScheme, shownTheme, type Theme } from '../state/settings';
import { useGame } from '../state/gameStore';

/**
 * The look shown now: the chosen theme, or the device's light or dark.
 * A door of the advent calendar is played in the Christmas look, whatever
 * is chosen and whatever the day (the owner's asking of 23 November 2026),
 * while Settings' "Doors wear the Christmas look" is on, as it is by
 * default; off, a door shows the chosen look, for a player who needs a
 * light one. The choice itself is left as it is either way, and comes
 * back with the next game that is no door.
 */
export function useShownTheme(): Theme {
  const choice = useSettings((s) => s.theme);
  const doorLook = useSettings((s) => s.doorChristmas);
  const light = useSyncExternalStore(onDeviceScheme, deviceIsLight, () => false);
  const door = useGame((s) => !!s.info?.adventDoor);
  return door && doorLook ? 'christmas' : shownTheme(choice, light);
}

/** put a look on the page: its colours (src/ui/styles.css, keyed by
 *  data-theme), and the bar colour that goes with them */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // the top bar's background, read from the stylesheet so the two cannot drift
  const bar = getComputedStyle(root).getPropertyValue('--bar-bg').trim();
  if (!bar) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = bar;
}
