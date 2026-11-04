// The app's name and mark, as the top bar shows them (App.tsx), and the
// address the pause card shows under its mark (Grid.tsx): the same in
// every language, so nothing here is translated
import { SITE } from '../content/home';

/** the name: "sudok" and a coloured "UI", the mark being the "UI" alone */
export const BRAND = ['sudok', 'UI'] as const;

/** the address people type: sudokui.app */
export const SITE_HOST = new URL(SITE).host;
