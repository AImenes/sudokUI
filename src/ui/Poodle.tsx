/**
 * Nutella, the resident black poodle — an optional companion sitting beneath
 * the board (Settings → Appearance). She can be dragged back and forth along
 * the board's bottom edge (mouse or touch) for restless thinking moments.
 * Purely decorative, hidden from screen readers; artwork in public/poodle.png.
 */
import { useRef, useState } from 'react';

export function Poodle() {
  // horizontal offset from her home at the board's right edge (always ≤ 0)
  const [x, setX] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ pointerX: number; baseX: number } | null>(null);

  const clamp = (v: number) => {
    const row = img.current?.parentElement;
    const min = row ? -(row.clientWidth - (img.current?.width ?? 88) - 14) : 0;
    return Math.min(0, Math.max(min, v));
  };

  return (
    <img
      ref={img}
      className="poodle"
      src="/poodle.png"
      width="88"
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ transform: `translateX(${x}px)` }}
      onPointerDown={(e) => {
        drag.current = { pointerX: e.clientX, baseX: x };
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setX(clamp(drag.current.baseX + (e.clientX - drag.current.pointerX)));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    />
  );
}
