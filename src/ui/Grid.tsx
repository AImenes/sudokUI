// The SVG board. Renders per cell, back to front: background → user colours →
// peer/same-digit tints → hint tint → selection → error tint, then the cell
// content (big digit, corner marks at digit-bound 3×3 positions, centre-mark
// line, or the auto-candidate 3×3 view), then hint candidate circles, chain
// polyline and grid lines. Pointer events implement drag multi-select.
import React, { useRef } from 'react';
import { useGame, engineGrid } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { bit, digitsOf } from '../engine/board';

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

/** Text colour for a candidate sitting on a hint circle: dark on the amber
 *  secondary circles, white on the saturated blue/red/purple ones. Keeps the
 *  digit readable regardless of theme. */
const hintTextFill = (kind: string) => (kind === 'secondary' ? '#1b2233' : '#ffffff');

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
                  <>
                    {/* corner marks share the auto-candidate geometry so hint
                        circles align in both views */}
                    {digitsOf(cell.corner).map((d) => (
                      <text
                        key={`co${d}`}
                        x={x + candX(d)}
                        y={y + candY(d)}
                        textAnchor="middle"
                        fontSize={23}
                        fontWeight={marks?.has(d) ? 700 : 600}
                        fill={marks?.has(d) ? hintTextFill(marks.get(d)!) : 'var(--cand)'}
                      >
                        {d}
                      </text>
                    ))}
                    {cell.center > 0 && (
                      <text
                        x={x + SIZE / 2}
                        y={y + SIZE / 2 + 8}
                        textAnchor="middle"
                        fontSize={Math.min(26, 128 / digitsOf(cell.center).length + 6)}
                        fill="var(--cand)"
                      >
                        {digitsOf(cell.center).join('')}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })
        ) : (
          <text
            x={M + (SIZE * 9) / 2}
            y={M + (SIZE * 9) / 2}
            textAnchor="middle"
            fontSize={44}
            fill="var(--cand)"
          >
            Paused — press ⏵ to resume
          </text>
        )}

        {/* chain lines */}
        {showHint && hint.chainCells && hint.chainCells.length > 1 && (!paused || won) && (
          <polyline
            points={hint.chainCells
              .map((c) => `${M + (c % 9) * SIZE + SIZE / 2},${M + Math.floor(c / 9) * SIZE + SIZE / 2}`)
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
