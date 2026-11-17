import { useEffect, useRef } from 'react';
import { paletteOf, startShow } from './celebrate';

/** whether the device asks for less motion: then there is no show at all */
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The show over the win screen (celebrate.ts): a canvas that covers the
 * backdrop, above the dialog, and takes no click, so every button under it
 * works while the pieces fly. Rendered only while Settings' "Celebrate a
 * solved puzzle" is on (Dialogs.tsx). A phone that can buzz gives three
 * short buzzes with it.
 */
export function Fireworks() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || calm()) return;
    const show = startShow(canvas, paletteOf(document.documentElement.dataset.theme));
    try {
      if (show.running() && typeof navigator.vibrate === 'function') navigator.vibrate([40, 70, 40, 70, 90]);
    } catch {
      // a buzz is never worth an error
    }
    return () => show.stop();
  }, []);
  return <canvas ref={ref} className="fireworks" aria-hidden="true" />;
}
