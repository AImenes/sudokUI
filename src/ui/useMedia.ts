// A media query, followed as it changes: a phone turned on its side, a
// window made narrow. Read in a render, so the component draws what the
// stylesheet's own media queries draw.
import { useSyncExternalStore } from 'react';

/** a phone held upright, as the stylesheet tells one: a touch screen first,
 *  no wider than the phone layout (styles.css, max-width: 560px; a tablet is
 *  coarse too, but wider) */
export const PHONE = '(pointer: coarse) and (max-width: 560px)';

const listOf = (query: string): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (changed) => {
      const list = listOf(query);
      if (!list) return () => {};
      // Safari before 14 knows only addListener
      if (typeof list.addEventListener === 'function') {
        list.addEventListener('change', changed);
        return () => list.removeEventListener('change', changed);
      }
      list.addListener(changed);
      return () => list.removeListener(changed);
    },
    () => listOf(query)?.matches ?? false,
    () => false
  );
}
