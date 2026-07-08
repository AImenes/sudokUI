/**
 * Nutella, the resident black poodle — an optional companion sitting beneath
 * the board (Settings → Appearance). She can be dragged back and forth along
 * the board's bottom edge (mouse or touch) for restless thinking moments;
 * a small bubble hints at that the first time she appears in a session.
 * Purely decorative, hidden from screen readers; artwork in public/poodle.png.
 */
import { useEffect, useRef, useState } from 'react';

export function Poodle() {
  // horizontal offset from her home at the board's right edge (always ≤ 0)
  const [x, setX] = useState(0);
  const [tip, setTip] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ pointerX: number; baseX: number } | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('sudokui-poodle-tip')) return;
    sessionStorage.setItem('sudokui-poodle-tip', '1');
    setTip(true);
    const t = setTimeout(() => setTip(false), 3500);
    return () => clearTimeout(t);
  }, []);

  const clamp = (v: number) => {
    const row = wrap.current?.parentElement;
    const min = row ? -(row.clientWidth - (wrap.current?.clientWidth ?? 88) - 14) : 0;
    return Math.min(0, Math.max(min, v));
  };

  return (
    <span
      ref={wrap}
      className="poodle-wrap"
      style={{ transform: `translateX(${x}px)` }}
      aria-hidden="true"
    >
      {tip && <span className="poodle-tip">drag me 🐾</span>}
      <img
        className="poodle"
        src="/poodle.png"
        width="88"
        alt=""
        draggable={false}
        onPointerDown={(e) => {
          setTip(false);
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
    </span>
  );
}
