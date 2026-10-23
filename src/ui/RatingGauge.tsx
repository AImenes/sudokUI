// The HoDoKu rating as a speedometer, on wider screens: HoDoKu's five
// levels as five arcs, Easy on the left, and a needle that sweeps up from
// zero to the puzzle's place when a puzzle opens, then hovers there the
// way a car's needle never quite settles at its pace: a degree or two
// either way, at no steady rhythm. Decoration only: the level's name and
// the rating stand next to it in words (App.tsx), so it is hidden from
// assistive technology and tells nothing by colour alone. The needle
// never leaves the arc of the puzzle's own level, tremor and all. With
// reduced motion asked for, it simply stands at its place.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LEVELS, LEVEL_MAX_SCORE, Level } from '../engine/ratings';

/** where Extreme's arc ends on the dial; a higher rating stands at its end */
export const DIAL_TOP = 4000;
/** degrees per level, of the half circle */
const SEG = 180 / LEVELS.length;
/** degrees of gap between two arcs */
const GAP = 3;
/** how far the needle trembles either way, in degrees */
export const TREMOR = 2;

/**
 * The needle's angle for a level and a score: 0 at the dial's left end,
 * 180 at its right. It falls inside the level's arc by the score's place
 * in the level's range, a rating below the range (a level set by a
 * technique, not by the score) at the arc's start, and kept a tremor's
 * width inside both ends.
 */
export function dialAngle(level: Level, score: number): number {
  const i = LEVELS.indexOf(level);
  const lo = i === 0 ? 0 : LEVEL_MAX_SCORE[LEVELS[i - 1]];
  const hi = i === LEVELS.length - 1 ? DIAL_TOP : LEVEL_MAX_SCORE[level];
  const frac = Math.min(1, Math.max(0, (score - lo) / (hi - lo)));
  const [start, end] = arcRange(i);
  return start + frac * (end - start);
}

/** the angles the needle may take inside a level's arc, tremor included */
export function arcRange(i: number): [number, number] {
  return [i * SEG + GAP / 2 + TREMOR, (i + 1) * SEG - GAP / 2 - TREMOR];
}

// the dial's geometry, in the SVG's own units
const CX = 50;
const CY = 50;
const R = 40;
const point = (deg: number, r = R) => {
  const t = Math.PI - (deg * Math.PI) / 180;
  return `${(CX + r * Math.cos(t)).toFixed(2)} ${(CY - r * Math.sin(t)).toFixed(2)}`;
};
const arc = (i: number) => `M ${point(i * SEG + GAP / 2)} A ${R} ${R} 0 0 1 ${point((i + 1) * SEG - GAP / 2)}`;

/**
 * How much of the rating the top bar has room for, measured rather than
 * guessed from the width, since the room depends on the language, the
 * device's fonts and what else the bar shows: the gauge, the words
 * "HoDoKu rating" and the number (fit 0); the same without the gauge (1);
 * the number alone (2). Written as data-fit on the bar's rating group,
 * which styles.css reads; the level's name is never dropped. Measured
 * again whenever the group or anything in it changes size.
 */
export function useRatingFit(ref: React.RefObject<HTMLElement>, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let f = 0;
      for (; f < 2; f++) {
        el.dataset.fit = String(f);
        if (el.scrollWidth <= el.clientWidth) break;
      }
      el.dataset.fit = String(f);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    for (const child of Array.from(el.children)) watch.observe(child);
    return () => watch.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function RatingGauge({ level, score }: { level: Level; score: number }) {
  const target = dialAngle(level, score);
  const [angle, setAngle] = useState(() => (reducedMotion() ? target : 0));
  const [ms, setMs] = useState(0);
  const [ease, setEase] = useState('linear');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (reducedMotion()) {
      setMs(0);
      setAngle(target);
      return;
    }
    // a new puzzle: from zero, then up to its place like a pedal pressed down
    setMs(0);
    setAngle(0);
    const [lo, hi] = [target - TREMOR, target + TREMOR];
    const hover = () => {
      // a degree or two either way, each at its own pace
      const pace = 140 + Math.random() * 520;
      setMs(pace);
      setEase('ease-in-out');
      setAngle(Math.min(hi, Math.max(lo, target + (Math.random() * 2 - 1) * TREMOR)));
      timer.current = window.setTimeout(hover, pace);
    };
    // two frames, so the zero is painted before the sweep starts
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const sweep = 900 + (target / 180) * 700;
        setMs(sweep);
        setEase('cubic-bezier(0.3, 0.7, 0.25, 1)');
        setAngle(target);
        timer.current = window.setTimeout(hover, sweep);
      })
    );
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer.current);
    };
  }, [target]);

  return (
    <svg className="rating-gauge" viewBox="0 0 100 56" aria-hidden="true" focusable="false">
      {LEVELS.map((l, i) => (
        <path key={l} className={`gauge-arc level-${l.toLowerCase()}`} d={arc(i)} />
      ))}
      <line
        className="gauge-needle"
        x1={CX}
        y1={CY}
        x2={CX - R + 4}
        y2={CY}
        style={{ transform: `rotate(${angle}deg)`, transition: `transform ${ms}ms ${ease}` }}
      />
      <circle className="gauge-hub" cx={CX} cy={CY} r={5} />
    </svg>
  );
}
