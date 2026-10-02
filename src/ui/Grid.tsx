// The SVG board. Renders per cell, back to front: background → user colours →
// peer/same-digit tints → hint tint → selection → error tint, then the cell
// content (big digit, corner marks at digit-bound 3×3 positions, centre-mark
// line, or the auto-candidate 3×3 view), then hint candidate circles, chain
// arrows and grid lines. Pointer events implement drag multi-select.
import React, { useRef } from 'react';
import { useGame, engineGrid, CellState } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { bit, digitsOf, PEERS, UNITS } from '../engine/board';
import { ChainLink, CellDigit } from '../engine/steps';
import { walkFrames, Part } from '../engine/hintFrames';

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

/**
 * HoDoKu-style chain arrows: each link is an arrow rooted at the candidate
 * glyph it argues from and pointing at the one it argues to (group/ALS nodes
 * anchor at their centroid). Strong links draw solid, weak links dashed.
 * Arrows are trimmed to the hint-circle edge and bow away from any other
 * chain node their straight path would cross, so they never cover a
 * candidate they are not about.
 */
function ChainArrows({
  links,
  cellCands,
  numbered = false
}: {
  links: ChainLink[];
  /** digits currently displayed in a cell, for routing in-cell arcs */
  cellCands: (cell: number) => number[];
  /** badge each link with its place in the reading order (the walk) */
  numbered?: boolean;
}) {
  const R = 17; // hint circle radius + breathing room

  const anchor = (node: CellDigit[]) => {
    let x = 0;
    let y = 0;
    for (const cd of node) {
      x += M + (cd.cell % 9) * SIZE + candX(cd.digit);
      y += M + Math.floor(cd.cell / 9) * SIZE + candY(cd.digit) - 7;
    }
    return { x: x / node.length, y: y / node.length };
  };

  // every node anchor is an obstacle no other arrow may pass through
  const anchors = links.flatMap((l) => [anchor(l.from), anchor(l.to)]);
  // reading starts at the first inference (ties have no direction)
  const firstArrow = links.findIndex((l) => !l.undirected);
  let arrowNo = 0;

  return (
    <g className="chain-arrows">
      <defs>
        <marker
          id="chain-arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5.5"
          markerHeight="5.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--hint-chain)" />
        </marker>
        <marker
          id="chain-arrowhead-sm"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="3.4"
          markerHeight="3.4"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--hint-chain)" />
        </marker>
      </defs>
      {links.map((l, i) => {
        const a = anchor(l.from);
        const b = anchor(l.to);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        // short links get a smaller head + thinner shaft so the arrow does
        // not swallow the candidates; links between two candidates of ONE
        // cell additionally arc outward (away from the cell centre) to gain
        // enough length for the dash pattern to read
        const inCell =
          l.from.length === 1 && l.to.length === 1 && l.from[0].cell === l.to[0].cell;
        const short = len < 70;
        const trim = short ? 8 : Math.min(R, Math.max(4, (len - 16) / 2));
        const p0 = { x: a.x + ux * trim, y: a.y + uy * trim };
        const p1 = { x: b.x - ux * (trim + 4), y: b.y - uy * (trim + 4) };

        let bow = 0;
        if (inCell) {
          // arc to whichever side of the segment has the most free space:
          // clear of the cell's other candidate glyphs and inside the cell
          const cell = l.from[0].cell;
          const x0 = M + (cell % 9) * SIZE;
          const y0 = M + Math.floor(cell / 9) * SIZE;
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const glyphs = cellCands(cell)
            .filter((d) => d !== l.from[0].digit && d !== l.to[0].digit)
            .map((d) => ({ x: x0 + candX(d), y: y0 + candY(d) - 7 }));
          const room = (s: number) => {
            const p = { x: mid.x - uy * s, y: mid.y + ux * s };
            let r = glyphs.length
              ? Math.min(...glyphs.map((g) => Math.hypot(g.x - p.x, g.y - p.y)))
              : 60;
            if (p.x < x0 + 8 || p.x > x0 + SIZE - 8 || p.y < y0 + 8 || p.y > y0 + SIZE - 8)
              r -= 100; // spilling outside the cell is worse than any glyph
            return r;
          };
          bow = room(14) >= room(-14) ? 14 : -14;
        } else {
          // bow away from the nearest node the straight segment would graze
          let nearest = Infinity;
          for (const o of anchors) {
            if (Math.hypot(o.x - a.x, o.y - a.y) < 1 || Math.hypot(o.x - b.x, o.y - b.y) < 1) continue;
            const t = ((o.x - a.x) * dx + (o.y - a.y) * dy) / (len * len);
            if (t <= 0.02 || t >= 0.98) continue;
            const dist = Math.hypot(o.x - (a.x + t * dx), o.y - (a.y + t * dy));
            if (dist < 34 && dist < nearest) {
              nearest = dist;
              const cross = dx * (o.y - a.y) - dy * (o.x - a.x);
              bow = -(Math.sign(cross) || 1) * 40;
            }
          }
        }
        const f = (n: number) => n.toFixed(1);
        if (l.undirected) {
          // a tie: a quiet straight line between two candidates, no
          // direction and no routing; it may cross anything
          const d = `M ${f(p0.x)} ${f(p0.y)} L ${f(p1.x)} ${f(p1.y)}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="var(--cell-bg)" strokeWidth={5} opacity={0.5} strokeLinecap="round" />
              <path d={d} fill="none" stroke="var(--hint-chain)" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
            </g>
          );
        }
        // an arrow swings out near its start and arrives straight along the
        // line to its target, so the head points where the eye expects
        const k = Math.min(len * 0.35, 60);
        const swing = inCell ? bow : bow * 1.5;
        const c1 = { x: p0.x + ux * k - uy * swing, y: p0.y + uy * k + ux * swing };
        const c2 = { x: p1.x - ux * k, y: p1.y - uy * k };
        const d = `M ${f(p0.x)} ${f(p0.y)} C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p1.x)} ${f(p1.y)}`;
        // the curve's midpoint, where a number badge sits
        const bx = (p0.x + 3 * c1.x + 3 * c2.x + p1.x) / 8;
        const by = (p0.y + 3 * c1.y + 3 * c2.y + p1.y) / 8;
        const no = ++arrowNo;
        return (
          <g key={i}>
            {/* a halo in the board colour keeps the arrow legible over pencil marks */}
            <path d={d} fill="none" stroke="var(--cell-bg)" strokeWidth={(short ? 3.2 : 4.5) + 5} opacity={0.7} strokeLinecap="round" />
            <path
              d={d}
              fill="none"
              stroke="var(--hint-chain)"
              strokeWidth={short ? 3.2 : 4.5}
              strokeDasharray={l.strong ? undefined : short ? '6 5' : '11 8'}
              strokeLinecap="round"
              opacity={l.strong ? 0.92 : 0.8}
              markerEnd={short ? 'url(#chain-arrowhead-sm)' : 'url(#chain-arrowhead)'}
            />
            {/* the chain's first node wears a dot: this is where reading starts */}
            {i === firstArrow && <circle cx={p0.x} cy={p0.y} r={5.5} fill="var(--hint-chain)" />}
            {numbered && (
              <g>
                <circle cx={bx} cy={by} r={10.5} fill="var(--hint-chain)" stroke="var(--cell-bg)" strokeWidth={2} />
                <text x={bx} y={by + 4.5} textAnchor="middle" fontSize={13.5} fontWeight={700} fill="#ffffff">
                  {no}
                </text>
              </g>
            )}
          </g>
        );
      })}
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

/** One shows on each pause — the only place a tip never interrupts play. */
const TIPS = [
  'Hold Shift to type corner marks from digit mode',
  'Hold Ctrl or Alt to type centre marks anywhere',
  'Space cycles input modes · S swaps corner ↔ centre',
  'Double-click a digit to select all of its cells',
  'The address bar link always carries this exact puzzle',
  'Practice can start from the very beginning (see Settings)',
  'Finish without anything from the Assist box for an unassisted solve',
  'Hold a placed digit and its pencil marks light up too',
  'Ctrl+A selects the board, and Fill rebuilds every mark',
  'Hint reads your centre marks, so your eliminations carry over'
];

/** Text colour for a candidate sitting on a hint circle: dark on the amber
 *  secondary circles, white on the saturated blue/red/purple ones. Keeps the
 *  digit readable regardless of theme. */
const hintTextFill = (kind: string) => (kind === 'secondary' ? '#1b2233' : '#ffffff');

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
  frame = false
): React.ReactNode {
  const cornerDs = digitsOf(cell.corner);
  const centerDs = digitsOf(cell.center);
  if (!cornerDs.length && !centerDs.length) return null;

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
        fontWeight={marks?.has(d) ? 700 : hl(d) ? 700 : bold ? 600 : 400}
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

  // hint promotion: union of both layers on the 3×3 grid
  if (marks && marks.size > 0) {
    const union = [...new Set([...cornerDs, ...centerDs])].sort((a, b) => a - b);
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
export function describeSelection(cells: CellState[], selection: number[], autoCandidates: boolean): string {
  if (!selection.length) return 'No cell selected.';
  if (selection.length > 1) return `${selection.length} cells selected.`;
  const i = selection[0];
  const c = cells[i];
  const where = `Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}`;
  if (c.value) return `${where}: ${c.value}${c.given ? ', given' : ''}.`;
  const digits = (mask: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & (1 << (d - 1))).join(' ');
  if (autoCandidates) {
    const cands = engineGrid(cells).cands[i];
    return `${where}: empty, candidates ${digits(cands) || 'none'}.`;
  }
  const parts: string[] = [];
  if (c.corner) parts.push(`corner marks ${digits(c.corner)}`);
  if (c.center) parts.push(`centre marks ${digits(c.center)}`);
  return `${where}: empty${parts.length ? ', ' + parts.join(', ') : ''}.`;
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
  const {
    highlightPeers,
    highlightSameDigit,
    showConflicts,
    showPoodle,
    frameHighlights,
    digitTints,
    tintStrength
  } = useSettings();

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

  const selSet = new Set(selection);
  // an armed digit (number-first entry) is tracked like a selected one
  const selectedValues = armedDigit
    ? new Set([armedDigit])
    : new Set(selection.map((i) => cells[i].value).filter((v) => v > 0));
  const trackDigits = highlightSameDigit || armedDigit !== null;
  // the digit being tracked (one distinct value selected — a click on a
  // placed digit, or the hold/double-click select-all gesture): its pencil
  // occurrences light up too, wherever the player has actually marked them
  const hlDigit = trackDigits && selectedValues.size === 1 ? [...selectedValues][0] : 0;
  const peerSet = new Set<number>();
  if (highlightPeers && selection.length === 1) {
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

  // hint candidate markers: cell -> digit -> kind; a solved cell listed in
  // a colour shows it on its digit instead (valueMarks) and never gets a
  // candidate circle
  const hintMarks = new Map<number, Map<number, string>>();
  // a coloured candidate that is removed shows red with a ring in its
  // colour, so a colour that is wholly removed is still there to be read
  const hintRings = new Map<number, Map<number, string>>();
  const hintCells = new Map<number, string>();
  const valueMarks = new Map<number, string>();
  const bands = showHint && showPart('units') ? (hint.units ?? []) : [];
  if (showHint) {
    const ring = (cell: number, digit: number, kind: string) => {
      if (!hintRings.has(cell)) hintRings.set(cell, new Map());
      hintRings.get(cell)!.set(digit, kind);
    };
    const mark = (cell: number, digit: number, kind: string, cellToo = true) => {
      if (cells[cell].value) {
        if (!valueMarks.has(cell) || kind === 'elim') valueMarks.set(cell, kind);
      } else {
        if (!hintMarks.has(cell)) hintMarks.set(cell, new Map());
        const m = hintMarks.get(cell)!;
        const prev = m.get(digit);
        if (!prev) m.set(digit, kind);
        else if (kind === 'elim' && prev !== 'elim') {
          m.set(digit, 'elim');
          if (prev !== 'place') ring(cell, digit, prev);
        } else if (prev === 'elim' && kind !== 'elim' && kind !== 'place') ring(cell, digit, kind);
      }
      // a cell keeps the colour of what it holds; red tints only a cell
      // with nothing else to say
      if (cellToo && !hintCells.has(cell)) hintCells.set(cell, kind);
    };
    const has = (list: CellDigit[] | undefined, cd: CellDigit) =>
      !!list?.some((o) => o.cell === cd.cell && o.digit === cd.digit);
    // the class a chain node belongs to: colouring techniques list their
    // nodes under the colour they carry
    const classOf = (cd: CellDigit) =>
      has(hint.fins, cd) ? 'fin' : has(hint.secondary, cd) ? 'secondary' : 'primary';
    if (frame && hint.links?.length) {
      // walking a chain: only the nodes of the links drawn so far
      for (const link of visibleLinks) for (const cd of [...link.from, ...link.to]) mark(cd.cell, cd.digit, classOf(cd));
    } else {
      if (showPart('primary')) for (const cd of hint.primary ?? []) mark(cd.cell, cd.digit, 'primary');
      if (showPart('secondary')) for (const cd of hint.secondary ?? []) mark(cd.cell, cd.digit, 'secondary');
      // every chain-node candidate gets a circle so arrows root on one
      for (const link of visibleLinks) for (const cd of [...link.from, ...link.to]) mark(cd.cell, cd.digit, classOf(cd));
      if (showPart('fins')) for (const cd of hint.fins ?? []) mark(cd.cell, cd.digit, 'fin');
    }
    if (showPart('conclusion')) {
      if (frame) {
        // the last frame of a walk: the whole pattern, then the conclusion
        for (const cd of hint.primary ?? []) mark(cd.cell, cd.digit, 'primary');
        for (const cd of hint.secondary ?? []) mark(cd.cell, cd.digit, 'secondary');
        for (const cd of hint.fins ?? []) mark(cd.cell, cd.digit, 'fin');
      }
      for (const cd of hint.eliminations) mark(cd.cell, cd.digit, 'elim');
      for (const cd of hint.placements) hintCells.set(cd.cell, 'place');
    }
  }

  const cellFromEvent = (e: React.PointerEvent): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
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

  const onPointerDown = (e: React.PointerEvent) => {
    const cell = cellFromEvent(e);
    if (cell === null) return;
    // number-first: with a digit armed, a plain tap enters it here
    const armed = useGame.getState().armedDigit;
    if (armed && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
      select([cell], false);
      input(armed);
      return;
    }
    dragging.current = true;
    additive.current = e.ctrlKey || e.metaKey || e.shiftKey;
    anchor.current = cell;
    // with Ctrl/Cmd or Shift held as well, the rectangle adds to what was
    // selected already
    before.current = additive.current ? useGame.getState().selection : [];
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (cells[cell].value) {
      longPress.current = {
        cell,
        timer: window.setTimeout(() => {
          longPress.current = null;
          selectAllOf(cells[cell].value);
        }, 500)
      };
    }
    // read the live selection (not this render's snapshot) so back-to-back
    // interactions resolve against the current state
    const sel = useGame.getState().selection;
    // tapping the lone selected cell deselects it — on touch there is no
    // Escape key, so this is the way out of a highlight
    if (!additive.current && sel.length === 1 && sel[0] === cell) {
      select([], false);
      return;
    }
    // modifier-clicking an already-selected cell removes it from the
    // selection instead of re-adding it
    if (additive.current && sel.includes(cell)) {
      select(sel.filter((i) => i !== cell), false);
      return;
    }
    select([cell], additive.current);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const cell = cellFromEvent(e);
    if (cell !== null) {
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
      select([cell], true);
    }
  };
  const onPointerUp = () => {
    dragging.current = false;
    anchor.current = null;
    cancelLongPress();
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const cell = cellFromEvent(e as unknown as React.PointerEvent);
    if (cell !== null && cells[cell].value) selectAllOf(cells[cell].value);
  };

  const hintFill: Record<string, string> = {
    primary: 'var(--hint-primary)',
    secondary: 'var(--hint-secondary)',
    fin: 'var(--hint-fin)',
    elim: 'var(--hint-elim)',
    place: 'var(--hint-place)'
  };

  // what a screen reader hears: the selected cell and what is in it, read
  // out as the selection moves (the arrow keys move it; digits enter)
  const announced = describeSelection(cells, selection, autoCandidates);

  return (
    <div className="grid-wrap">
      <svg
        ref={svgRef}
        className="board"
        viewBox={`0 0 ${SIZE * 9 + M * 2} ${SIZE * 9 + M * 2}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        tabIndex={0}
        role="application"
        aria-label="Sudoku board. Arrow keys move between cells, digits enter, Backspace erases."
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
              {cell.colors.length > 0 &&
                cell.colors.map((col, k) => (
                  <rect
                    key={k}
                    x={x + (SIZE / cell.colors.length) * k}
                    y={y}
                    width={SIZE / cell.colors.length}
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
              {hintCells.has(i) && (
                <rect
                  x={x}
                  y={y}
                  width={SIZE}
                  height={SIZE}
                  fill={hintFill[hintCells.get(i)!]}
                  opacity={0.28}
                />
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
              {isErr && (
                <rect x={x} y={y} width={SIZE} height={SIZE} fill="var(--error-bg)" opacity={0.5} />
              )}
            </g>
          );
        })}

        {/* unit bands: the houses a pattern lives in, under its marks */}
        {bands.map(({ unit, role }, k) => {
          const r = unitRect(unit);
          return (
            <g key={`band-${k}`} className="hint-band">
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={hintFill[role]} opacity={0.14} />
              <rect
                x={r.x + 2}
                y={r.y + 2}
                width={r.w - 4}
                height={r.h - 4}
                fill="none"
                stroke={hintFill[role]}
                strokeWidth={3}
                opacity={0.55}
                rx={4}
              />
            </g>
          );
        })}

        {/* content (hidden while paused) */}
        {!paused || won ? (
          cells.map((cell, i) => {
            const conflict = conflicts.has(i);
            const x = M + (i % 9) * SIZE;
            const y = M + Math.floor(i / 9) * SIZE;
            const marks = hintMarks.get(i);
            const candDisplay = autoCandidates && !cell.value ? canonical!.cands[i] : 0;
            return (
              <g key={i}>
                {/* hint candidate circles */}
                {marks &&
                  !cell.value &&
                  [...marks.entries()].map(([d, kind]) => {
                    const ringKind = hintRings.get(i)?.get(d);
                    return (
                      <circle
                        key={d}
                        cx={x + candX(d)}
                        cy={y + candY(d) - 7}
                        r={ringKind ? 13.5 : 15}
                        fill={hintFill[kind]}
                        stroke={ringKind ? hintFill[ringKind] : undefined}
                        strokeWidth={ringKind ? 3.5 : undefined}
                        opacity={0.85}
                      />
                    );
                  })}
                {cell.value > 0 ? (
                  <text
                    x={x + SIZE / 2}
                    y={y + SIZE / 2 + 21}
                    textAnchor="middle"
                    fontSize={58}
                    fontWeight={cell.given ? 700 : 500}
                    fill={
                      valueMarks.has(i)
                        ? hintFill[valueMarks.get(i)!]
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
                        fontWeight={marks?.has(d) ? 700 : d === hlDigit ? 700 : 400}
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
                  renderMarks(cell, x, y, marks, hlDigit, frameHighlights)
                )}
              </g>
            );
          })
        ) : null /* pause card is drawn as an HTML overlay below */}

        {/* chain arrows (candidate-anchored), with the legacy centre-to-centre
            polyline as fallback for steps that only carry chainCells */}
        {showHint && visibleLinks.length > 0 && (!paused || won) && (
          <ChainArrows
            links={visibleLinks}
            numbered={walking}
            cellCands={(c) =>
              cells[c].value
                ? []
                : autoCandidates && canonical
                  ? digitsOf(canonical.cands[c])
                  : digitsOf(cells[c].corner | cells[c].center)
            }
          />
        )}
        {showHint &&
          !hint.links &&
          hint.chainCells &&
          hint.chainCells.length > 1 &&
          (!paused || won) && (
            <polyline
              points={hint.chainCells
                .map(
                  (c) => `${M + (c % 9) * SIZE + SIZE / 2},${M + Math.floor(c / 9) * SIZE + SIZE / 2}`
                )
                .join(' ')}
              fill="none"
              stroke="var(--hint-chain)"
              strokeWidth={5}
              strokeDasharray="12 8"
              opacity={0.7}
            />
          )}

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
      </svg>
      <div id="board-status" className="sr-only" aria-live="polite" aria-atomic="true">
        {announced}
      </div>
      {paused && !won && (
        <div className="pause-card">
          <h3>Paused</h3>
          <p className="pause-tip">Did you know? {pauseTip}</p>
          <button className="resume-btn" onClick={togglePause}>
            ⏵ Resume (P)
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
