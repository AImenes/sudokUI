import { Grid, UNITS, bit, digitsOf, popcount, sees, cellName, cellNames } from '../board';
import { Step, CellDigit, ChainLink, ChainSet } from '../steps';
import { combinations } from './subsets';
import { aDigit, tr, unitName } from '../text';
import { clashReason } from '../hintFrames';

export interface Als {
  cells: number[];
  mask: number;
  /** the house it was found in (a UNITS index), the first that holds it */
  unit: number;
}

/** Almost Locked Sets: n cells in one unit with n+1 candidates. */
export function collectAls(g: Grid, maxSize = 4, cap = 600): Als[] {
  const out: Als[] = [];
  const seen = new Set<string>();
  for (let u = 0; u < UNITS.length; u++) {
    const empty = UNITS[u].filter((c) => g.values[c] === 0);
    for (let size = 1; size <= Math.min(maxSize, empty.length); size++) {
      for (const combo of combinations(empty, size)) {
        let mask = 0;
        for (const c of combo) mask |= g.cands[c];
        if (popcount(mask) !== size + 1) continue;
        const key = combo.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ cells: combo, mask, unit: u });
        if (out.length >= cap) return out;
      }
    }
  }
  return out;
}

/** x is a restricted common of A and B: every x-cell of A sees every x-cell of B. */
function restrictedCommon(g: Grid, A: Als, B: Als, x: number): boolean {
  const ax = A.cells.filter((c) => g.cands[c] & bit(x));
  const bx = B.cells.filter((c) => g.cands[c] & bit(x));
  if (!ax.length || !bx.length) return false;
  return ax.every((a) => bx.every((b) => sees(a, b)));
}

function alsXzStep(
  g: Grid,
  A: Als,
  B: Als,
  x: number,
  z: number,
  tech: 'ALS_XZ' | 'WXYZ_WING'
): Step | null {
  const zCells = [
    ...A.cells.filter((c) => g.cands[c] & bit(z)),
    ...B.cells.filter((c) => g.cands[c] & bit(z))
  ];
  const elims: CellDigit[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] !== 0) continue;
    if (A.cells.includes(c) || B.cells.includes(c)) continue;
    if (!(g.cands[c] & bit(z))) continue;
    if (zCells.every((zc) => sees(c, zc))) elims.push({ cell: c, digit: z });
  }
  if (!elims.length) return null;
  if (tech === 'WXYZ_WING') return wxyzStep(g, A, B, x, z, elims);
  // A holds the start (HoDoKu's lettering)
  const sets = [alsSet(g, A, 'A'), alsSet(g, B, 'B')];
  return {
    tech,
    placements: [],
    eliminations: elims,
    // the chain it derives: (z)A=(x)A-(x)B=(z)B
    links: alsChain(sets, [0, 1], [x], z),
    truth: 'derived',
    sets,
    description: tr`ALS-XZ: sets A (${cellNames(sets[0].cells)}) and B (${cellNames(sets[1].cells)}) each hold one digit more than they have cells, and every ${x} of A sees every ${x} of B, so at most one of them keeps ${aDigit(x)}. The other loses its ${x}, its other digits fill its cells, and it holds ${aDigit(z)}: A or B holds ${aDigit(z)}, so ${z} is removed from every cell that sees every ${z} of both.`
  };
}

const allCands = (g: Grid, cells: number[]): CellDigit[] =>
  cells.flatMap((cell) => digitsOf(g.cands[cell]).map((digit) => ({ cell, digit })));

/** an almost locked set as a step's set (docs/hint-drawing-sets.md, Data), named by its letter */
export function alsSet(g: Grid, A: Als, letter: string): ChainSet {
  const cells = [...A.cells].sort((a, b) => a - b);
  return { kind: 'als', cells, digits: digitsOf(A.mask), members: allCands(g, cells), unit: A.unit, letter };
}

/**
 * An ALS pattern as the chain it derives (docs/hint-drawing-sets.md,
 * decision 11): (z)A=(x)A-(x)B=(z)B and its longer forms. `order` is the
 * step's sets along the chain (indices into `sets`), `commons` the
 * restricted common between each and the next, and `z` the digit removed.
 * Each set's lock is a strong link inside it, from the digit the chain
 * enters it by to the one it leaves by; the restricted commons are the weak
 * links between them; each end is the set's cells holding that digit.
 */
function alsChain(sets: ChainSet[], order: number[], commons: number[], z: number): ChainLink[] {
  const node = (k: number, d: number) => sets[k].members.filter((m) => m.digit === d);
  return order.flatMap((k, i): ChainLink[] => {
    const enter = i === 0 ? z : commons[i - 1];
    const leave = i === order.length - 1 ? z : commons[i];
    const lock: ChainLink = { from: node(k, enter), to: node(k, leave), strong: true, fromSet: k, toSet: k };
    if (i === order.length - 1) return [lock];
    return [lock, { from: node(k, leave), to: node(order[i + 1], leave), strong: false, fromSet: k, toSet: order[i + 1] }];
  });
}

/**
 * A WXYZ-Wing, in the terms of docs/glossary_input.md: the bivalue cell,
 * holding the restricted digit x and the removed digit z, and the three
 * cells of the other set, in one house, which the bivalue cell's x sees
 * wherever they hold x. It is the ALS-XZ it is, a bivalue cell and a set of
 * three cells, and is drawn and walked as one (the readability report's M3;
 * docs/hint-drawing-sets.md, decision 11): the bivalue cell is set A, where
 * the chain starts, as the description reads it, (z)A=(x)A-(x)B=(z)B, so
 * the walk tells A's lock (if it is not z, it is x), set B, the x link and
 * B's lock (without x, its other digits fill it, and it holds z), and ends
 * on the either/or. Its description is one line (the report's L3) and ends,
 * as the other ALS leads do, on why a cell seeing every z of both loses z; its
 * Copy step line is HoDoKu's wing line from the sets, as it always was
 * (src/content/eureka.ts wingGroups). Only the drawing and the wording
 * differ from ALS-XZ: the search and the removals are the same.
 */
function wxyzStep(g: Grid, A: Als, B: Als, x: number, z: number, elims: CellDigit[]): Step {
  const [one, three] = A.cells.length === 1 ? [A, B] : [B, A];
  const sets = [alsSet(g, one, 'A'), alsSet(g, three, 'B')];
  const name = cellName(one.cells[0]);
  return {
    tech: 'WXYZ_WING',
    placements: [],
    eliminations: elims,
    links: alsChain(sets, [0, 1], [x], z),
    truth: 'derived',
    sets,
    // and why the removed cells lose z, as the other ALS leads end
    description: tr`Either set A, the cell ${name}, is ${z}, or it is ${x}, and then set B, in ${unitName(sets[1].unit)}, holds ${aDigit(z)}. Set A or set B holds ${aDigit(z)}, so no cell that sees every ${z} of both can be ${z}.`
  };
}

function findAlsXzPairs(
  g: Grid,
  accept: (A: Als, B: Als) => boolean,
  tech: 'ALS_XZ' | 'WXYZ_WING'
): Step | null {
  const alses = collectAls(g);
  for (let i = 0; i < alses.length; i++) {
    for (let j = i + 1; j < alses.length; j++) {
      const A = alses[i];
      const B = alses[j];
      if (!accept(A, B)) continue;
      if (A.cells.some((c) => B.cells.includes(c))) continue;
      const common = A.mask & B.mask;
      if (popcount(common) < 2) continue;
      for (const x of digitsOf(common)) {
        if (!restrictedCommon(g, A, B, x)) continue;
        for (const z of digitsOf(common)) {
          if (z === x) continue;
          const step = alsXzStep(g, A, B, x, z, tech);
          if (step) return step;
        }
      }
    }
  }
  return null;
}

/** WXYZ-Wing: the 4-cell/4-candidate special case of ALS-XZ (apex + 3-cell set). */
export function findWxyzWing(g: Grid): Step | null {
  return findAlsXzPairs(
    g,
    (A, B) =>
      Math.min(A.cells.length, B.cells.length) === 1 &&
      Math.max(A.cells.length, B.cells.length) === 3 &&
      popcount(A.mask | B.mask) === 4,
    'WXYZ_WING'
  );
}

export function findAlsXz(g: Grid): Step | null {
  return findAlsXzPairs(g, () => true, 'ALS_XZ');
}

/**
 * ALS-XY-Wing: a hinge set C with two different restricted commons — x to
 * set A and y to set B (x ≠ y). Any digit z common to A and B (z ∉ {x,y})
 * falls from every outside cell that sees all z-candidates of A and B.
 *
 * Justification: suppose such a cell were z. A loses z entirely and locks,
 * placing x in A; that removes x from C (restricted), so C locks and places
 * y; that removes y from B, so B locks and must place z — which the assumed
 * cell also sees. Contradiction.
 */
export interface AlsLink {
  a: number;
  b: number;
  x: number;
}

/** All restricted-common links between disjoint ALS pairs, indexed per ALS. */
export function buildAlsLinks(g: Grid, alses: Als[]): Map<number, AlsLink[]> {
  const byAls = new Map<number, AlsLink[]>();
  for (let i = 0; i < alses.length; i++) {
    for (let j = i + 1; j < alses.length; j++) {
      const A = alses[i];
      const B = alses[j];
      if (A.cells.some((c) => B.cells.includes(c))) continue;
      for (const x of digitsOf(A.mask & B.mask)) {
        if (!restrictedCommon(g, A, B, x)) continue;
        const link = { a: i, b: j, x };
        for (const k of [i, j]) {
          if (!byAls.has(k)) byAls.set(k, []);
          byAls.get(k)!.push(link);
        }
      }
    }
  }
  return byAls;
}

export function findAlsXyWing(g: Grid): Step | null {
  const alses = collectAls(g, 4, 400);
  const byAls = buildAlsLinks(g, alses);

  for (const [hinge, hingeLinks] of byAls) {
    for (let li = 0; li < hingeLinks.length; li++) {
      for (let lj = li + 1; lj < hingeLinks.length; lj++) {
        const l1 = hingeLinks[li];
        const l2 = hingeLinks[lj];
        if (l1.x === l2.x) continue;
        const ai = l1.a === hinge ? l1.b : l1.a;
        const bi = l2.a === hinge ? l2.b : l2.a;
        if (ai === bi || ai === hinge || bi === hinge) continue;
        const A = alses[ai];
        const B = alses[bi];
        const C = alses[hinge];
        if (A.cells.some((c) => B.cells.includes(c))) continue;
        const zMask = A.mask & B.mask & ~bit(l1.x) & ~bit(l2.x);
        for (const z of digitsOf(zMask)) {
          const zCells = [
            ...A.cells.filter((c) => g.cands[c] & bit(z)),
            ...B.cells.filter((c) => g.cands[c] & bit(z))
          ];
          const inPattern = new Set([...A.cells, ...B.cells, ...C.cells]);
          const elims: CellDigit[] = [];
          for (let c = 0; c < 81; c++) {
            if (g.values[c] !== 0 || inPattern.has(c)) continue;
            if (!(g.cands[c] & bit(z))) continue;
            if (zCells.every((zc) => sees(c, zc))) elims.push({ cell: c, digit: z });
          }
          if (!elims.length) continue;
          // HoDoKu's lettering: A and B the wings, linked to the hinge C by x and by y
          const sets = [alsSet(g, A, 'A'), alsSet(g, B, 'B'), alsSet(g, C, 'C')];
          const [a, b, c] = sets.map((set) => cellNames(set.cells));
          return {
            tech: 'ALS_XY_WING',
            placements: [],
            eliminations: elims,
            // the chain it derives: (z)A=(x)A-(x)C=(y)C-(y)B=(z)B
            links: alsChain(sets, [0, 2, 1], [l1.x, l2.x], z),
            truth: 'derived',
            sets,
            // one lead line (the readability report's L3), in plain words (L2):
            // the sets' links and their digits are the walk's, and Copy step's
            description: tr`ALS-XY-Wing: the hinge C (${c}) holds ${aDigit(l1.x)} or ${aDigit(l2.x)}, so wing A (${a}) holds no ${l1.x} or wing B (${b}) no ${l2.x}, and that wing then holds ${aDigit(z)}. A or B holds ${aDigit(z)}, so no cell that sees every ${z} of both can be ${z}.`
          };
        }
      }
    }
  }
  return null;
}

/**
 * ALS-XY-Chain (length 4): sets A–B–C–D joined by restricted commons
 * x1, x2, x3 with x1 ≠ x2 at B and x2 ≠ x3 at C. A digit z present in both
 * ends (z ∉ {x1, x3}) falls from outside cells seeing every z of A and D.
 *
 * Same locking cascade as the ALS-XY-Wing, one set longer: assume such a
 * cell is z → A loses z and locks, placing x1 → B loses x1 and locks,
 * placing x2 → C loses x2 and locks, placing x3 → D loses x3 and locks,
 * placing z — which the assumed cell sees. Contradiction. (Three-set chains
 * are the XY-Wing itself, found earlier in the solve order.)
 */
export function findAlsXyChain(g: Grid): Step | null {
  const alses = collectAls(g, 4, 300);
  const byAls = buildAlsLinks(g, alses);
  let budget = 20000;

  for (const [bIdx, bLinks] of byAls) {
    for (const l1 of bLinks) {
      const aIdx = l1.a === bIdx ? l1.b : l1.a;
      for (const l2 of bLinks) {
        if (l2 === l1 || l2.x === l1.x) continue;
        const cIdx = l2.a === bIdx ? l2.b : l2.a;
        if (cIdx === aIdx) continue;
        const cLinks = byAls.get(cIdx) ?? [];
        for (const l3 of cLinks) {
          if (budget-- <= 0) return null;
          if (l3.x === l2.x) continue;
          const dIdx = l3.a === cIdx ? l3.b : l3.a;
          if (dIdx === aIdx || dIdx === bIdx || dIdx === cIdx) continue;
          if (l3.a !== cIdx && l3.b !== cIdx) continue;
          const A = alses[aIdx];
          const B = alses[bIdx];
          const C = alses[cIdx];
          const D = alses[dIdx];
          const zMask = A.mask & D.mask & ~bit(l1.x) & ~bit(l3.x);
          for (const z of digitsOf(zMask)) {
            const zCells = [
              ...A.cells.filter((c) => g.cands[c] & bit(z)),
              ...D.cells.filter((c) => g.cands[c] & bit(z))
            ];
            const inPattern = new Set([...A.cells, ...B.cells, ...C.cells, ...D.cells]);
            const elims: CellDigit[] = [];
            for (let c = 0; c < 81; c++) {
              if (g.values[c] !== 0 || inPattern.has(c)) continue;
              if (!(g.cands[c] & bit(z))) continue;
              if (zCells.every((zc) => sees(c, zc))) elims.push({ cell: c, digit: z });
            }
            if (!elims.length) continue;
            // A to D along the chain (HoDoKu's lettering)
            const sets = [alsSet(g, A, 'A'), alsSet(g, B, 'B'), alsSet(g, C, 'C'), alsSet(g, D, 'D')];
            const [a, b, c, d] = sets.map((set) => cellNames(set.cells));
            const [x1, x2, x3] = [l1.x, l2.x, l3.x];
            const step: Step = {
              tech: 'ALS_XY_CHAIN',
              placements: [],
              eliminations: elims,
              // the chain it derives: (z)A=(x1)A-(x1)B=(x2)B-(x2)C=(x3)C-(x3)D=(z)D
              links: alsChain(sets, [0, 1, 2, 3], [x1, x2, x3], z),
              truth: 'derived',
              sets,
              description: ''
            };
            // one lead line (the readability report's L3): the chain through the
            // four sets, each with its cells, so Learn explains the removal
            // without a walk (docs/hint-drawing-sets.md, decision 22); why each
            // link holds is the walk's, and the chain's line is Copy step's
            const cascade = tr`ALS-XY-Chain: if set A (${a}) holds no ${z}, it holds ${aDigit(x1)}; then set B (${b}) holds no ${x1} and holds ${aDigit(x2)}, C (${c}) no ${x2} and ${aDigit(x3)}, and D (${d}) no ${x3} and ${aDigit(z)}.`;
            // where the sets share cells the chain may clash (docs/hint-drawing-sets.md,
            // decision 13): the premise is then impossible, and the removal rests on A alone
            const ends = clashReason(step) || tr`A or D holds ${aDigit(z)}, so no cell that sees every ${z} of both can be ${z}.`;
            step.description = `${cascade} ${ends}`;
            return step;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Death Blossom: a stem cell whose every candidate p links to a petal ALS
 * (all p-cells of the petal see the stem). Whatever the stem is, one petal
 * becomes a locked set, so a digit z common to all petals is placed in one of
 * them; cells seeing every z of every petal lose z.
 */
export function findDeathBlossom(g: Grid): Step | null {
  const alses = collectAls(g);
  for (let stem = 0; stem < 81; stem++) {
    if (g.values[stem] !== 0) continue;
    const stemDigits = digitsOf(g.cands[stem]);
    if (stemDigits.length < 2 || stemDigits.length > 3) continue;
    // petal candidates per stem digit
    const petals: Als[][] = stemDigits.map((p) =>
      alses
        .filter(
          (A) =>
            !A.cells.includes(stem) &&
            A.mask & bit(p) &&
            A.cells
              .filter((c) => g.cands[c] & bit(p))
              .every((c) => sees(c, stem))
        )
        .slice(0, 16)
    );
    if (petals.some((list) => list.length === 0)) continue;

    const pick = (idx: number, chosen: Als[]): Step | null => {
      if (idx === stemDigits.length) {
        // digits common to all petals, excluding stem candidates
        let common = 0x1ff & ~g.cands[stem];
        for (const A of chosen) common &= A.mask;
        for (const z of digitsOf(common)) {
          const zCells = chosen.flatMap((A) =>
            A.cells.filter((c) => g.cands[c] & bit(z))
          );
          if (!zCells.length) continue;
          const inPattern = new Set([stem, ...chosen.flatMap((A) => A.cells)]);
          const elims: CellDigit[] = [];
          for (let c = 0; c < 81; c++) {
            if (g.values[c] !== 0 || inPattern.has(c)) continue;
            if (!(g.cands[c] & bit(z))) continue;
            if (zCells.every((zc) => sees(c, zc))) elims.push({ cell: c, digit: z });
          }
          if (elims.length) {
            // the petals, lettered in stem-digit order (HoDoKu's lettering); the stem is no set
            const sets = chosen.map((A, i) => alsSet(g, A, String.fromCharCode(65 + i)));
            const holding = (k: number, d: number) => sets[k].members.filter((m) => m.digit === d);
            return {
              tech: 'DEATH_BLOSSOM',
              placements: [],
              eliminations: elims,
              // the pattern, until phase 5 draws its branches: every petal's z
              // in the pattern's colour, and what it acts through, the stem's
              // candidates and each petal's digit the stem sees
              primary: sets.flatMap((_, k) => holding(k, z)),
              secondary: [...stemDigits.map((digit) => ({ cell: stem, digit })), ...stemDigits.flatMap((p, k) => holding(k, p))],
              labels: {
                primary: tr`${z} in every petal: whichever digit the stem takes, a petal holds ${aDigit(z)}`,
                secondary: tr`the stem's candidates, and each petal's digit the stem sees`
              },
              // each stem digit's branch (docs/hint-drawing-sets.md, decision
              // 15): a weak tie from the stem's p to its petal's, which claims
              // no truth, and the petal's lock, from its p to its z
              links: stemDigits.flatMap((p, k): ChainLink[] => [
                { from: [{ cell: stem, digit: p }], to: holding(k, p), strong: false, undirected: true, toSet: k },
                { from: holding(k, p), to: holding(k, z), strong: true, fromSet: k, toSet: k }
              ]),
              sets,
              description: blossomText(stem, stemDigits, sets, z)
            };
          }
        }
        return null;
      }
      for (const A of petals[idx]) {
        // petals must not overlap each other
        if (chosen.some((B) => B.cells.some((c) => A.cells.includes(c)))) continue;
        const res = pick(idx + 1, [...chosen, A]);
        if (res) return res;
      }
      return null;
    };
    const step = pick(0, []);
    if (step) return step;
  }
  return null;
}

/**
 * A Death Blossom's description, one sentence per number of petals: the
 * stem, each petal with the stem's digit it is for, and why whichever
 * digit the stem takes leaves a petal holding z
 */
function blossomText(stem: number, digits: number[], sets: ChainSet[], z: number): string {
  const at = cellName(stem);
  const [a, b, c] = sets.map((set) => cellNames(set.cells));
  const [p, q, r] = digits;
  return digits.length === 3
    ? tr`Death Blossom: the stem ${at} holds ${p}, ${q} and ${r}, and each has a petal, an almost locked set whose copies of that digit all see the stem: A (${a}) for ${p}, B (${b}) for ${q} and C (${c}) for ${r}. Whichever digit the stem takes, its petal loses that digit, fills its cells with its other digits and holds ${aDigit(z)}, so ${z} is removed from every cell that sees every ${z} of every petal.`
    : tr`Death Blossom: the stem ${at} holds ${p} and ${q}, and each has a petal, an almost locked set whose copies of that digit all see the stem: A (${a}) for ${p} and B (${b}) for ${q}. Whichever digit the stem takes, its petal loses that digit, fills its cells with its other digits and holds ${aDigit(z)}, so ${z} is removed from every cell that sees every ${z} of every petal.`;
}
