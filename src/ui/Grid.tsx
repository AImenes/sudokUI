// The SVG board. Renders per cell, back to front: background → user colours →
// peer/same-digit tints → hint tint → selection → error tint, then the cell
// content (big digit, corner marks at digit-bound 3×3 positions, centre-mark
// line, or the auto-candidate 3×3 view), then hint candidate circles, chain
// arrows and grid lines. Pointer events implement drag multi-select.
import React, { useRef } from 'react';
import { useGame, engineGrid } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { bit, digitsOf } from '../engine/board';
import { ChainLink, CellDigit } from '../engine/steps';

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
  cellCands
}: {
  links: ChainLink[];
  /** digits currently displayed in a cell, for routing in-cell arcs */
  cellCands: (cell: number) => number[];
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
          bow = room(26) >= room(-26) ? 26 : -26;
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
        const mx = (p0.x + p1.x) / 2 - uy * bow;
        const my = (p0.y + p1.y) / 2 + ux * bow;
        return (
          <path
            key={i}
            d={`M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`}
            fill="none"
            stroke="var(--hint-chain)"
            strokeWidth={short ? 3.2 : 4.5}
            strokeDasharray={l.strong ? undefined : short ? '6 5' : '11 8'}
            opacity={0.9}
            markerEnd={short ? 'url(#chain-arrowhead-sm)' : 'url(#chain-arrowhead)'}
          />
        );
      })}
    </g>
  );
}

/** One shows on each pause — the only place a tip never interrupts play. */
const TIPS = [
  'Hold Shift to type corner marks from digit mode',
  'Hold Ctrl or Alt to type centre marks anywhere',
  'Space cycles input modes · S swaps corner ↔ centre',
  'Double-click a digit to select all of its cells',
  'The address bar link always carries this exact puzzle',
  'Practice can start from the very beginning — see Settings',
  'Finish without Hint or Check for a certified clean solve',
  'Ctrl+A selects the board — Fill then rebuilds every mark'
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
  marks: Map<number, string> | undefined
): React.ReactNode {
  const cornerDs = digitsOf(cell.corner);
  const centerDs = digitsOf(cell.center);
  if (!cornerDs.length && !centerDs.length) return null;

  const gridText = (d: number, bold: boolean) => (
    <text
      key={`g${d}`}
      x={x + candX(d)}
      y={y + candY(d)}
      textAnchor="middle"
      fontSize={23}
      fontWeight={marks?.has(d) ? 700 : bold ? 600 : 400}
      fill={marks?.has(d) ? hintTextFill(marks.get(d)!) : 'var(--cand)'}
    >
      {d}
    </text>
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
        {centerDs.join('')}
      </text>
    ) : null;

  if (cornerDs.length && centerDs.length) {
    return (
      <>
        {cornerDs.slice(0, 8).map((d, k) => (
          <text
            key={`p${d}`}
            x={x + PERIMETER[k][0]}
            y={y + PERIMETER[k][1]}
            textAnchor="middle"
            fontSize={21}
            fontWeight={600}
            fill="var(--cand)"
          >
            {d}
          </text>
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
            {centerDs.join('')}
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

export function Grid() {
  const cells = useGame((s) => s.cells);
  const selection = useGame((s) => s.selection);
  const select = useGame((s) => s.select);
  const selectAllOf = useGame((s) => s.selectAllOf);
  const autoCandidates = useGame((s) => s.autoCandidates);
  const hint = useGame((s) => s.hint);
  const hintStage = useGame((s) => s.hintStage);
  const errors = useGame((s) => s.errors);
  const paused = useGame((s) => s.paused);
  const won = useGame((s) => s.won);
  const togglePause = useGame((s) => s.togglePause);
  const { highlightPeers, highlightSameDigit } = useSettings();

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const additive = useRef(false);

  const showHint = hint && hintStage === 'full';
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
  const selectedValues = new Set(
    selection.map((i) => cells[i].value).filter((v) => v > 0)
  );
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

  // hint candidate markers: cell -> digit -> kind
  const hintMarks = new Map<number, Map<number, string>>();
  const hintCells = new Map<number, string>();
  if (showHint) {
    const mark = (cell: number, digit: number, kind: string) => {
      if (!hintMarks.has(cell)) hintMarks.set(cell, new Map());
      const m = hintMarks.get(cell)!;
      if (!m.has(digit) || kind === 'elim') m.set(digit, kind);
    };
    for (const cd of hint.primary ?? []) {
      mark(cd.cell, cd.digit, 'primary');
      if (!hintCells.has(cd.cell)) hintCells.set(cd.cell, 'primary');
    }
    for (const cd of hint.secondary ?? []) {
      mark(cd.cell, cd.digit, 'secondary');
      if (!hintCells.has(cd.cell)) hintCells.set(cd.cell, 'secondary');
    }
    // every chain-node candidate gets a circle so arrows root on one
    for (const link of hint.links ?? []) {
      for (const cd of [...link.from, ...link.to]) {
        mark(cd.cell, cd.digit, 'primary');
        if (!hintCells.has(cd.cell)) hintCells.set(cd.cell, 'primary');
      }
    }
    for (const cd of hint.fins ?? []) {
      mark(cd.cell, cd.digit, 'fin');
      if (!hintCells.has(cd.cell)) hintCells.set(cd.cell, 'fin');
    }
    for (const cd of hint.eliminations) {
      mark(cd.cell, cd.digit, 'elim');
      hintCells.set(cd.cell, 'elim');
    }
    for (const cd of hint.placements) hintCells.set(cd.cell, 'place');
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

  const onPointerDown = (e: React.PointerEvent) => {
    const cell = cellFromEvent(e);
    if (cell === null) return;
    dragging.current = true;
    additive.current = e.ctrlKey || e.metaKey || e.shiftKey;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    select([cell], additive.current);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const cell = cellFromEvent(e);
    if (cell !== null) select([cell], true);
  };
  const onPointerUp = () => {
    dragging.current = false;
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

  return (
    <div className="grid-wrap">
      <svg
        ref={svgRef}
        className="board"
        viewBox={`0 0 ${SIZE * 9 + M * 2} ${SIZE * 9 + M * 2}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {/* cell layers */}
        {cells.map((cell, i) => {
          const x = M + (i % 9) * SIZE;
          const y = M + Math.floor(i / 9) * SIZE;
          const isSel = selSet.has(i);
          const isErr = errors.includes(i);
          const samePeer = peerSet.has(i) && !isSel;
          const sameDigit =
            highlightSameDigit && !isSel && cell.value > 0 && selectedValues.has(cell.value);
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

        {/* content (hidden while paused) */}
        {!paused || won ? (
          cells.map((cell, i) => {
            const x = M + (i % 9) * SIZE;
            const y = M + Math.floor(i / 9) * SIZE;
            const marks = hintMarks.get(i);
            const candDisplay = autoCandidates && !cell.value ? canonical!.cands[i] : 0;
            return (
              <g key={i}>
                {/* hint candidate circles */}
                {marks &&
                  !cell.value &&
                  [...marks.entries()].map(([d, kind]) => (
                    <circle
                      key={d}
                      cx={x + candX(d)}
                      cy={y + candY(d) - 7}
                      r={15}
                      fill={hintFill[kind]}
                      opacity={0.85}
                    />
                  ))}
                {cell.value > 0 ? (
                  <text
                    x={x + SIZE / 2}
                    y={y + SIZE / 2 + 21}
                    textAnchor="middle"
                    fontSize={58}
                    fontWeight={cell.given ? 700 : 500}
                    fill={cell.given ? 'var(--given)' : 'var(--entered)'}
                  >
                    {cell.value}
                  </text>
                ) : candDisplay ? (
                  digitsOf(candDisplay).map((d) => (
                    <text
                      key={d}
                      x={x + candX(d)}
                      y={y + candY(d)}
                      textAnchor="middle"
                      fontSize={23}
                      fontWeight={marks?.has(d) ? 700 : 400}
                      fill={marks?.has(d) ? hintTextFill(marks.get(d)!) : 'var(--cand)'}
                    >
                      {d}
                    </text>
                  ))
                ) : (
                  renderMarks(cell, x, y, marks)
                )}
              </g>
            );
          })
        ) : (
          <>
            <text
              x={M + (SIZE * 9) / 2}
              y={M + (SIZE * 9) / 2}
              textAnchor="middle"
              fontSize={44}
              fill="var(--cand)"
            >
              Paused — press ⏵ to resume
            </text>
            <text
              x={M + (SIZE * 9) / 2}
              y={M + (SIZE * 9) / 2 + 52}
              textAnchor="middle"
              fontSize={22}
              fill="var(--muted)"
            >
              Did you know? {pauseTip}
            </text>
          </>
        )}

        {/* chain arrows (candidate-anchored), with the legacy centre-to-centre
            polyline as fallback for steps that only carry chainCells */}
        {showHint && hint.links && hint.links.length > 0 && (!paused || won) && (
          <ChainArrows
            links={hint.links}
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
      {paused && !won && (
        <button className="resume-overlay" onClick={togglePause}>
          ⏵ Resume
        </button>
      )}
    </div>
  );
}

export { PALETTE };
