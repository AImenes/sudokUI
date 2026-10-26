import { Grid, UNITS, bit, digitsOf, popcount, sees, cellName } from '../board';
import { Step, CellDigit, ChainLink, ColourRule } from '../steps';
import { tr, unitName, listAnd } from '../text';
import { spanningTies, tieLinks, weakTie, nearest, firstParity, shades } from './colourTree';

/** node id for (cell, digit) */
const nid = (cell: number, digit: number) => cell * 9 + digit - 1;
const nCell = (id: number) => Math.floor(id / 9);
const nDigit = (id: number) => (id % 9) + 1;
const cd = (id: number): CellDigit => ({ cell: nCell(id), digit: nDigit(id) });

// A colouring says its parity (docs/hint-drawing-colouring.md): the
// cluster's two colours are the two shades of purple, and dark is the
// colour the argument tries first. A sentence names each shade whole,
// never as a hole, so every language can write it its own way.

interface Cluster {
  nodes: number[];
  /** node id -> the colour the search gave it, 0 or 1: which is dark is the step's to say */
  color: Map<number, number>;
  /** its strong relations (conjugate pairs, bivalue cells), which its ties are drawn from */
  relations: [number, number][];
}

/**
 * Build 3D Medusa clusters: nodes are candidates (cell,digit); strong links
 * are conjugate pairs (two positions of a digit in a unit) and bivalue cells
 * (two digits in a cell). Each connected component is 2-colored, and
 * keeps its strong relations, so its ties can be drawn.
 */
function buildClusters(g: Grid): Cluster[] {
  const adj = new Map<number, Set<number>>();
  const relations: [number, number][] = [];
  const link = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
    relations.push([a, b]);
  };
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const cells = unit.filter((c) => g.values[c] === 0 && g.cands[c] & bit(d));
      if (cells.length === 2) link(nid(cells[0], d), nid(cells[1], d));
    }
  }
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) {
      const [d1, d2] = digitsOf(g.cands[c]);
      link(nid(c, d1), nid(c, d2));
    }
  }
  const clusters: Cluster[] = [];
  const visited = new Set<number>();
  for (const start of adj.keys()) {
    if (visited.has(start)) continue;
    const color = new Map<number, number>();
    const nodes: number[] = [];
    const queue = [start];
    color.set(start, 0);
    visited.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      nodes.push(cur);
      for (const next of adj.get(cur)!) {
        if (!color.has(next)) {
          color.set(next, 1 - color.get(cur)!);
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (nodes.length >= 4) clusters.push({ nodes, color, relations: relations.filter(([a]) => color.has(a)) });
  }
  return clusters;
}

/** all six elimination rules from sudokuwiki.org/3D_Medusa */
export function findMedusa3d(g: Grid): Step | null {
  for (const cl of clusters(g)) {
    const colored = (col: number) => cl.nodes.filter((n) => cl.color.get(n) === col);
    const colourOf = (x: CellDigit) => cl.color.get(nid(x.cell, x.digit))!;

    // Rules 1 & 2: a colour contradicts itself -> remove that whole colour,
    // which is dark
    for (const col of [0, 1]) {
      const nodes = colored(col);
      // rule 1: same colour twice in one cell
      const byCell = new Map<number, number[]>();
      for (const n of nodes) {
        const ds = byCell.get(nCell(n)) ?? [];
        ds.push(nDigit(n));
        byCell.set(nCell(n), ds);
      }
      for (const [cell, ds] of byCell) {
        if (ds.length >= 2) {
          const name = cellName(cell);
          const [d1, d2] = [...ds].sort((a, b) => a - b);
          return medusaStep(
            cl,
            'medusa1',
            col,
            nodes.map(cd),
            tr`Dark purple colours both the ${d1} and the ${d2} in ${name}, so dark purple is false: every dark purple candidate is removed, and every light purple one is true`,
            [
              weakTie(
                [{ cell, digit: d1 }],
                [{ cell, digit: d2 }],
                tr`Dark purple colours both the ${d1} and the ${d2} in ${name} (the corner brackets). A cell holds one digit, so dark purple cannot be true.`
              )
            ]
          );
        }
      }
      // rule 2: same colour, same digit, twice in a unit
      for (let u = 0; u < 27; u++) {
        for (let d = 1; d <= 9; d++) {
          const twice = UNITS[u].filter((c) => cl.color.get(nid(c, d)) === col);
          if (twice.length >= 2) {
            const unit = unitName(u);
            const a = cellName(twice[0]);
            const b = cellName(twice[1]);
            return medusaStep(
              cl,
              'medusa2',
              col,
              nodes.map(cd),
              tr`Dark purple puts ${d} twice in ${unit} (${a} and ${b}), so dark purple is false: every dark purple candidate is removed, and every light purple one is true`,
              [
                weakTie(
                  [{ cell: twice[0], digit: d }],
                  [{ cell: twice[1], digit: d }],
                  tr`Dark purple puts ${d} in both ${a} and ${b} of ${unit} (the dashed line). A digit appears once per house, so dark purple cannot be true.`
                )
              ]
            );
          }
        }
      }
    }

    // where the argument proves no colour, dark is the colour of the
    // cluster's first candidate in reading order
    const first = firstParity(cl.nodes.map(cd), colourOf);

    // Rule 3: cell holding both colours -> uncoloured candidates there go
    const elims3: CellDigit[] = [];
    let cell3: { c: number; dark: number; light: number; removed: number[] } | null = null;
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0) continue;
      const colorDigit: (number | undefined)[] = [undefined, undefined];
      for (const d of digitsOf(g.cands[c])) {
        const col = cl.color.get(nid(c, d));
        if (col !== undefined) colorDigit[col] = d;
      }
      if (colorDigit[0] === undefined || colorDigit[1] === undefined) continue;
      const before = elims3.length;
      for (const d of digitsOf(g.cands[c])) {
        if (!cl.color.has(nid(c, d))) elims3.push({ cell: c, digit: d });
      }
      if (elims3.length > before && !cell3) {
        cell3 = { c, dark: colorDigit[first]!, light: colorDigit[1 - first]!, removed: elims3.slice(before).map((e) => e.digit) };
      }
    }
    if (cell3) {
      const cellsHit = new Set(elims3.map((e) => e.cell)).size;
      const name = cellName(cell3.c);
      const { dark, light, removed } = cell3;
      // rule 1 found no cell with two candidates of one colour, so each cell
      // hit keeps exactly one dark and one light candidate: narrowed, not
      // solved. A single removal is named; more are named by the conclusion
      // (hintFrames.ts describe)
      return medusaStep(
        cl,
        'medusa3',
        first,
        elims3,
        elims3.length === 1
          ? tr`${name} holds a dark purple ${dark} and a light purple ${light}; one of them is true, so its ${removed[0]} is removed`
          : tr`${name} holds a dark purple ${dark} and a light purple ${light}; one of them is true, so the cell's other candidates are removed` +
              (cellsHit > 1 ? tr` (${cellsHit} cells are narrowed to their two shades this way)` : ''),
        [
          weakTie(
            [
              { cell: cell3.c, digit: dark },
              { cell: cell3.c, digit: light }
            ],
            removed.map((digit) => ({ cell: cell3!.c, digit })),
            removed.length === 1
              ? tr`${name} holds a dark purple ${dark} and a light purple ${light} (the corner brackets); one of them is true, so its ${removed[0]} is false.`
              : tr`${name} holds a dark purple ${dark} and a light purple ${light} (the corner brackets); one of them is true, so its ${listAnd(removed)} are false.`
          )
        ]
      );
    }

    // Rules 4 & 5: uncoloured candidate eliminated by what it sees; the
    // first removal is the one witnessed, and its rule says which colour is
    // dark: the first in reading order for rule 4, the colour it sees
    // outside its cell for rule 5
    const elims45: CellDigit[] = [];
    /** whether each removal sees both shades of its digit (rule 4), not one shade outside its cell and the other in it (rule 5) */
    const seesBoth: boolean[] = [];
    let witnessed: { rule: 'medusa4' | 'medusa5'; dark: number; c: number; d: number; x: number; y: number; own: number } | null = null;
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0) continue;
      // one representative coloured digit of each colour in this cell (rule 5)
      const colorDigit: (number | undefined)[] = [undefined, undefined];
      for (const d of digitsOf(g.cands[c])) {
        const col = cl.color.get(nid(c, d));
        if (col !== undefined) colorDigit[col] = d;
      }
      for (const d of digitsOf(g.cands[c])) {
        if (cl.color.has(nid(c, d))) continue;
        const seen: CellDigit[][] = [[], []];
        for (const n of cl.nodes) {
          if (nDigit(n) === d && sees(c, nCell(n))) seen[cl.color.get(n)!].push(cd(n));
        }
        const target = { cell: c, digit: d };
        // rule 4: sees both colours of its own digit
        if (seen[0].length && seen[1].length) {
          elims45.push(target);
          seesBoth.push(true);
          witnessed ??= { rule: 'medusa4', dark: first, c, d, x: nearest(target, seen[first]).cell, y: nearest(target, seen[1 - first]).cell, own: 0 };
          continue;
        }
        // rule 5: sees colour A of its own digit + opposite colour in its cell
        for (const A of [0, 1]) {
          if (seen[A].length && colorDigit[1 - A] !== undefined) {
            elims45.push(target);
            seesBoth.push(false);
            witnessed ??= { rule: 'medusa5', dark: A, c, d, x: nearest(target, seen[A]).cell, y: c, own: colorDigit[1 - A]! };
            break;
          }
        }
      }
    }
    if (witnessed) {
      const { rule, dark, c, d, x, y, own } = witnessed;
      const n = elims45.length - 1;
      // the removals after the first "fall the same way", as the trap's and
      // Remote Pair's, where the first one's reason holds for each: rule 5's
      // "whichever shade is true" holds for every removal of rules 4 and 5;
      // rule 4's "sees a dark and a light one" not for a rule 5 removal, which
      // sees one shade while its cell holds the other, so then the tail says
      // what holds for both
      const sameWay = rule === 'medusa5' || seesBoth.every(Boolean);
      const tail =
        n <= 0
          ? ''
          : sameWay
            ? n === 1
              ? tr`; one more candidate falls the same way`
              : tr`; ${n} more candidates fall the same way`
            : n === 1
              ? tr`; one more candidate is false whichever shade is true`
              : tr`; ${n} more candidates are false whichever shade is true`;
      const here = cellName(c);
      const there = cellName(x);
      const target = { cell: c, digit: d };
      const darkWitness = weakTie([{ cell: x, digit: d }], [target], tr`If dark purple is true, the ${d} in ${there} is true, and the ${d} in ${here} goes.`);
      if (rule === 'medusa4') {
        const other = cellName(y);
        return medusaStep(
          cl,
          rule,
          dark,
          elims45,
          tr`The ${d} in ${here} sees a dark purple ${d} in ${there} and a light purple ${d} in ${other}, so it is false either way` + tail,
          [
            darkWitness,
            weakTie(
              [{ cell: y, digit: d }],
              [target],
              tr`If light purple is true, the ${d} in ${other} is true, and the ${d} in ${here} goes. Either way it is false` + tail + '.'
            )
          ]
        );
      }
      return medusaStep(
        cl,
        rule,
        dark,
        elims45,
        tr`The ${d} in ${here} sees a dark purple ${d} in ${there} while its own cell holds a light purple ${own}, so whichever shade is true removes it` + tail,
        [
          darkWitness,
          weakTie(
            [{ cell: c, digit: own }],
            [target],
            tr`If light purple is true, ${here} is ${own} (the corner brackets), and its ${d} goes. Either way the ${d} is false` + tail + '.'
          )
        ]
      );
    }

    // Rule 6: an uncoloured cell where every candidate sees colour A ->
    // colour A would empty the cell, so colour A is false, and dark
    for (const A of [0, 1]) {
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0) continue;
        const ds = digitsOf(g.cands[c]);
        if (ds.length === 0) continue;
        if (ds.some((d) => cl.color.has(nid(c, d)))) continue; // must be fully uncoloured
        const emptied = ds.every((d) =>
          cl.nodes.some((n) => nDigit(n) === d && cl.color.get(n) === A && sees(c, nCell(n)))
        );
        if (emptied) {
          // per digit, the nearest dark candidate that would remove it
          const target = cellName(c);
          const witnesses6 = ds.map((d, k) => {
            const there = { cell: c, digit: d };
            const n = nearest(there, cl.nodes.filter((x) => nDigit(x) === d && cl.color.get(x) === A && sees(c, nCell(x))).map(cd));
            const from = cellName(n.cell);
            return weakTie(
              [n],
              [there],
              k === ds.length - 1
                ? tr`If dark purple is true, the ${d} in ${from} is true, and ${target} loses its ${d}. ${target} would then be empty, so dark purple cannot be true.`
                : tr`If dark purple is true, the ${d} in ${from} is true, and ${target} loses its ${d}.`
            );
          });
          return medusaStep(
            cl,
            'medusa6',
            A,
            colored(A).map(cd),
            tr`If dark purple were true, ${target} would lose every one of its candidates (${ds.join(', ')}), so dark purple is false: every dark purple candidate is removed, and every light purple one is true`,
            witnesses6
          );
        }
      }
    }
  }
  return null;
}

const clusters = buildClusters;

/** the rules that prove the dark colour false */
const PROVING = new Set<ColourRule>(['medusa1', 'medusa2', 'medusa6']);

/**
 * A 3D Medusa step: the cluster in its two shades, dark the colour given,
 * with its ties along its shortest drawn tree, then the argument
 */
function medusaStep(cl: Cluster, rule: ColourRule, dark: number, eliminations: CellDigit[], reason: string, argument: ChainLink[]): Step {
  const cands = cl.nodes.map(cd);
  const cluster = shades(cands, (x) => cl.color.get(nid(x.cell, x.digit))!, dark);
  const relations = cl.relations.map(([a, b]): [CellDigit, CellDigit] => [cd(a), cd(b)]);
  const ties = spanningTies(cands, relations, [...cands, ...eliminations]);
  return {
    tech: 'MEDUSA_3D',
    placements: [],
    eliminations,
    links: [
      ...tieLinks(
        ties,
        tr`Each line joins the only two places for a digit in a row, column or box; a cell with only two candidates joins those two, side by side (no line inside a cell). Exactly one of two joined candidates is true, so they take opposite shades: either every dark purple candidate is true, or every light purple one is.`
      ),
      ...argument
    ],
    truth: 'parity',
    colouring: { rule, clusters: [cluster], ...(PROVING.has(rule) ? { darkFalse: 0 as const } : {}) },
    description: tr`3D Medusa: where a row, column or box has only two places for a digit, or a cell has only two candidates, the two take opposite shades of purple, so either every dark purple candidate is true or every light purple one is. ${reason}.`
  };
}
