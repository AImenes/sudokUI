// The set tracker (Settings → Track two sets of cells): two palette colours
// are two sets of cells, and this line under the board says how many cells
// and digits each holds, what each still needs, and whether the two must
// hold the same digits, with the proof a solver would write: the houses
// that, added to each side, cover the same cells (src/engine/sets.ts).
// Cells in both colours count in neither, and the board draws them in
// neither colour while the tracker is on (Grid.tsx, shownColors). It reads the player's own board,
// never the solution, so it never counts as help.
import React, { useMemo, useState } from 'react';
import { useGame } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { useT, rich, msg, Translator } from '../content/i18n';
import { listAnd } from '../engine/text';
import { compareSets, setLedgers, SetLedger, SetVerdict, Term } from '../engine/sets';
import { PALETTE } from './Grid';

/** houses as prose: "rows 1, 2, 8 and 9 and box 5", each kind together */
function housesText(terms: Term[], t: Translator): string {
  const groups: string[] = [];
  const kinds = [
    { from: 0, one: msg('row {list}'), many: msg('rows {list}') },
    { from: 9, one: msg('column {list}'), many: msg('columns {list}') },
    { from: 18, one: msg('box {list}'), many: msg('boxes {list}') }
  ];
  for (const kind of kinds) {
    const mine = terms.filter((x) => x.house >= kind.from && x.house < kind.from + 9);
    const byTimes = new Map<number, number[]>();
    for (const x of mine) byTimes.set(x.times, [...(byTimes.get(x.times) ?? []), x.house - kind.from + 1]);
    for (const [times, nums] of [...byTimes].sort((p, q) => p[0] - q[0])) {
      const text = t(nums.length === 1 ? kind.one : kind.many, { list: listAnd(nums) });
      groups.push(times === 1 ? text : t('{houses} counted {n} times', { houses: text, n: times }));
    }
  }
  return listAnd(groups);
}

/** one set's part of the line */
function sideText(l: SetLedger, proved: boolean, t: Translator): string {
  const vars = { n: l.size, placed: l.placed.length, list: listAnd(l.needs) };
  if (proved && l.needs.length && l.needs.length === l.empty) return t('{n} cells, {placed} placed, the rest is exactly {list}', vars);
  if (proved && l.needs.length && l.needs.length < l.empty) return t('{n} cells, {placed} placed, still needs {list}', vars);
  return t(l.size === 1 ? '{n} cell, {placed} placed' : '{n} cells, {placed} placed', vars);
}

const Swatch = ({ color, label }: { color: number; label: string }) => (
  <span className="set-swatch" style={{ background: PALETTE[color] }} role="img" aria-label={label} />
);

export function SetTracker() {
  const on = useSettings((s) => s.setTracker);
  const [ca, cb] = useSettings((s) => s.setColors);
  const cells = useGame((s) => s.cells);
  const t = useT();
  const [why, setWhy] = useState(false);

  // the two sets as painted; the verdict depends on them alone, the
  // ledgers on the digits as well
  const a = useMemo(() => (on ? cells.flatMap((c, i) => (c.colors.includes(ca) ? [i] : [])) : []), [on, cells, ca]);
  const b = useMemo(() => (on ? cells.flatMap((c, i) => (c.colors.includes(cb) ? [i] : [])) : []), [on, cells, cb]);
  const key = `${a.join(',')}|${b.join(',')}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const verdict: SetVerdict = useMemo(() => compareSets(a, b), [key]);
  const ledgers = useMemo(() => setLedgers(a, b, cells.map((c) => c.value)), [a, b, cells]);

  if (!on || verdict.kind === 'empty') return null;
  const swatchA = <Swatch color={ca} label={t('Colour {n}', { n: ca + 1 })} />;
  const swatchB = <Swatch color={cb} label={t('Colour {n}', { n: cb + 1 })} />;
  const proved = verdict.kind === 'same';
  const [la, lb] = ledgers;
  const impossible = proved && (la.needs.length > la.empty || lb.needs.length > lb.empty);

  let verdictText: React.ReactNode;
  if (verdict.kind === 'one') {
    verdictText = rich(t('Paint the other set in {colour} to compare'), {
      colour: la.size ? swatchB : swatchA
    });
  } else if (verdict.kind === 'sizes') {
    verdictText = t('Not the same digits: {a} cells against {b}', { a: verdict.a, b: verdict.b });
  } else if (verdict.kind === 'differ') {
    verdictText = t('Not necessarily the same digits: no count of houses links them, and some valid grid fills them differently');
  } else if (verdict.kind === 'unproved') {
    verdictText = t('Not proved: no count of rows, columns and boxes links these sets');
  } else if (impossible) {
    verdictText = t('Same digits, yet one set needs more digits than it has empty cells: a digit on the board is wrong');
  } else {
    verdictText = `✓ ${t('Same digits, proved by counting houses')}`;
  }

  const setNode = (swatch: React.ReactNode, scale: number) =>
    scale === 1 ? swatch : (
      <span>
        {swatch} ×{scale}
      </span>
    );

  return (
    <div className="set-tracker" role="status" aria-live="polite">
      <div className="set-line">
        {la.size > 0 && (
          <span className="set-side">
            {swatchA} {sideText(la, proved && !impossible, t)}
          </span>
        )}
        {lb.size > 0 && (
          <span className="set-side">
            {swatchB} {sideText(lb, proved && !impossible, t)}
          </span>
        )}
        <span className={`set-verdict${proved && !impossible ? ' proved' : ''}`}>
          {verdictText}
          {verdict.kind === 'same' && (
            <button className="link-btn set-why" onClick={() => setWhy(!why)} aria-expanded={why}>
              {why ? t('Hide the proof') : t('Why?')}
            </button>
          )}
        </span>
      </div>
      {why && verdict.kind === 'same' && (
        <p className="set-proof">
          {rich(
            t(
              '{a} with {withA} covers the same cells as {b} with {withB}. Each house holds every digit once, so the two sets hold the same digits.',
              { withA: housesText(verdict.withA, t), withB: housesText(verdict.withB, t) }
            ),
            { a: setNode(swatchA, verdict.scale), b: setNode(swatchB, verdict.scale) }
          )}
        </p>
      )}
    </div>
  );
}
