import { Grid, UNITS, bit, digitsOf, popcount, sees, cellName, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { combinations, unitName } from './subsets';

export interface Als {
  cells: number[];
  mask: number;
}

/** Almost Locked Sets: n cells in one unit with n+1 candidates. */
export function collectAls(g: Grid, maxSize = 4, cap = 600): Als[] {
  const out: Als[] = [];
  const seen = new Set<string>();
  for (const unit of UNITS) {
    const empty = unit.filter((c) => g.values[c] === 0);
    for (let size = 1; size <= Math.min(maxSize, empty.length); size++) {
      for (const combo of combinations(empty, size)) {
        let mask = 0;
        for (const c of combo) mask |= g.cands[c];
        if (popcount(mask) !== size + 1) continue;
        const key = combo.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ cells: combo, mask });
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
  return {
    tech,
    placements: [],
    eliminations: elims,
    primary: allCands(g, A.cells),
    secondary: allCands(g, B.cells),
    labels: {
      primary: `set A: one digit short of locked; ${x} is its restricted common with set B`,
      secondary: `set B: whichever set loses ${x} locks and places ${z}`
    },
    // the restricted common: every x of one set sees every x of the other
    links: [
      {
        from: A.cells.filter((c) => g.cands[c] & bit(x)).map((cell) => ({ cell, digit: x })),
        to: B.cells.filter((c) => g.cands[c] & bit(x)).map((cell) => ({ cell, digit: x })),
        strong: false
      }
    ],
    description: `ALS-XZ: sets ${cellNames(A.cells)} and ${cellNames(B.cells)} share restricted common ${x}; digit ${z} can be removed from cells seeing every ${z} of both sets.`
  };
}

const allCands = (g: Grid, cells: number[]): CellDigit[] =>
  cells.flatMap((cell) => digitsOf(g.cands[cell]).map((digit) => ({ cell, digit })));

/** "a", "a and b", "a, b and c" */
const and = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * A WXYZ-Wing drawn by role, in the terms of docs/glossary_input.md: the
 * bivalue cell, holding the restricted digit x and the removed digit z,
 * and the three cells of the other set. The three cells holding x (now and
 * then two, three only where a Naked Quad comes first) are told apart,
 * because the bivalue cell sees every one of them; the other cells of the
 * three lack x. Only the drawing and the wording differ from ALS-XZ: the
 * search and the removals are the same.
 */
function wxyzStep(g: Grid, A: Als, B: Als, x: number, z: number, elims: CellDigit[]): Step {
  const [linked] = (A.cells.length === 1 ? A : B).cells;
  const set = A.cells.length === 1 ? B : A;
  const seen = set.cells.filter((c) => g.cands[c] & bit(x));
  const rest = set.cells.filter((c) => !(g.cands[c] & bit(x)));
  const unit = unitName(UNITS.findIndex((u) => set.cells.every((c) => u.includes(c))));
  const three = [...set.cells].sort((a, b) => a - b).map(cellName);
  const others = digitsOf(set.mask & ~bit(x)).map(String);
  const name = cellName(linked);
  return {
    tech: 'WXYZ_WING',
    placements: [],
    eliminations: elims,
    primary: allCands(g, seen),
    secondary: allCands(g, rest),
    fins: allCands(g, [linked]),
    labels: {
      primary: `${seen.length === 1 ? 'cell' : 'cells'} whose ${x} the bivalue cell sees`,
      ...(rest.length > 0 && { secondary: rest.length === 1 ? 'other cell of the three' : 'other cells of the three' }),
      fins: 'bivalue cell'
    },
    description: `WXYZ-Wing: bivalue cell ${name} (${digitsOf(g.cands[linked]).join('')}) and the three cells ${and(three)} in ${unit}, which hold ${digitsOf(set.mask).join('')} between them. The ${x} in ${name} sees every ${x} in the three cells. Either ${name} is ${z}, or it is ${x} and the three cells in ${unit} must be ${and(others)}. At least one of the four cells is therefore ${z}, so ${z} is removed from every other cell that sees all the ${z}s among them.`
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
          return {
            tech: 'ALS_XY_WING',
            placements: [],
            eliminations: elims,
            primary: A.cells.flatMap((cell) =>
              digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
            ),
            secondary: B.cells.flatMap((cell) =>
              digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
            ),
            fins: C.cells.flatMap((cell) =>
              digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
            ),
            labels: { primary: `set linked via ${l1.x}`, secondary: `set linked via ${l2.x}`, fins: 'hinge' },
            links: [
              {
                from: A.cells.filter((c) => g.cands[c] & bit(l1.x)).map((cell) => ({ cell, digit: l1.x })),
                to: C.cells.filter((c) => g.cands[c] & bit(l1.x)).map((cell) => ({ cell, digit: l1.x })),
                strong: false
              },
              {
                from: C.cells.filter((c) => g.cands[c] & bit(l2.x)).map((cell) => ({ cell, digit: l2.x })),
                to: B.cells.filter((c) => g.cands[c] & bit(l2.x)).map((cell) => ({ cell, digit: l2.x })),
                strong: false
              }
            ],
            description: `ALS-XY-Wing: hinge ${cellNames(C.cells)} links ${cellNames(A.cells)} (via ${l1.x}) and ${cellNames(B.cells)} (via ${l2.x}); digit ${z} can be removed from cells seeing every ${z} of both outer sets.`
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
            return {
              tech: 'ALS_XY_CHAIN',
              placements: [],
              eliminations: elims,
              primary: [...A.cells, ...D.cells].flatMap((cell) =>
                digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
              ),
              secondary: [...B.cells, ...C.cells].flatMap((cell) =>
                digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
              ),
              labels: {
                primary: `the end sets, which both hold ${z}`,
                secondary: 'the middle sets, each linked to its neighbours by a restricted common digit'
              },
              links: [
                [A, B, l1.x],
                [B, C, l2.x],
                [C, D, l3.x]
              ].map(([P, Q, x]) => ({
                from: (P as Als).cells.filter((c) => g.cands[c] & bit(x as number)).map((cell) => ({ cell, digit: x as number })),
                to: (Q as Als).cells.filter((c) => g.cands[c] & bit(x as number)).map((cell) => ({ cell, digit: x as number })),
                strong: false
              })),
              description: `ALS-XY-Chain: ${cellNames(A.cells)} –${l1.x}– ${cellNames(B.cells)} –${l2.x}– ${cellNames(C.cells)} –${l3.x}– ${cellNames(D.cells)}; digit ${z} falls from cells seeing every ${z} of both end sets.`
            };
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
            return {
              tech: 'DEATH_BLOSSOM',
              placements: [],
              eliminations: elims,
              primary: digitsOf(g.cands[stem]).map((digit) => ({ cell: stem, digit })),
              secondary: chosen.flatMap((A) =>
                A.cells.flatMap((cell) =>
                  digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
                )
              ),
              labels: {
                primary: 'the stem: each of its candidates leads to a petal',
                secondary: `the petals: one set per stem digit, all holding ${z}`
              },
              // each stem digit reaches the petal that holds it
              links: stemDigits.map((p, i) => ({
                from: [{ cell: stem, digit: p }],
                to: chosen[i].cells.filter((c) => g.cands[c] & bit(p)).map((cell) => ({ cell, digit: p })),
                strong: false
              })),
              description: `Death Blossom: stem ${cellName(stem)} links each of its candidates to a petal set; whichever digit the stem takes, some petal locks and places ${z}, so ${z} is removed from cells seeing every ${z} of all petals.`
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
