// A step as one line of the notation the forums read. A chain is written
// in Eureka notation, the lingua franca of r/sudoku and the Enjoy Sudoku
// forum:
//
//   (4=3)r1c6 - (3=1)r5c6 - (1=6)r5c7 - (6=4)r2c7 => r1c9<>4
//
// a node is a candidate (4)r1c6, the two candidates of a cell with the
// strong link between them (4=3)r1c6, a group (2)r3c23, or an ALS with
// the link through it (8=9){r78c8}; = is a strong link, - a weak one; a
// continuous loop ends "- loop". Every other technique is written the way
// HoDoKu writes it: the name, what defines the pattern, => what it does:
//
//   X-Wing: 7 r38 c38 => r2c3<>7
//   Naked Pair: 2,5 in r9c27 => r9c6<>5
//   ALS-XZ: A=r8c2,r9c1 {159}, B=r7c8,r8c9 {159}, X=1, Z=5 => r7c1<>5
//   Simple Colors Trap: 4 (r1c5,r6c4,r8c6) / (r1c6,r5c5,r8c8) => r6c8<>4
//
// Cells are rXcY, a set of them r45c18 when it is rows by columns, else
// by row, by column and singly. Nothing here is translated: the notation
// is the same in every language, and the names are the ones the
// community (and HoDoKu) uses.
import { rowOf, colOf, sees, cellName } from '../engine/board';
import { TECHS } from '../engine/ratings';
import type { Step, CellDigit, ChainLink, ColourRule } from '../engine/steps';
import { isParity } from '../engine/steps';

const uniq = <T>(xs: T[]) => [...new Set(xs)];
const asc = (a: number, b: number) => a - b;
const cellsOf = (cds: readonly CellDigit[]) => uniq(cds.map((cd) => cd.cell)).sort(asc);
const digitsIn = (cds: readonly CellDigit[]) => uniq(cds.map((cd) => cd.digit)).sort(asc);
const sameCells = (a: number[], b: number[]) => a.length === b.length && a.every((c, i) => c === b[i]);
const nums = (xs: number[]) => xs.map((x) => x + 1).join('');

/**
 * Cells written the forum's way: r4c8; a set as r45c18 when it is every
 * cell of some rows and columns, else row by row (r1c25), column by column
 * (r25c3) and singly, in board order, joined by commas.
 */
export function compactCells(cells: readonly number[]): string {
  const set = uniq([...cells]).sort(asc);
  if (!set.length) return '';
  const rows = uniq(set.map(rowOf)).sort(asc);
  const cols = uniq(set.map(colOf)).sort(asc);
  if (rows.length * cols.length === set.length) return `r${nums(rows)}c${nums(cols)}`;
  const terms: { at: number; text: string }[] = [];
  const byRow = new Map<number, number[]>();
  for (const c of set) byRow.set(rowOf(c), [...(byRow.get(rowOf(c)) ?? []), c]);
  const alone: number[] = [];
  for (const [r, cs] of byRow) {
    if (cs.length > 1) terms.push({ at: cs[0], text: `r${r + 1}c${nums(cs.map(colOf))}` });
    else alone.push(cs[0]);
  }
  const byCol = new Map<number, number[]>();
  for (const c of alone) byCol.set(colOf(c), [...(byCol.get(colOf(c)) ?? []), c]);
  for (const [col, cs] of byCol) {
    if (cs.length > 1) terms.push({ at: cs[0], text: `r${nums(cs.map(rowOf))}c${col + 1}` });
    else terms.push({ at: cs[0], text: cellName(cs[0]) });
  }
  return terms
    .sort((a, b) => a.at - b.at)
    .map((t) => t.text)
    .join(',');
}

/** a house by its index in UNITS, as the notation names it: r1, c1, b1 */
const unitCode = (u: number) => (u < 9 ? `r${u + 1}` : u < 18 ? `c${u - 8}` : `b${u - 17}`);

/** houses of one kind written together: r38, c148 */
function unitCodes(units: number[]): string {
  const kinds = [units.filter((u) => u < 9), units.filter((u) => u >= 9 && u < 18), units.filter((u) => u >= 18)];
  return kinds
    .filter((k) => k.length)
    .map((k) => `${unitCode(k[0])[0]}${k.map((u) => unitCode(u).slice(1)).join('')}`)
    .join(' ');
}

/** what the step does: placements as r1c1=5, removals as r1c1<>5 */
export function conclusions(step: Step): string {
  return [
    ...step.placements.map((cd) => `${cellName(cd.cell)}=${cd.digit}`),
    ...step.eliminations.map((cd) => `${cellName(cd.cell)}<>${cd.digit}`)
  ].join(', ');
}

/** a node of the chain: its cells, and the digits the chain passes through in them with the link between each pair */
interface Node {
  cells: number[];
  digits: string[];
  ops: string[];
}

/** a candidate set's digit: one digit for every node the engine draws; several, should one come, as 1|2 */
const nodeDigit = (cds: readonly CellDigit[]) => digitsIn(cds).join('|');

function writeNode(node: Node): string {
  let inside = node.digits[0];
  for (let i = 0; i < node.ops.length; i++) inside += node.ops[i] + node.digits[i + 1];
  // a cell is written plainly, a group as r3c23; an ALS, the cells the
  // chain enters on one digit and leaves on another, in braces
  const cells = compactCells(node.cells);
  return `(${inside})${node.cells.length > 1 && node.ops.length ? `{${cells}}` : cells}`;
}

/**
 * A chain step in Eureka notation, or null when its links are not a
 * chain: a colouring's ties, a forcing chain's trails, an ALS pattern's
 * restricted commons are drawn as links too, but read as patterns.
 */
export function eurekaOf(step: Step): string | null {
  if (isParity(step)) return null;
  const links = step.links;
  if (!links?.length || links.some((l) => l.undirected)) return null;
  const link = (l: ChainLink, i: number) => l.strong === (i % 2 === 0);
  for (let i = 0; i < links.length; i++) {
    // one path, strictly alternating, strong first: the normal form every chain finder writes
    if (!link(links[i], i)) return null;
    if (i > 0 && !sameCells(cellsOf(links[i].from), cellsOf(links[i - 1].to))) return null;
    if (i > 0 && nodeDigit(links[i].from) !== nodeDigit(links[i - 1].to)) return null;
  }
  const first = links[0].from;
  const last = links[links.length - 1];
  const loop =
    links.length > 1 && sameCells(cellsOf(last.to), cellsOf(first)) && nodeDigit(last.to) === nodeDigit(first) ? last : null;
  const path = loop ? links.slice(0, -1) : links;
  const nodes: Node[] = [{ cells: cellsOf(first), digits: [nodeDigit(first)], ops: [] }];
  const joins: string[] = [];
  for (const l of path) {
    const cells = cellsOf(l.to);
    const node = nodes[nodes.length - 1];
    if (sameCells(node.cells, cells)) {
      node.digits.push(nodeDigit(l.to));
      node.ops.push(l.strong ? '=' : '-');
    } else {
      joins.push(l.strong ? ' = ' : ' - ');
      nodes.push({ cells, digits: [nodeDigit(l.to)], ops: [] });
    }
  }
  let text = writeNode(nodes[0]);
  for (let i = 1; i < nodes.length; i++) text += joins[i - 1] + writeNode(nodes[i]);
  if (loop) {
    // a continuous loop closes on a weak link; two strong links meeting at
    // the start is a discontinuous loop, written as a chain back to it
    text += loop.strong ? ` = (${nodes[0].digits[0]})${compactCells(nodes[0].cells)}` : ' - loop';
  }
  return `${text} => ${conclusions(step)}`;
}

/** "2,5 in r9c27": the digits of a colour and where they are; the cells alone when the digits are the pattern's */
function group(cds: readonly CellDigit[], sep: string, known?: string): string {
  const digits = digitsIn(cds).join(sep);
  const cells = compactCells(cellsOf(cds));
  return digits === known ? cells : `${digits} in ${cells}`;
}

/**
 * The almost locked sets a step is made of, lettered in the order its
 * links visit them, each with the digits it holds: the links name the
 * cells a restricted common lives in, and every other highlighted cell
 * joins the one set it shares a house with. Null when a cell could join
 * two, so the sets cannot be told apart.
 */
function alsSets(step: Step): { cells: number[]; digits: number[] }[] | null {
  const links = step.links ?? [];
  if (!links.length) return null;
  const marked = [...(step.primary ?? []), ...(step.secondary ?? []), ...(step.fins ?? [])];
  const sets: number[][] = [];
  const join = (cells: number[]) => {
    const set = sets.find((s) => s.some((c) => cells.includes(c)));
    if (!set) sets.push([...cells]);
    else for (const c of cells) if (!set.includes(c)) set.push(c);
  };
  for (const l of links) {
    join(cellsOf(l.from));
    join(cellsOf(l.to));
  }
  const digitCount = (cells: number[]) => digitsIn(marked.filter((cd) => cells.includes(cd.cell))).length;
  for (const cell of uniq(marked.map((cd) => cd.cell))) {
    if (sets.some((s) => s.includes(cell))) continue;
    let fits = sets.filter((s) => s.every((c) => sees(c, cell)));
    // an almost locked set holds one digit more than it has cells: of two
    // sets the cell could join, its home is the one that stays one
    if (fits.length > 1) fits = fits.filter((s) => digitCount([...s, cell]) === s.length + 2);
    if (fits.length !== 1) return null;
    fits[0].push(cell);
  }
  return sets.map((cells) => ({
    cells: cells.sort(asc),
    digits: digitsIn(marked.filter((cd) => cells.includes(cd.cell)))
  }));
}

/** a colouring's rule as HoDoKu names it; 3D Medusa and Remote Pair, which HoDoKu does not colour, by their own names */
const COLOURING_NAMES: Record<ColourRule, string> = {
  trap: 'Simple Colors Trap',
  wrap: 'Simple Colors Wrap',
  bridge: 'Multi Colors 1',
  seesBoth: 'Multi Colors 2',
  medusa1: '3D Medusa',
  medusa2: '3D Medusa',
  medusa3: '3D Medusa',
  medusa4: '3D Medusa',
  medusa5: '3D Medusa',
  medusa6: '3D Medusa',
  remotePair: 'Remote Pair'
};

/**
 * A colouring as HoDoKu writes one (its SolutionStep): the rule's name,
 * then each cluster's two colours, dark first, in brackets and parted by
 * " / ", the clusters by ", ", purple first. One digit (Simple and Multi
 * Colors) goes first and the colours are cells; 3D Medusa's colours are
 * candidates, 1r7c3, by digit and then cell; a Remote Pair's are its cells
 * by the colour of their lower digit, after the pair's two digits. The
 * removals follow in reading order
 */
function colouringLine(step: Step): string {
  const { rule, clusters } = step.colouring!;
  const name = COLOURING_NAMES[rule];
  // its removals in reading order, as its colours are
  const done = conclusions({ ...step, eliminations: [...step.eliminations].sort((a, b) => a.cell - b.cell || a.digit - b.digit) });
  const cells = (cds: readonly CellDigit[]) => cellsOf(cds).map(cellName).join(',');
  if (rule === 'remotePair') {
    const [{ dark, light }] = clusters;
    const [lo, hi] = digitsIn([...dark, ...light]);
    return `${name}: ${lo}/${hi} (${cells(dark.filter((cd) => cd.digit === lo))}) / (${cells(light.filter((cd) => cd.digit === lo))}) => ${done}`;
  }
  if (rule.startsWith('medusa')) {
    const items = (cds: readonly CellDigit[]) =>
      [...cds]
        .sort((a, b) => a.digit - b.digit || a.cell - b.cell)
        .map((cd) => `${cd.digit}${cellName(cd.cell)}`)
        .join(',');
    return `${name}: ${clusters.map((cl) => `(${items(cl.dark)}) / (${items(cl.light)})`).join(', ')} => ${done}`;
  }
  const digit = digitsIn(clusters.flatMap((cl) => [...cl.dark, ...cl.light])).join('/');
  return `${name}: ${digit} ${clusters.map((cl) => `(${cells(cl.dark)}) / (${cells(cl.light)})`).join(', ')} => ${done}`;
}

/**
 * The HoDoKu line of a step that is not a chain: the technique's name,
 * what defines it, => what it does. Fish name their digit, base and cover
 * houses and fins; singles their house; sets their digits and cells, one
 * colour after another; ALS patterns their sets with the digits in braces;
 * a colouring its clusters' two colours, dark first.
 */
export function hodokuLine(step: Step): string {
  if (isParity(step)) return colouringLine(step);
  const info = TECHS[step.tech];
  const name = info.name;
  const done = conclusions(step);
  const bands = (role: 'primary' | 'secondary') => (step.units ?? []).filter((u) => u.role === role).map((u) => u.unit);
  const primary = step.primary ?? [];
  const secondary = step.secondary ?? [];
  const fins = step.fins ?? [];
  const sep = ['Singles', 'Intersections', 'Subsets'].includes(info.category) ? ',' : '/';

  if (info.category === 'Singles' && step.placements.length === 1 && !step.eliminations.length) {
    const [band] = bands('primary');
    return step.tech === 'HIDDEN_SINGLE' && band !== undefined
      ? `${name}: ${step.placements[0].digit} in ${unitCode(band)} => ${done}`
      : `${name}: ${done}`;
  }

  if (['Basic Fish', 'Finned Fish', 'Complex Fish'].includes(info.category) && bands('primary').length && bands('secondary').length) {
    const digits = digitsIn(primary).join(sep);
    const fin = fins.length ? ` f${compactCells(cellsOf(fins))}` : '';
    return `${name}: ${digits} ${unitCodes(bands('primary'))} ${unitCodes(bands('secondary'))}${fin} => ${done}`;
  }

  if (info.category === 'Almost Locked Sets') {
    const sets = alsSets(step);
    if (sets && sets.length > 1 && step.links?.length) {
      const named = sets.map((s, i) => `${String.fromCharCode(65 + i)}=${compactCells(s.cells)} {${s.digits.join('')}}`);
      const rcs = step.links.map((l) => digitsIn(l.from)[0]);
      const z = digitsIn(step.eliminations);
      const parts = [...named, `${rcs.length === 1 ? 'X' : rcs.length === 2 ? 'X,Y' : 'RCs'}=${rcs.join(',')}`];
      if (z.length === 1) parts.push(`Z=${z[0]}`);
      return `${name}: ${parts.join(', ')} => ${done}`;
    }
  }

  const parts: string[] = [];
  if (primary.length) {
    const [band] = bands('primary');
    parts.push(
      (step.tech === 'LOCKED_CANDIDATES_1' || step.tech === 'LOCKED_CANDIDATES_2') && band !== undefined
        ? `${digitsIn(primary).join(sep)} in ${unitCode(band)}`
        : group(primary, sep)
    );
  }
  const known = primary.length ? digitsIn(primary).join(sep) : undefined;
  if (secondary.length) parts.push(group(secondary, sep, known));
  if (fins.length) parts.push(group(fins, sep, known));
  return `${name}: ${parts.length ? `${parts.join(' / ')} => ` : ''}${done}`;
}

/**
 * A step as the line to paste on a forum: a chain's name and its Eureka
 * notation, any other step as HoDoKu writes it.
 */
export function stepText(step: Step): string {
  const chain = eurekaOf(step);
  return chain ? `${TECHS[step.tech].name}: ${chain}` : hodokuLine(step);
}
