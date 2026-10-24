// The SVG board. Renders per cell, back to front: background → user colours →
// peer/same-digit tints → selection → error tint, then a hint's house bands,
// then the cell content (a hint's marks, then the big digit, corner marks at
// digit-bound 3×3 positions, centre-mark line, or the auto-candidate 3×3
// view), the bars over removed candidates, the grid lines, and last a
// hint's arrows (docs/hint-drawing.md). Pointer events implement drag
// multi-select.
import React, { useEffect, useRef } from 'react';
import { useGame, engineGrid, CellState } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { bivaluePairs } from '../state/bivalue';
import { bit, digitsOf, PEERS, UNITS } from '../engine/board';
import { ChainLink, CellDigit } from '../engine/steps';
import { walkFrames, Part } from '../engine/hintFrames';
import { arrowShapes, startMarkers, pointsOf, SIZES } from '../content/hintGeometry';
import type { ArrowShape, Layout } from '../content/hintGeometry';
import { MARK } from '../content/hintPalette';
import { hintMarks as computeMarks, markedCandidates as markedOf } from '../content/hintMarks';
import { useT, msg, translator } from '../content/i18n';
import type { Translator } from '../content/i18n';
import { touchIntent, cellsBetween, INTENT_MS, SLOP_PX } from './touchIntent';
import type { TouchIntent, ScrollRoom } from './touchIntent';

/** the tip that names multi-select has been shown once this session */
let dragTipShown = false;

const SIZE = 100;
const M = 4; // outer margin
const PALETTE = [
  '#e05563',
  '#e8934a',
  '#e6c74c',
  '#67b96a',
  '#4fc1b0',
  '#5b8fe0',
  '#9b74d8',
  '#d873b8',
  '#9aa3b5'
];

/** candidate position inside a cell (3x3 layout, digit 1 top-left) */
const candX = (d: number) => 22 + ((d - 1) % 3) * 28;
const candY = (d: number) => 30 + Math.floor((d - 1) / 3) * 28;

/** where the app board draws its candidates, for the hint geometry; a placement's mark reaches out to its outer ring */
const layoutOf = (placed: Set<string>): Layout => ({
  centre: ({ cell, digit }) => ({
    x: M + (cell % 9) * SIZE + candX(digit),
    y: M + Math.floor(cell / 9) * SIZE + candY(digit) - 7
  }),
  r: SIZES.r * SIZE,
  radiusOf: (cd) => (placed.has(`${cd.cell}:${cd.digit}`) ? (MARK.placeRing + MARK.placeRingStroke / 2) * SIZE : SIZES.r * SIZE),
  cell: SIZE,
  bounds: { x0: M, y0: M, x1: M + 9 * SIZE, y1: M + 9 * SIZE }
});

/**
 * A hint's arrows (docs/hint-drawing.md G7-G14), straight from mark to
 * mark in the one neutral ink, solid into a true node and dashed into a
 * false one, bent only round the hint's own marks
 * (src/content/hintGeometry.ts). Drawn in two layers: the lines over the
 * grid lines and the marks but under the digits, so a digit an arrow
 * crosses stays whole, every halo before every line; and the start dots
 * and the walk's numbers over everything. A link inside one cell draws
 * nothing, its two marks say it.
 */
function ChainArrows({
  layer,
  links,
  marks,
  placed,
  frameOf
}: {
  layer: 'lines' | 'labels';
  links: ChainLink[];
  /** every candidate the hint marks: an arrow bends round these and nothing else */
  marks: CellDigit[];
  /** the placements among them */
  placed: Set<string>;
  /** the walk's frame that brings in a link, when walking: each arrow wears its number */
  frameOf?: (link: number) => number;
}) {
  const layout = layoutOf(placed);
  const shapes = arrowShapes(links, layout, marks);
  const w = SIZES.stroke * SIZE;
  const arrows = shapes.filter((s): s is Extract<ArrowShape, { kind: 'arrow' }> => s.kind === 'arrow');
  const ties = shapes.filter((s): s is Extract<ArrowShape, { kind: 'tie' }> => s.kind === 'tie');
  if (layer === 'labels') {
    return (
      <g className="chain-labels">
        {/* the first node of each branch wears a dot: reading starts here */}
        {startMarkers(links, layout, marks).map((p, k) => (
          <circle key={`s${k}`} className="chain-start" cx={p.x} cy={p.y} r={SIZES.dot * SIZE} fill="var(--hint-arrow)" stroke="var(--cell-bg)" strokeWidth={2} />
        ))}
        {frameOf &&
          arrows.map((s) => (
            <g key={`b${s.link}`} className="walk-badge">
              <circle cx={s.mid.x} cy={s.mid.y} r={10} fill="var(--hint-arrow)" stroke="var(--cell-bg)" strokeWidth={2} />
              <text x={s.mid.x} y={s.mid.y + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--cell-bg)">
                {frameOf(s.link)}
              </text>
            </g>
          ))}
      </g>
    );
  }
  return (
    <g className="chain-arrows">
      {ties.map((s) => (
        <g key={`t${s.link}`}>
          <path className="chain-tie-halo" d={s.d} fill="none" stroke="var(--cell-bg)" strokeWidth={5} opacity={0.5} strokeLinecap="round" />
          <path className="chain-tie" d={s.d} fill="none" stroke="var(--hint-arrow)" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        </g>
      ))}
      {/* a thin halo in the board colour parts each arrow from the grid lines and the marks it crosses */}
      <g className="chain-halos">
        {arrows.map((s) => (
          <g key={`h${s.link}`}>
            <path className="chain-halo" d={s.d} fill="none" stroke="var(--cell-bg)" strokeWidth={w + SIZES.halo * SIZE} opacity={0.75} strokeLinecap="round" />
            {s.head.length > 0 && (
              <polygon points={pointsOf(s.head)} fill="var(--cell-bg)" stroke="var(--cell-bg)" strokeWidth={SIZES.halo * SIZE} strokeLinejoin="round" opacity={0.75} />
            )}
          </g>
        ))}
      </g>
      {arrows.map((s) => (
        <g key={`a${s.link}`}>
          <path
            className={s.strong ? 'chain-shaft' : 'chain-shaft weak'}
            d={s.d}
            fill="none"
            stroke="var(--hint-arrow)"
            strokeWidth={w}
            strokeDasharray={s.strong ? undefined : '8 6'}
            strokeLinecap={s.strong ? 'round' : 'butt'}
          />
          {s.head.length > 0 && <polygon points={pointsOf(s.head)} fill="var(--hint-arrow)" />}
        </g>
      ))}
    </g>
  );
}

/** the rectangle a unit band covers */
function unitRect(unit: number): { x: number; y: number; w: number; h: number } {
  if (unit < 9) return { x: M, y: M + unit * SIZE, w: 9 * SIZE, h: SIZE };
  if (unit < 18) return { x: M + (unit - 9) * SIZE, y: M, w: SIZE, h: 9 * SIZE };
  const b = unit - 18;
  return { x: M + (b % 3) * 3 * SIZE, y: M + Math.floor(b / 3) * 3 * SIZE, w: 3 * SIZE, h: 3 * SIZE };
}

/** One shows on each pause — the only place a tip never interrupts play.
 *  Translated where it is shown. */
const TIPS = [
  msg('Hold Shift to type corner marks from digit mode'),
  msg('Hold Ctrl or Alt to type centre marks anywhere'),
  msg('Space cycles input modes · S swaps corner ↔ centre'),
  msg('Double-click a digit to select all of its cells'),
  msg('The address bar link always carries this exact puzzle'),
  msg('Practice can start from the very beginning (see Settings)'),
  msg('Finish without anything from the Assist box for an unassisted solve'),
  msg('Hold a placed digit and its pencil marks light up too'),
  msg('Ctrl+A selects the board, and Fill rebuilds every mark'),
  msg('Hint reads your centre marks, so your eliminations carry over')
];

/** Text colour for a candidate a hint marks: near-black on every filled
 *  mark, whatever the theme; the theme's ink inside a removal's ring, unless
 *  the ring is filled with the colour the candidate carried (colouring) */
const hintTextFill = (kind: string) => (kind === 'elim' ? 'var(--hint-in-ring)' : 'var(--hint-on-fill)');

/** the fill and the edge of each kind of hint mark (src/content/hintPalette.ts) */
const MARK_FILL: Record<string, { fill: string; ink: string }> = {
  primary: { fill: 'var(--hint-primary)', ink: 'var(--hint-primary-ink)' },
  secondary: { fill: 'var(--hint-secondary)', ink: 'var(--hint-secondary-ink)' },
  fin: { fill: 'var(--hint-fin)', ink: 'var(--hint-fin-ink)' },
  place: { fill: 'var(--hint-place)', ink: 'var(--hint-place-ink)' },
  elim: { fill: 'var(--hint-elim)', ink: 'var(--hint-elim)' }
};

/**
 * One hint mark on a candidate (docs/hint-drawing.md G1-G5): a filled disc
 * with an edge in its ink for a role; a disc with an outer ring for a
 * placement; a ring for a removal, tinted inside, or filled with the colour
 * a colouring gave it (the bar over its digit is drawn later, on top)
 */
function HintMark({ x, y, kind, inside }: { x: number; y: number; kind: string; inside?: string }) {
  const s = SIZE;
  // the keyline: a thin ring in the board's colour round the whole mark
  const outer = kind === 'place' ? MARK.placeRing + MARK.placeRingStroke / 2 : MARK.disc;
  const keyline = (
    <circle cx={x} cy={y} r={(outer + MARK.keyline / 2) * s} fill="none" stroke="var(--cell-bg)" strokeWidth={MARK.keyline * s} />
  );
  if (kind === 'elim' || kind === 'elimOn') {
    return inside ? (
      <g>
        {keyline}
        <circle className="hint-ring" cx={x} cy={y} r={MARK.ring * s} fill={MARK_FILL[inside].fill} stroke="var(--hint-elim)" strokeWidth={MARK.ringStroke * s} />
      </g>
    ) : (
      <g>
        {keyline}
        <circle cx={x} cy={y} r={MARK.ring * s} fill="var(--hint-elim)" style={{ fillOpacity: 'var(--hint-ring-tint)' }} />
        <circle className="hint-ring" cx={x} cy={y} r={MARK.ring * s} fill="none" stroke="var(--hint-elim)" strokeWidth={MARK.ringStroke * s} />
      </g>
    );
  }
  const { fill, ink } = MARK_FILL[kind];
  return (
    <g>
      {keyline}
      <circle cx={x} cy={y} r={(MARK.disc - MARK.edge / 2) * s} fill={fill} stroke={ink} strokeWidth={MARK.edge * s} />
      {kind === 'place' && (
        <circle className="hint-ring" cx={x} cy={y} r={MARK.placeRing * s} fill="none" stroke={ink} strokeWidth={MARK.placeRingStroke * s} />
      )}
    </g>
  );
}

/** Perimeter slots for corner marks when a cell ALSO holds centre marks —
 *  the classic SudokuPad arrangement, keeping the middle free for the
 *  centre line. Filled in digit order. */
const PERIMETER: [number, number][] = [
  [21, 30], // top-left
  [79, 30], // top-right
  [21, 92], // bottom-left
  [79, 92], // bottom-right
  [50, 30], // top-middle
  [50, 92], // bottom-middle
  [21, 62], // left-middle
  [79, 62] // right-middle
];

/**
 * How a cell's manual pencil marks are drawn (auto candidates handled
 * separately). The rules, chosen so nothing ever overlaps:
 *
 * - hint highlights on the cell → everything promotes to the 3×3 grid so the
 *   highlight circles sit exactly on the digits (corner-sourced digits stay
 *   bold, centre-sourced regular);
 * - corner marks only → digit-bound 3×3 positions;
 * - centre marks only → a centred line while it reads like a note (≤4
 *   digits), the 3×3 grid once it is an exhaustive list (5+);
 * - both layers → corner marks retreat to the cell perimeter and the centre
 *   line keeps the middle.
 */
function renderMarks(
  cell: { corner: number; center: number },
  x: number,
  y: number,
  marks: Map<number, string> | undefined,
  hlDigit = 0,
  frame = false,
  /** the cell is ringed as a bivalue cell: its two digits a touch heavier */
  pair = false
): React.ReactNode {
  const cornerDs = digitsOf(cell.corner);
  const centerDs = digitsOf(cell.center);
  if (!cornerDs.length && !centerDs.length && !marks?.size) return null;

  // same-digit highlight (hint circles win): the held/selected digit lights
  // up wherever the player has pencilled it
  const hl = (d: number) => d === hlDigit && !marks?.has(d);

  const gridText = (d: number, bold: boolean) => (
    <React.Fragment key={`g${d}`}>
      {hl(d) && frame && (
        <rect
          x={x + candX(d) - 11}
          y={y + candY(d) - 19}
          width={22}
          height={25}
          rx={5}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.6}
        />
      )}
      <text
        x={x + candX(d)}
        y={y + candY(d)}
        textAnchor="middle"
        fontSize={23}
        fontWeight={marks?.has(d) ? 700 : hl(d) ? 700 : bold || pair ? 600 : 400}
        fill={marks?.has(d) ? hintTextFill(marks.get(d)!) : hl(d) ? 'var(--accent)' : 'var(--cand)'}
      >
        {d}
      </text>
    </React.Fragment>
  );

  // joined digit runs keep their layout; a matching digit gets its own tspan
  const lineTspans = (ds: number[]) =>
    ds.map((d) =>
      hl(d) ? (
        <tspan key={d} fill="var(--accent)" fontWeight={700}>
          {d}
        </tspan>
      ) : (
        <tspan key={d}>{d}</tspan>
      )
    );

  // hint promotion: union of both layers on the 3×3 grid, and every digit
  // the hint marks, pencilled or not: a mark with no digit says nothing
  if (marks && marks.size > 0) {
    const union = [...new Set([...cornerDs, ...centerDs, ...marks.keys()])].sort((a, b) => a - b);
    return <>{union.map((d) => gridText(d, cell.corner ? (cell.corner & bit(d)) !== 0 : false))}</>;
  }

  const centerLine =
    centerDs.length > 0 && centerDs.length <= 4 ? (
      <text
        key="cl"
        x={x + SIZE / 2}
        y={y + SIZE / 2 + 8}
        textAnchor="middle"
        fontSize={26}
        fontWeight={pair ? 600 : undefined}
        fill="var(--cand)"
      >
        {lineTspans(centerDs)}
      </text>
    ) : null;

  if (cornerDs.length && centerDs.length) {
    return (
      <>
        {cornerDs.slice(0, 8).map((d, k) => (
          <React.Fragment key={`p${d}`}>
            {hl(d) && frame && (
              <rect
                x={x + PERIMETER[k][0] - 10}
                y={y + PERIMETER[k][1] - 17}
                width={20}
                height={22}
                rx={5}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.6}
              />
            )}
            <text
              x={x + PERIMETER[k][0]}
              y={y + PERIMETER[k][1]}
              textAnchor="middle"
              fontSize={21}
              fontWeight={hl(d) ? 700 : 600}
              fill={hl(d) ? 'var(--accent)' : 'var(--cand)'}
            >
              {d}
            </text>
          </React.Fragment>
        ))}
        {centerLine ?? (
          <text
            key="cl2"
            x={x + SIZE / 2}
            y={y + SIZE / 2 + 7}
            textAnchor="middle"
            fontSize={Math.min(22, 118 / centerDs.length + 4)}
            fill="var(--cand)"
          >
            {lineTspans(centerDs)}
          </text>
        )}
      </>
    );
  }

  if (cornerDs.length) return <>{cornerDs.map((d) => gridText(d, true))}</>;

  // centre only: line while it reads like a note, grid once it's a full list
  if (centerDs.length <= 4) return centerLine;
  return <>{centerDs.map((d) => gridText(d, false))}</>;
}

/** the selected cell in words, for the live region beside the board */
export function describeSelection(
  cells: CellState[],
  selection: number[],
  autoCandidates: boolean,
  t: Translator = translator()
): string {
  if (!selection.length) return t('No cell selected.');
  if (selection.length > 1) return t('{n} cells selected.', { n: selection.length });
  const i = selection[0];
  const c = cells[i];
  const where = { row: Math.floor(i / 9) + 1, col: (i % 9) + 1 };
  if (c.value) return t(c.given ? 'Row {row}, column {col}: {digit}, given.' : 'Row {row}, column {col}: {digit}.', { ...where, digit: c.value });
  const digits = (mask: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & (1 << (d - 1))).join(' ');
  if (autoCandidates) {
    const cands = digits(engineGrid(cells).cands[i]);
    return cands
      ? t('Row {row}, column {col}: empty, candidates {digits}.', { ...where, digits: cands })
      : t('Row {row}, column {col}: empty, candidates none.', where);
  }
  const marks = { ...where, corner: digits(c.corner), centre: digits(c.center) };
  if (c.corner && c.center) return t('Row {row}, column {col}: empty, corner marks {corner}, centre marks {centre}.', marks);
  if (c.corner) return t('Row {row}, column {col}: empty, corner marks {corner}.', marks);
  if (c.center) return t('Row {row}, column {col}: empty, centre marks {centre}.', marks);
  return t('Row {row}, column {col}: empty.', where);
}

export function Grid() {
  const cells = useGame((s) => s.cells);
  const selection = useGame((s) => s.selection);
  const select = useGame((s) => s.select);
  const selectAllOf = useGame((s) => s.selectAllOf);
  const autoCandidates = useGame((s) => s.autoCandidates);
  const hint = useGame((s) => s.hint);
  const hintStage = useGame((s) => s.hintStage);
  const walkIndex = useGame((s) => s.walkIndex);
  const errors = useGame((s) => s.errors);
  const paused = useGame((s) => s.paused);
  const won = useGame((s) => s.won);
  const togglePause = useGame((s) => s.togglePause);
  const armedDigit = useGame((s) => s.armedDigit);
  const input = useGame((s) => s.input);
  const chainTap = useGame((s) => s.chainTap);
  const multiSelect = useGame((s) => s.multiSelect);
  const markContract = useGame((s) => s.markContract);
  const {
    highlightPeers,
    highlightSameDigit,
    showConflicts,
    showPoodle,
    frameHighlights,
    highlightBivalue,
    digitTints,
    tintStrength,
    setTracker,
    setColors
  } = useSettings();
  const t = useT();
  /**
   * The colours a cell shows. With the set tracker on, a cell painted in
   * both sets' colours shows neither: it counts in neither set
   * (src/engine/sets.ts), so the board shows exactly what is counted. Only
   * the drawing changes; the cell keeps its colours, and they come back
   * when the tracker is switched off.
   */
  const shownColors = (colors: number[]) =>
    setTracker && colors.includes(setColors[0]) && colors.includes(setColors[1])
      ? colors.filter((c) => c !== setColors[0] && c !== setColors[1])
      : colors;

  // entered digits that repeat within a row, column or box: a rule check
  // against the board alone, nothing to do with the solution
  const conflicts = React.useMemo(() => {
    const out = new Set<number>();
    if (!showConflicts) return out;
    for (let i = 0; i < 81; i++) {
      const v = cells[i].value;
      if (!v || cells[i].given) continue;
      if (PEERS[i].some((p) => cells[p].value === v)) out.add(i);
    }
    return out;
  }, [cells, showConflicts]);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const additive = useRef(false);

  const walking = !!hint && hintStage === 'walk';
  const showHint = hint && (hintStage === 'full' || walking);
  // the walk shows the drawing one frame at a time
  const frame = walking && hint ? walkFrames(hint)[walkIndex] : null;
  const showPart = (part: Part) => !frame || frame.show.has(part);
  const visibleLinks: ChainLink[] =
    showHint && hint.links ? (frame ? hint.links.slice(0, frame.links) : hint.links) : [];
  // a fresh tip each time the game pauses
  const pauseTip = React.useMemo(
    () => TIPS[Math.floor(Math.random() * TIPS.length)],
    [paused]
  );
  const canonical = React.useMemo(
    () => (autoCandidates ? engineGrid(cells) : null),
    [cells, autoCandidates]
  );
  // the cells left with exactly two candidates, each with its pair, ringed
  // on request (Settings, or B): a view of the marks as the player wrote
  // them, and out of the way while a hint draws, so the drawing has the
  // board to itself
  const pairs = React.useMemo(
    () =>
      highlightBivalue && !showHint
        ? bivaluePairs(cells, autoCandidates, markContract, canonical ?? undefined)
        : new Map<number, [number, number]>(),
    [highlightBivalue, showHint, cells, autoCandidates, markContract, canonical]
  );

  const selSet = new Set(selection);
  // an armed digit (number-first entry) is tracked like a selected one
  const selectedValues = armedDigit
    ? new Set([armedDigit])
    : new Set(selection.map((i) => cells[i].value).filter((v) => v > 0));
  // while a hint draws, the peer and same-digit tints step aside, as the
  // bivalue rings do: the gold same-digit tint would read as a hint's band
  const trackDigits = !showHint && (highlightSameDigit || armedDigit !== null);
  // the digit being tracked (one distinct value selected — a click on a
  // placed digit, or the hold/double-click select-all gesture): its pencil
  // occurrences light up too, wherever the player has actually marked them
  const hlDigit = trackDigits && selectedValues.size === 1 ? [...selectedValues][0] : 0;
  const peerSet = new Set<number>();
  if (highlightPeers && selection.length === 1 && !showHint) {
    const i = selection[0];
    const r = Math.floor(i / 9);
    const c = i % 9;
    for (let k = 0; k < 9; k++) {
      peerSet.add(r * 9 + k);
      peerSet.add(k * 9 + c);
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) peerSet.add((br + rr) * 9 + bc + cc);
  }

  // a hint's marks (src/content/hintMarks.ts, docs/hint-drawing.md G1-G5):
  // a candidate's mark, the colour inside a colouring's removal, a solved
  // cell's colour on its digit. A hint never tints a cell.
  const bands = showHint && showPart('units') ? (hint.units ?? []) : [];
  const drawn = showHint
    ? computeMarks(hint, { solved: (c) => cells[c].value > 0, links: visibleLinks, show: showPart, walking: !!frame })
    : null;
  const hintMarks = drawn?.cands ?? new Map<number, Map<number, string>>();
  const hintRings = drawn?.inside ?? new Map<number, Map<number, string>>();
  const valueMarks = drawn?.values ?? new Map<number, string>();
  // every candidate the hint marks: an arrow bends round these and nothing else
  const markedCandidates: CellDigit[] = drawn ? markedOf(drawn) : [];
  // the placements' marks have an outer ring, which arrows keep outside of
  const placedKeys = new Set(
    [...hintMarks].flatMap(([cell, m]) => [...m].filter(([, kind]) => kind === 'place').map(([digit]) => `${cell}:${digit}`))
  );
  // the walk's frame that brings in each link, for the arrows' numbers
  const frameOfLink = React.useMemo(() => {
    if (!walking || !hint) return [] as number[];
    const frames = walkFrames(hint);
    return (hint.links ?? []).map((_, i) => frames.findIndex((fr) => fr.links > i) + 1);
  }, [walking, hint]);


  // the board's place on the page, read once when a pointer lands and
  // kept for the drag, so no move asks the browser for a layout; a scroll
  // or a resize forgets it, and the next read asks again
  const boardRect = useRef<DOMRect | null>(null);
  const rectOfBoard = (svg: SVGSVGElement) => (boardRect.current ??= svg.getBoundingClientRect());

  /** the candidate glyph under the pointer, for the chain trainer */
  const candidateFromEvent = (e: React.PointerEvent): { cell: number; digit: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = rectOfBoard(svg);
    const x = ((e.clientX - rect.left) / rect.width) * (SIZE * 9 + M * 2) - M;
    const y = ((e.clientY - rect.top) / rect.height) * (SIZE * 9 + M * 2) - M;
    const c = Math.floor(x / SIZE);
    const r = Math.floor(y / SIZE);
    if (r < 0 || r > 8 || c < 0 || c > 8) return null;
    const cell = r * 9 + c;
    if (cells[cell].value) return null;
    const mask = (canonical ?? engineGrid(cells)).cands[cell];
    let best: { cell: number; digit: number } | null = null;
    let nearest = 22;
    for (let d = 1; d <= 9; d++) {
      if (!(mask & (1 << (d - 1)))) continue;
      const dist = Math.hypot(x - c * SIZE - candX(d), y - r * SIZE - (candY(d) - 7));
      if (dist < nearest) {
        nearest = dist;
        best = { cell, digit: d };
      }
    }
    return best;
  };
  const cellFromEvent = (e: React.PointerEvent): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = rectOfBoard(svg);
    const x = ((e.clientX - rect.left) / rect.width) * (SIZE * 9 + M * 2) - M;
    const y = ((e.clientY - rect.top) / rect.height) * (SIZE * 9 + M * 2) - M;
    const c = Math.floor(x / SIZE);
    const r = Math.floor(y / SIZE);
    if (r < 0 || r > 8 || c < 0 || c > 8) return null;
    return r * 9 + c;
  };

  // long-press on a digit = "highlight all of this digit", the deliberate
  // touch counterpart to double-click (which also still works)
  const longPress = useRef<{ timer: number; cell: number } | null>(null);
  const cancelLongPress = () => {
    if (longPress.current) {
      window.clearTimeout(longPress.current.timer);
      longPress.current = null;
    }
  };

  // Alt + drag selects a rectangle: it spans from the cell where the drag
  // began to the cell under the pointer, and follows the pointer both ways
  const anchor = useRef<number | null>(null);
  const before = useRef<number[]>([]);
  // the cell the drag was last seen in (undefined before its first move,
  // null off the board): a move within it adds nothing, so the store is
  // not written and the board not redrawn for every pixel the pointer
  // travels
  const reached = useRef<number | null | undefined>(undefined);
  // what a drag does to the cells it crosses: adds them, or, in
  // multi-select from a cell that was selected, takes them out
  const paint = useRef<'add' | 'remove'>('add');
  // a finger or a pen is down on the board (a mouse is not): the long
  // press that asks for a context menu is the board's, not the browser's
  const fingerDown = useRef(false);

  // A touch is highlighted at once and settled by its movement, not by the
  // clock (touchIntent.ts). The press cell is selected the moment the
  // finger lands, as a tentative choice. A finger that then moves mostly
  // up or down past the slop, a way the page can scroll, is scrolling:
  // the selection goes back to what it was, and the browser has the
  // gesture (touch-action: pan-y; it reports a pointercancel when it
  // takes it, which puts the selection back too). A finger that moves
  // sideways past the slop, or steeply where the page has no room to
  // scroll (down, at the top of the page), or that rests for INTENT_MS,
  // is marking: the press cell stays selected, the drag extends from it
  // in any direction, and the page is held still under it. A lift within the slop is a tap, which the landing has already
  // performed; an armed digit is entered on the lift, never on the
  // landing, so a scroll can never enter a digit.
  //
  // From a tablet's width up the board does not scroll the page (its
  // touch-action has no pan-y, styles.css): no move is a scroll there, and
  // a finger past the slop is marking whichever way it goes. Multi-select
  // (the Multi button, M) does the same at any size, with the tablet's
  // touch-action; a tap then adds a cell or takes it out, as Ctrl-click
  // does, and a drag paints cells in or, from a selected cell, out.
  interface Touch {
    cell: number;
    additive: boolean;
    x: number;
    y: number;
    /** the selection before the landing, put back if the touch scrolls */
    before: number[];
    intent: TouchIntent;
    /** which way a swipe over the board scrolls the page: a steep move the other way is marking */
    pans: ScrollRoom;
    /** the drag has left the press cell, so the lift is no tap */
    left: boolean;
    /** the finger this is about; a second finger is a pinch, not a touch of its own */
    pointerId: number;
    /** the chain trainer's candidate under the finger, picked on the lift */
    chain: { cell: number; digit: number } | null;
  }
  const touch = useRef<Touch | null>(null);
  const intentTimer = useRef<number | null>(null);
  /** a committed drag holds the page still (the touchmove listener below) */
  const holdDrag = useRef(false);
  const clearIntentTimer = () => {
    if (intentTimer.current !== null) window.clearTimeout(intentTimer.current);
    intentTimer.current = null;
  };
  /**
   * Which way a finger on the board can scroll the page, read at each
   * landing. The stylesheet decides whether the board pans at all (not
   * from a tablet's width up, nor in multi-select; a tablet turned on its
   * side, or a window made narrow, changes the answer); the page's own
   * scroller decides the rest: at its top a finger pulling down has
   * nowhere to go, so it is selecting, and at its bottom the same for a
   * push up. A browser that does not know touch-action pans regardless.
   */
  const scrollRoom = (): ScrollRoom => {
    const svg = svgRef.current;
    if (!svg) return { up: true, down: true };
    const action = getComputedStyle(svg).touchAction;
    if (action === 'pinch-zoom' || action === 'none') return { up: false, down: false };
    // the nearest ancestor that scrolls (.layout), else the page itself
    let el: HTMLElement | null = svg.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    const scroller = el ?? (document.scrollingElement as HTMLElement | null);
    if (!scroller) return { up: true, down: true };
    return {
      // a finger moving up brings the page below it into view
      up: scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1,
      // a finger moving down brings back what is above
      down: scroller.scrollTop > 0
    };
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // only a non-passive listener can keep the page from scrolling under a
    // drag that has been committed; until then it never prevents anything,
    // and the browser scrolls as it likes
    const keep = (e: TouchEvent) => {
      if (holdDrag.current && e.cancelable) e.preventDefault();
    };
    svg.addEventListener('touchmove', keep, { passive: false });
    // the board's cached place on the page is stale once anything moves
    const forget = () => {
      boardRect.current = null;
    };
    window.addEventListener('scroll', forget, true);
    window.addEventListener('resize', forget);
    window.visualViewport?.addEventListener('resize', forget);
    window.visualViewport?.addEventListener('scroll', forget);
    return () => {
      svg.removeEventListener('touchmove', keep);
      window.removeEventListener('scroll', forget, true);
      window.removeEventListener('resize', forget);
      window.visualViewport?.removeEventListener('resize', forget);
      window.visualViewport?.removeEventListener('scroll', forget);
    };
  }, []);

  /** the touch is marking: the drag begins from the press cell */
  const commitTouch = (t: Touch) => {
    t.intent = 'drag';
    clearIntentTimer();
    if (t.chain) return;
    holdDrag.current = true;
    dragging.current = true;
    // only now, with the intent settled, is the pointer captured, so the
    // drag keeps reporting if the finger leaves the board; before this a
    // capture could stand between the browser and its scroll
    capturePointer(t.pointerId);
  };
  /** the touch is a scroll: the tentative highlight goes back */
  const scrollTouch = (t: Touch) => {
    t.intent = 'scroll';
    clearIntentTimer();
    cancelLongPress();
    // the snapshot, not select(): an armed digit stays armed
    if (!t.chain) useGame.setState({ selection: t.before });
  };
  /**
   * The board itself holds the capture, never the rect under the pointer:
   * the landing's own highlight re-renders the cell, and a rect that is
   * gone takes its capture with it (and would throw if asked for one)
   */
  const capturePointer = (pointerId: number) => {
    try {
      svgRef.current?.setPointerCapture(pointerId);
    } catch {
      // the pointer is already up: nothing to hold
    }
  };

  // every cell holding a digit: in multi-select they join the selection,
  // otherwise they are the selection (the long press and the double-click
  // are one gesture to the help, so they agree)
  const selectDigit = (v: number) => {
    if (useGame.getState().multiSelect) select(cells.map((c, i) => (c.value === v ? i : -1)).filter((i) => i >= 0), true);
    else selectAllOf(v);
  };

  const startLongPress = (cell: number) => {
    if (!cells[cell].value) return;
    longPress.current = {
      cell,
      timer: window.setTimeout(() => {
        longPress.current = null;
        // the press is spent: the lift does nothing, and a finger that
        // drifts on adds nothing to the digit's cells (the page stays
        // held until the lift)
        touch.current = null;
        dragging.current = false;
        anchor.current = null;
        reached.current = undefined;
        selectDigit(cells[cell].value);
      }, 500)
    };
  };

  // a tap on a cell: select it, deselect it, or add it to the selection
  const tapCell = (cell: number, add: boolean) => {
    // read the live selection (not this render's snapshot) so back-to-back
    // interactions resolve against the current state
    const sel = useGame.getState().selection;
    // tapping the lone selected cell deselects it — on touch there is no
    // Escape key, so this is the way out of a highlight
    if (!add && sel.length === 1 && sel[0] === cell) {
      select([], false);
      return;
    }
    // modifier-clicking an already-selected cell removes it from the
    // selection instead of re-adding it
    if (add && sel.includes(cell)) {
      select(sel.filter((i) => i !== cell), false);
      return;
    }
    select([cell], add);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    fingerDown.current = e.pointerType !== 'mouse';
    const g = useGame.getState();
    // multi-select makes every plain press additive; with a digit armed
    // the press still enters the digit, as number-first entry promises
    const multi = g.multiSelect && !g.armedDigit;
    const add = e.ctrlKey || e.metaKey || e.shiftKey || multi;
    // a second finger is a pinch (touch-action allows the zoom): the
    // browser's gesture from here on. A highlight the first finger lit
    // goes back; a drag it had committed keeps its cells and lets go of
    // the page
    if (e.pointerType === 'touch' && !e.isPrimary) {
      const t = touch.current;
      if (t && t.intent === 'undecided') scrollTouch(t);
      else if (t) {
        t.intent = 'scroll';
        cancelLongPress();
        holdDrag.current = false;
        dragging.current = false;
      }
      return;
    }
    // a fresh read of the board's place for this gesture: anything may
    // have moved it since the last one without a scroll or a resize
    boardRect.current = null;
    // building a chain: a tap picks a candidate, not a cell
    if (useGame.getState().chain) {
      const hit = candidateFromEvent(e);
      if (!hit) return;
      if (e.pointerType === 'touch') {
        touch.current = {
          cell: hit.cell,
          additive: add,
          x: e.clientX,
          y: e.clientY,
          before: [],
          intent: 'undecided',
          pans: scrollRoom(),
          left: false,
          pointerId: e.pointerId,
          chain: hit
        };
      } else {
        chainTap(hit.cell, hit.digit);
      }
      return;
    }
    const cell = cellFromEvent(e);
    if (cell === null) return;
    // a drag from a cell that multi-select had selected takes cells out
    const was = useGame.getState().selection;
    paint.current = multi && was.includes(cell) ? 'remove' : 'add';
    if (e.pointerType === 'touch') {
      touch.current = {
        cell,
        additive: add,
        x: e.clientX,
        y: e.clientY,
        before: was,
        intent: 'undecided',
        pans: scrollRoom(),
        left: false,
        pointerId: e.pointerId,
        chain: null
      };
      dragging.current = false;
      anchor.current = cell;
      reached.current = undefined;
      additive.current = add;
      before.current = add ? was : [];
      // the tentative highlight, in the frame of the landing; with a digit
      // armed the cell lights up now and takes the digit on the lift
      if (useGame.getState().armedDigit && !add) select([cell], false);
      else tapCell(cell, add);
      startLongPress(cell);
      clearIntentTimer();
      intentTimer.current = window.setTimeout(() => {
        intentTimer.current = null;
        const t = touch.current;
        // still within the slop: a rest, so marking from here on
        if (t && t.intent === 'undecided') commitTouch(t);
      }, INTENT_MS);
      return;
    }
    // number-first: with a digit armed, a plain tap enters it here
    const armed = useGame.getState().armedDigit;
    if (armed && !add) {
      select([cell], false);
      input(armed);
      return;
    }
    dragging.current = true;
    additive.current = add;
    anchor.current = cell;
    reached.current = undefined;
    // with Ctrl/Cmd or Shift held as well, the rectangle adds to what was
    // selected already
    before.current = add ? was : [];
    capturePointer(e.pointerId);
    startLongPress(cell);
    tapCell(cell, add);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const t = touch.current;
    if (t) {
      // another finger's moves are the pinch's, not this touch's
      if (e.pointerId !== t.pointerId) return;
      if (t.intent === 'scroll') return;
      if (t.intent === 'undecided') {
        const intent = touchIntent(e.clientX - t.x, e.clientY - t.y, t.pans);
        if (intent === 'undecided') return;
        if (intent === 'scroll') {
          scrollTouch(t);
          return;
        }
        commitTouch(t);
      }
      if (t.chain) return;
      // a finger that has travelled past the slop is dragging, not
      // pressing: no long press from here, however slowly it leaves the
      // press cell (a cell on a tablet is 80 px, and a careful drag out of
      // a digit took the half second and lit every cell of that digit)
      if (longPress.current && Math.hypot(e.clientX - t.x, e.clientY - t.y) > SLOP_PX) cancelLongPress();
      const under = cellFromEvent(e);
      if (under !== null && under !== t.cell) t.left = true;
    }
    if (!dragging.current) return;
    const cell = cellFromEvent(e);
    const from = reached.current;
    // still in the cell it was in: nothing to add
    if (cell === from) return;
    reached.current = cell;
    // off the board: where the drag comes back is a place of its own, not
    // the end of a line from where it left
    if (cell === null) return;
    // leaving the press cell turns the gesture into a drag-select
    if (longPress.current && cell !== longPress.current.cell) cancelLongPress();
    if (e.altKey && anchor.current !== null) {
      const [r0, c0] = [Math.floor(anchor.current / 9), anchor.current % 9];
      const [r1, c1] = [Math.floor(cell / 9), cell % 9];
      const rect: number[] = [];
      for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) {
        for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) rect.push(r * 9 + c);
      }
      select([...new Set([...before.current, ...rect])], false);
      return;
    }
    // this cell and every cell on the way to it: from the last one, or,
    // at the drag's first move, from the press cell, itself included (a
    // tap on the lone selected cell had deselected it); a drag that comes
    // back onto the board starts afresh where it does
    const press = anchor.current;
    const run = from === undefined && press !== null ? [press, ...cellsBetween(press, cell)] : from == null ? [cell] : cellsBetween(from, cell);
    if (paint.current === 'remove') {
      const out = new Set(run);
      select(useGame.getState().selection.filter((i) => !out.has(i)), false);
    } else select(run, true);
  };
  const endPointer = () => {
    dragging.current = false;
    anchor.current = null;
    reached.current = undefined;
    boardRect.current = null;
    fingerDown.current = false;
    touch.current = null;
    cancelLongPress();
    clearIntentTimer();
    holdDrag.current = false;
  };
  // a tab or app switch in the middle of a gesture: no lift will come, so
  // the gesture ends here, timers and all (the refs are the same objects
  // on every render, so the first render's endPointer serves)
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) endPointer();
    };
    const gone = () => endPointer();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', gone);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', gone);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPointerUp = (e: React.PointerEvent) => {
    const t = touch.current;
    if (t && e.pointerId !== t.pointerId) return;
    endPointer();
    if (!t || t.intent === 'scroll') return;
    if (t.chain) {
      // the finger lifted where it landed: now it picks the candidate
      if (t.intent === 'undecided') chainTap(t.chain.cell, t.chain.digit);
      return;
    }
    // the landing selected the cell; a lift that never left it is the
    // tap that enters an armed digit
    const armed = useGame.getState().armedDigit;
    if (armed && !t.additive && !t.left) input(armed);
  };
  // the browser took the touch for a scroll or a pinch: a tentative
  // highlight goes back; a committed drag keeps what it has selected
  const onPointerCancel = (e: React.PointerEvent) => {
    const tc = touch.current;
    if (tc && e.pointerId !== tc.pointerId) return;
    if (tc && tc.intent === 'undecided' && !tc.chain) useGame.setState({ selection: tc.before });
    // the browser took a drag the board had committed to (a scroll it did
    // not let go of): the cells so far stay, and once a session the toast
    // names the mode in which this cannot happen. Only where the page had
    // room to scroll under the finger: a pinch or a system gesture cancels
    // a drag too, on a tablet as well, and the mode would change nothing
    if (tc && tc.intent === 'drag' && !tc.chain && (tc.pans.up || tc.pans.down) && !useGame.getState().multiSelect && !dragTipShown) {
      dragTipShown = true;
      useGame.setState({ notice: t('Tip: Multi-select (M) lets you drag without the page scrolling') });
    }
    endPointer();
  };
  // a long press on Android asks for a context menu: the board has none,
  // and a finger or a pen that is still down is selecting, or has just
  // lit every cell of a digit (a mouse's right click is unaffected)
  const onContextMenu = (e: React.MouseEvent) => {
    if (fingerDown.current) e.preventDefault();
  };
  // the board loses its capture after a lift or a cancel, which the
  // handlers above have settled already; a rect losing the implicit touch
  // capture when the board takes it over (capturePointer) ends nothing
  const onLostPointerCapture = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) endPointer();
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const cell = cellFromEvent(e as unknown as React.PointerEvent);
    if (cell !== null && cells[cell].value) selectDigit(cells[cell].value);
  };

  // a hint's colour on a solved digit or a house band is the role's ink,
  // which on a dark board is its fill
  const hintInk = (kind: string) => MARK_FILL[kind]?.ink ?? 'var(--hint-primary-ink)';
  const hintFill = (kind: string) => MARK_FILL[kind]?.fill ?? 'var(--hint-primary)';

  // what a screen reader hears: the selected cell and what is in it, read
  // out as the selection moves (the arrow keys move it; digits enter)
  const announced = describeSelection(cells, selection, autoCandidates, t);

  return (
    <div className="grid-wrap">
      <svg
        ref={svgRef}
        className="board"
        viewBox={`0 0 ${SIZE * 9 + M * 2} ${SIZE * 9 + M * 2}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        data-multiselect={multiSelect ? 'true' : undefined}
        tabIndex={0}
        role="application"
        aria-label={t('Sudoku board. Arrow keys move between cells, digits enter, Backspace erases.')}
        aria-describedby="board-status"
      >
        {/* cell layers */}
        {cells.map((cell, i) => {
          const x = M + (i % 9) * SIZE;
          const y = M + Math.floor(i / 9) * SIZE;
          const isSel = selSet.has(i);
          const isErr = errors.includes(i);
          const samePeer = peerSet.has(i) && !isSel;
          const sameDigit = trackDigits && !isSel && cell.value > 0 && selectedValues.has(cell.value);
          return (
            <g key={i}>
              <rect x={x} y={y} width={SIZE} height={SIZE} fill="var(--cell-bg)" />
              {shownColors(cell.colors).map((col, k, shown) => (
                <rect
                  key={k}
                  x={x + (SIZE / shown.length) * k}
                  y={y}
                  width={SIZE / shown.length}
                  height={SIZE}
                  fill={PALETTE[col]}
                  opacity={0.55}
                />
              ))}
              {samePeer && (
                <rect x={x} y={y} width={SIZE} height={SIZE} fill="var(--peer-bg)" />
              )}
              {sameDigit && (
                <rect x={x} y={y} width={SIZE} height={SIZE} fill="var(--same-bg)" />
              )}
              {isSel && (
                <rect
                  x={x + 3}
                  y={y + 3}
                  width={SIZE - 6}
                  height={SIZE - 6}
                  fill="var(--sel-bg)"
                  stroke="var(--sel-border)"
                  strokeWidth={5}
                  opacity={0.9}
                />
              )}
              {/* a dashed ring in the pair's two colours, the digit tints,
                  half each (the smaller digit on the left): cells holding
                  the same pair wear the same two colours, so a remote pair
                  or a W-Wing shows from across the board. A thin dashed
                  stroke, so it is never read as a hint's colour or the
                  player's own, which fill cells and ring candidates */}
              {pairs.has(i) && (!paused || won) && (
                <g className="bivalue" data-pair={pairs.get(i)!.join('')}>
                  <path
                    d={`M ${x + 50} ${y + 7} H ${x + 16} A 9 9 0 0 0 ${x + 7} ${y + 16} V ${y + 84} A 9 9 0 0 0 ${x + 16} ${y + 93} H ${x + 50}`}
                    fill="none"
                    stroke={`var(--tint-${pairs.get(i)![0]}, var(--cand))`}
                    strokeWidth={3.5}
                    strokeDasharray="8 6"
                    opacity={0.85}
                  />
                  <path
                    d={`M ${x + 50} ${y + 7} H ${x + 84} A 9 9 0 0 1 ${x + 93} ${y + 16} V ${y + 84} A 9 9 0 0 1 ${x + 84} ${y + 93} H ${x + 50}`}
                    fill="none"
                    stroke={`var(--tint-${pairs.get(i)![1]}, var(--cand))`}
                    strokeWidth={3.5}
                    strokeDasharray="8 6"
                    opacity={0.85}
                  />
                </g>
              )}
              {isErr && (
                <rect x={x} y={y} width={SIZE} height={SIZE} fill="var(--error-bg)" opacity={0.5} />
              )}
            </g>
          );
        })}

        {/* house bands (G15): the houses a pattern lives in, under its marks,
            carried by a full-strength outline over a barely-there fill */}
        {bands.map(({ unit, role }, k) => {
          const r = unitRect(unit);
          return (
            <g key={`band-${k}`} className="hint-band">
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={hintFill(role)} style={{ fillOpacity: 'var(--hint-band-alpha)' }} />
              <rect
                x={r.x + 3.5}
                y={r.y + 3.5}
                width={r.w - 7}
                height={r.h - 7}
                fill="none"
                stroke={hintInk(role)}
                strokeWidth={3}
                strokeDasharray={role === 'secondary' ? MARK.coverDash.map((d) => d * SIZE).join(' ') : undefined}
                rx={8}
              />
            </g>
          );
        })}

        {/* a hint's marks, under the grid lines, the arrows and the digits */}
        {(!paused || won) &&
          [...hintMarks].flatMap(([i, m]) =>
            cells[i].value
              ? []
              : [...m.entries()].map(([d, kind]) => (
                  <HintMark
                    key={`m-${i}-${d}`}
                    x={M + (i % 9) * SIZE + candX(d)}
                    y={M + Math.floor(i / 9) * SIZE + candY(d) - 7}
                    kind={kind}
                    inside={hintRings.get(i)?.get(d)}
                  />
                ))
          )}
        {/* a solved cell the hint names (G1): its digit in the role's ink,
            and a rounded square round it, so it is told by shape as well
            as colour (a role's ink can sit close to the entered digits') */}
        {(!paused || won) &&
          [...valueMarks].map(([i, kind]) => (
            <rect
              key={`v-${i}`}
              className="hint-value"
              x={M + (i % 9) * SIZE + 9}
              y={M + Math.floor(i / 9) * SIZE + 9}
              width={SIZE - 18}
              height={SIZE - 18}
              rx={14}
              fill="none"
              stroke={hintInk(kind)}
              strokeWidth={3}
            />
          ))}

        {/* grid lines */}
        {Array.from({ length: 10 }, (_, k) => (
          <React.Fragment key={k}>
            <line
              x1={M + k * SIZE}
              y1={M}
              x2={M + k * SIZE}
              y2={M + 9 * SIZE}
              stroke="var(--line)"
              strokeWidth={k % 3 === 0 ? 6 : 1.5}
              strokeLinecap="round"
            />
            <line
              x1={M}
              y1={M + k * SIZE}
              x2={M + 9 * SIZE}
              y2={M + k * SIZE}
              stroke="var(--line)"
              strokeWidth={k % 3 === 0 ? 6 : 1.5}
              strokeLinecap="round"
            />
          </React.Fragment>
        ))}

        {/* a hint's arrows (G11): over the grid lines and the marks, under
            the digits, so a digit an arrow crosses stays whole */}
        {showHint && visibleLinks.length > 0 && (!paused || won) && (
          <ChainArrows layer="lines" links={visibleLinks} marks={markedCandidates} placed={placedKeys} />
        )}

        {/* content (hidden while paused) */}
        {!paused || won ? (
          cells.map((cell, i) => {
            const conflict = conflicts.has(i);
            const x = M + (i % 9) * SIZE;
            const y = M + Math.floor(i / 9) * SIZE;
            const marks = hintMarks.get(i);
            // with auto candidates on, the engine's candidates, and every
            // digit a hint marks besides (a mark with no digit says nothing)
            const candDisplay =
              autoCandidates && !cell.value
                ? canonical!.cands[i] | [...(marks?.keys() ?? [])].reduce((m, d) => m | bit(d), 0)
                : 0;
            return (
              <g key={i}>
                {cell.value > 0 ? (
                  <text
                    x={x + SIZE / 2}
                    y={y + SIZE / 2 + 21}
                    textAnchor="middle"
                    fontSize={58}
                    fontWeight={cell.given ? 700 : 500}
                    fill={
                      valueMarks.has(i)
                        ? hintInk(valueMarks.get(i)!)
                        : conflict
                          ? 'var(--error-bg)'
                          : cell.given
                            ? 'var(--given)'
                            : 'var(--entered)'
                    }
                    // an opt-in slight colour per digit, mixed into the theme's
                    // own digit colour so every theme keeps its character; a
                    // browser without color-mix ignores this and keeps `fill`
                    style={
                      digitTints && !conflict && !valueMarks.has(i)
                        ? {
                            fill: `color-mix(in srgb, var(${
                              cell.given ? '--given' : '--entered'
                            }) ${100 - tintStrength}%, var(--tint-${cell.value}))`
                          }
                        : undefined
                    }
                  >
                    {cell.value}
                  </text>
                ) : candDisplay ? (
                  digitsOf(candDisplay).map((d) => (
                    <React.Fragment key={d}>
                      {d === hlDigit && frameHighlights && !marks?.has(d) && (
                        <rect
                          x={x + candX(d) - 11}
                          y={y + candY(d) - 19}
                          width={22}
                          height={25}
                          rx={5}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth={1.6}
                        />
                      )}
                      <text
                        x={x + candX(d)}
                        y={y + candY(d)}
                        textAnchor="middle"
                        fontSize={23}
                        fontWeight={marks?.has(d) ? 700 : d === hlDigit ? 700 : pairs.has(i) ? 600 : 400}
                        fill={
                          marks?.has(d)
                            ? hintTextFill(marks.get(d)!)
                            : d === hlDigit
                              ? 'var(--accent)'
                              : 'var(--cand)'
                        }
                      >
                        {d}
                      </text>
                    </React.Fragment>
                  ))
                ) : (
                  renderMarks(cell, x, y, marks, hlDigit, frameHighlights, pairs.has(i))
                )}
              </g>
            );
          })
        ) : null /* pause card is drawn as an HTML overlay below */}

        {/* the bar over a removed candidate's digit (G3): drawn above the
            digit, the one sign every reader knows for "not this" */}
        {(!paused || won) &&
          [...hintMarks].flatMap(([i, m]) =>
            [...m]
              .filter(([, kind]) => kind === 'elim' || kind === 'elimOn')
              .map(([d]) => {
                const cx = M + (i % 9) * SIZE + candX(d);
                const cy = M + Math.floor(i / 9) * SIZE + candY(d) - 7;
                const b = MARK.bar * SIZE;
                return (
                  <line
                    key={`bar-${i}-${d}`}
                    className="hint-bar"
                    x1={cx - b}
                    y1={cy - b}
                    x2={cx + b}
                    y2={cy + b}
                    stroke="var(--hint-elim)"
                    strokeWidth={MARK.barStroke * SIZE}
                  />
                );
              })
          )}

        {/* the start dots and the walk's numbers, over everything */}
        {showHint && visibleLinks.length > 0 && (!paused || won) && (
          <ChainArrows
            layer="labels"
            links={visibleLinks}
            marks={markedCandidates}
            placed={placedKeys}
            frameOf={walking ? (link) => frameOfLink[link] : undefined}
          />
        )}

      </svg>
      <div id="board-status" className="sr-only" aria-live="polite" aria-atomic="true">
        {announced}
      </div>
      {paused && !won && (
        <div className="pause-card">
          <h3>{t('Paused')}</h3>
          <p className="pause-tip">{t('Did you know? {tip}', { tip: t(pauseTip) })}</p>
          <button className="resume-btn" onClick={togglePause}>
            ⏵ {t('Resume (P)')}
          </button>
          {showPoodle && (
            <img className="pause-poodle" src="/poodle.png" width="76" alt="" aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
}

export { PALETTE };
