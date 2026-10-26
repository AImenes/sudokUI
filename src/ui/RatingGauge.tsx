// The HoDoKu rating as a speedometer, on wider screens: HoDoKu's five
// levels as five arcs, Easy on the left, and a needle that sweeps up from
// zero to the puzzle's place when a puzzle opens, then hovers there the
// way a car's needle never quite settles at its pace: a degree or two
// either way, at no steady rhythm. Decoration only: the level's name and
// the rating stand next to it in words (App.tsx), so it is hidden from
// assistive technology and tells nothing by colour alone. The needle
// never leaves the arc of the puzzle's own level, tremor and all, and
// stops short of the arcs, so it never touches a neighbour. It hovers
// only while it can be seen; with reduced motion asked for, it simply
// stands at its place.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LEVELS, LEVEL_MAX_SCORE, Level } from '../engine/ratings';

/** where Extreme's arc ends on the dial; a higher rating stands at its end */
export const DIAL_TOP = 4000;
/** degrees per level, of the half circle */
export const SEG = 180 / LEVELS.length;
/** degrees of gap between two arcs */
export const GAP = 3;
/** how far the needle trembles either way, in degrees */
export const TREMOR = 2;

/**
 * The needle's angle for a level and a score: 0 at the dial's left end,
 * 180 at its right. It falls inside the level's arc by the score's place
 * in the level's range; a rating below the range (a level set by a
 * technique, not by the score) stands at the arc's start, one above it
 * (Extreme past DIAL_TOP) at its end, and anything that is no number at
 * the start. Kept a tremor's width inside both ends.
 */
export function dialAngle(level: Level, score: number): number {
  const i = Math.max(0, LEVELS.indexOf(level));
  const lo = i === 0 ? 0 : LEVEL_MAX_SCORE[LEVELS[i - 1]];
  const hi = i === LEVELS.length - 1 ? DIAL_TOP : LEVEL_MAX_SCORE[LEVELS[i]];
  const raw = (score - lo) / (hi - lo);
  const frac = Number.isNaN(raw) ? 0 : Math.min(1, Math.max(0, raw));
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
/** the needle's length: the arcs' band starts at R - 5, the needle's round tip ends short of it */
const NEEDLE = 32;
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
 * which styles.css reads; the level's name is never dropped. A practice
 * badge cut short counts as no room: the technique's name comes before
 * the decoration. Measured again whenever the group or anything in it
 * changes size.
 */
export function useRatingFit(ref: React.RefObject<HTMLElement>, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fits = () =>
      el.scrollWidth <= el.clientWidth &&
      Array.from(el.querySelectorAll<HTMLElement>('.practice-badge')).every((b) => b.scrollWidth <= b.clientWidth);
    // the gauge goes first, then the words; then, where even the level and
    // the number are short of room (a wide system font: DejaVu Sans, which
    // a Linux desktop without the app's faces falls back to, needs 3 px more
    // at 580 px than the bar has), the brand's name beside its mark steps
    // aside, as it does on a phone
    const bar = el.closest<HTMLElement>('.topbar');
    const step = (f: number) => {
      el.dataset.fit = String(Math.min(f, 2));
      if (!bar) return;
      if (f > 2) bar.dataset.brand = 'mark';
      else delete bar.dataset.brand;
    };
    const fit = () => {
      let f = 0;
      for (; f < 3; f++) {
        step(f);
        if (fits()) break;
      }
      step(f);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    for (const child of Array.from(el.children)) watch.observe(child);
    return () => {
      watch.disconnect();
      if (bar) delete bar.dataset.brand;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(MOTION_QUERY).matches;

/** whether reduced motion is asked for, kept up to date when the setting changes mid-session */
function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(reducedMotion);
  useEffect(() => {
    if (!window.matchMedia) return;
    const q = window.matchMedia(MOTION_QUERY);
    const on = () => setReduce(q.matches);
    if (q.addEventListener) q.addEventListener('change', on);
    else q.addListener(on);
    return () => {
      if (q.removeEventListener) q.removeEventListener('change', on);
      else q.removeListener(on);
    };
  }, []);
  return reduce;
}

export function RatingGauge({ level, score, puzzle }: { level: Level; score: number; puzzle: string }) {
  const target = dialAngle(level, score);
  const still = useReducedMotion();
  const svg = useRef<SVGSVGElement>(null);
  const [angle, setAngle] = useState(() => (still ? target : 0));
  const [ms, setMs] = useState(0);
  const [ease, setEase] = useState('linear');
  /** the gauge is drawn (not hidden by the bar's room or a phone's width) */
  const drawn = useRef(false);
  /** starts the hover again once the gauge can be seen; set by the effect below */
  const resume = useRef<() => void>(() => {});

  // whether the gauge is drawn and the page in view: nothing polls, the
  // hover simply stops while either is not so and starts again after
  useEffect(() => {
    const el = svg.current;
    const shown = () => !document.hidden && resume.current();
    document.addEventListener('visibilitychange', shown);
    // without a ResizeObserver the gauge is taken as drawn
    const watch =
      el && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(([entry]) => {
            const was = drawn.current;
            drawn.current = entry.contentRect.width > 0;
            if (drawn.current && !was) resume.current();
          })
        : null;
    if (watch && el) watch.observe(el);
    else drawn.current = true;
    return () => {
      watch?.disconnect();
      document.removeEventListener('visibilitychange', shown);
    };
  }, []);

  useEffect(() => {
    let live = true;
    let frame = 0;
    let timer: number | undefined;
    let swept = false;
    setMs(0);
    if (still) {
      setAngle(target);
      return;
    }
    // a new puzzle: from zero, then up to its place like a pedal pressed down
    setAngle(0);
    const hover = () => {
      timer = undefined;
      if (!live || !drawn.current || document.hidden) return;
      // a degree or two either way, each at its own pace
      const pace = 140 + Math.random() * 520;
      setMs(pace);
      setEase('ease-in-out');
      setAngle(target + (Math.random() * 2 - 1) * TREMOR);
      timer = window.setTimeout(hover, pace);
    };
    resume.current = () => {
      if (live && swept && timer === undefined) hover();
    };
    // two frames, so the zero is painted before the sweep starts
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!live) return;
        const sweep = 900 + (target / 180) * 700;
        setMs(sweep);
        setEase('cubic-bezier(0.3, 0.7, 0.25, 1)');
        setAngle(target);
        timer = window.setTimeout(() => {
          swept = true;
          hover();
        }, sweep);
      });
    });
    return () => {
      live = false;
      resume.current = () => {};
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [target, puzzle, still]);

  return (
    <svg ref={svg} className="rating-gauge" viewBox="0 0 100 56" aria-hidden="true" focusable="false">
      {LEVELS.map((l, i) => (
        <path key={l} className={`gauge-arc level-${l.toLowerCase()}`} d={arc(i)} />
      ))}
      <line
        className="gauge-needle"
        x1={CX}
        y1={CY}
        x2={CX - NEEDLE}
        y2={CY}
        style={{ transform: `rotate(${angle}deg)`, transition: `transform ${ms}ms ${ease}` }}
      />
      <circle className="gauge-hub" cx={CX} cy={CY} r={5} />
    </svg>
  );
}
