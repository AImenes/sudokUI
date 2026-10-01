// Finds one real, engine-verified example position per technique for the
// /learn/ pages and the in-app guide (src/content/examples.json), and
// measures how often each technique is needed (src/content/frequency.json).
//
//   npx vite-node scripts/hunt-examples.ts             hunt for 15 minutes
//   npx vite-node scripts/hunt-examples.ts 40          hunt for 40 minutes
//   npx vite-node scripts/hunt-examples.ts refresh     re-derive the stored
//                                                      steps from their puzzles
//
// Hunting keeps whatever is already stored and only replaces an example
// with a clearer one (a smaller pattern on a fuller board). Run `refresh`
// after changing a finder or its description: tests/examples.test.ts
// fails when the stored steps no longer match what the engine produces.
//
// Random generation almost never produces the rarest patterns (an Exocet,
// a Tridagon, a forcing net), so the hunt starts from SEEDS: published
// puzzles known to need them. A seed is only a candidate: the example is
// still whatever the sudokUI engine does with that puzzle, verified like
// any other. Seeds never count towards the frequencies.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { generatePuzzle, cleanTechniques } from '../src/engine/generator';
import { Grid, cloneGrid, gridToString, parseGrid } from '../src/engine/board';
import { countSolutions } from '../src/engine/bruteForce';
import { ratePuzzle, applyStep } from '../src/engine/humanSolver';
import { SOLVE_ORDER, TECHS, Tech } from '../src/engine/ratings';
import { Example } from '../src/content/boardSvg';

const WIKI = 'sudokuwiki.org';
const HODOKU = 'HoDoKu';
const SEEDS: { puzzle: string; credit: string }[] = [
  // X-Cycles
  { credit: WIKI, puzzle: '003000100500670000700009006034705600000000000008406930900300002000052009001000500' },
  { credit: WIKI, puzzle: '100000200000000304040506000070008040008040100090200060000107080507000000003000009' },
  // Aligned Pair Exclusion
  { credit: WIKI, puzzle: '090000040030040700000670003200900506006000100104008007700091000009030050060000070' },
  { credit: WIKI, puzzle: '000000000600598004000700520090002040201000806070800050062007000800634009000000000' },
  { credit: WIKI, puzzle: '000000370706000000000102009007030500530406028004010900600305000000000403083000000' },
  { credit: WIKI, puzzle: '004003600000040002900600005700500030000367000050004001200005009500010000003200800' },
  { credit: WIKI, puzzle: '450900000006000900080020030000500000640000075001008000070080040002000600000001023' },
  { credit: WIKI, puzzle: '000000106002590000308040000080000070000204000090070040000050603000038900105000000' },
  { credit: WIKI, puzzle: '070000640090700800008000001000300084681000000000050060200009000040200003003001000' },
  // Cell Forcing Chains
  { credit: WIKI, puzzle: '006019500907000043080000000804100000000605000000002904000000020540000607002980300' },
  { credit: WIKI, puzzle: '020006030008000601004050009000300002030090010800005000600070500509000800080500060' },
  { credit: WIKI, puzzle: '700000008010004030060200009000700002005900100940005000600001090070600080800000001' },
  { credit: WIKI, puzzle: '008907000070040010060501000630000900009000800007000035000603020040070060000104700' },
  // Unit Forcing Chains
  { credit: WIKI, puzzle: '800000205007030004000214000002007000090000070000400600030650000500080100106000007' },
  { credit: WIKI, puzzle: '050406030009000600700000002005600008002004700100003900000000001004000200070109060' },
  { credit: WIKI, puzzle: '600090050100008006005603400009807000200000008000405900004201300700300004030080001' },
  { credit: WIKI, puzzle: '003010470800907001070000000002100304000000000304002700000000030100506009098070100' },
  { credit: WIKI, puzzle: '080500071030000600005004000000000400000380100800006000000002560500643700300008009' },
  { credit: WIKI, puzzle: '706010004000708000000000260500391000002006005000050719020000000008000300003020000' },
  // Exocet
  { credit: 'Fata Morgana', puzzle: '000000003001005600090040070000009050700050008050402000080020090003500100600000000' },
  { credit: WIKI, puzzle: '007020004930000600600300000000000050200010008006900400003700900020050001000008000' },
  { credit: WIKI, puzzle: '900000006050300010020400003000100280000860070030004000000020800400500060090000005' },
  { credit: WIKI, puzzle: '400000002005082900020000030008010000560090078000060500010000060006150700300000004' },
  { credit: WIKI, puzzle: '047000000500000700680700000700002000008500600900031000005900000400000012000000034' },
  { credit: WIKI, puzzle: '100200300040010020002005000604000070000070000070000802000900500060040080001003009' },
  { credit: WIKI, puzzle: '000400010010305709000090000250040000001200600030009080090060000300008004070000020' },
  { credit: WIKI, puzzle: '060000009020005000008070100007003000830010097000400800004080900000600010500000020' },
  // Hidden Quad
  { credit: WIKI, puzzle: '007030000500400060800100009092500700000000000030009510300008007070006008000020600' },
  // Franken fish (HoDoKu's own example; its Avoidable Rectangle and Franken
  // X-Wing examples are mid-solve positions, not puzzles, so they cannot seed)
  { credit: HODOKU, puzzle: '006700091009000062300000000000030004007200010400001000031008075000900000065000030' },
  // famous hard puzzles
  { credit: 'AI Escargot', puzzle: '100007090030020008009600500005300900010080002600004000300000010040000007007000300' },
  { credit: 'Easter Monster', puzzle: '100000002090400050006000700050903000000070000000850040700000600030009080002000001' },
  { credit: 'Golden Nugget', puzzle: '000000039000001005003050800008090006070002000100400000009080050020000600400700000' },
  { credit: 'Arto Inkala, 2012', puzzle: '800000000003600000070090200050007000000045700000100030001000068008500010090000400' },
  { credit: 'Platinum Blonde', puzzle: '000000012000000003002300400001800005060070800000009000008500000900040500470006000' }
];

interface Frequency {
  /** generated puzzles rated (seeds excluded) */
  sample: number;
  /** puzzles whose solve path needs the technique at least once */
  counts: Partial<Record<Tech, number>>;
}

const EXAMPLES = join(process.cwd(), 'src/content/examples.json');
const FREQUENCY = join(process.cwd(), 'src/content/frequency.json');
const stored: Partial<Record<Tech, Example>> = existsSync(EXAMPLES)
  ? JSON.parse(readFileSync(EXAMPLES, 'utf8'))
  : {};
const frequency: Frequency = existsSync(FREQUENCY)
  ? JSON.parse(readFileSync(FREQUENCY, 'utf8'))
  : { sample: 0, counts: {} };

const wanted = SOLVE_ORDER.filter((t) => t !== 'BRUTE_FORCE');
const isSingle = (tech: Tech) => TECHS[tech].category === 'Singles';

/** the example for `tech` at its first occurrence in the solve path */
function exampleFrom(puzzle: string, tech: Tech, credit?: string): Example | null {
  const rating = ratePuzzle(puzzle);
  if (!rating || !rating.solvable) return null;
  const stepIndex = rating.steps.findIndex((s) => s.tech === tech);
  if (stepIndex < 0) return null;
  const g = parseGrid(puzzle) as Grid;
  for (let i = 0; i < stepIndex; i++) applyStep(g, rating.steps[i]);
  return {
    puzzle,
    stepIndex,
    values: Array.from(g.values).join(''),
    cands: Array.from(g.cands).map((c, i) => (g.values[i] ? 0 : c)),
    step: rating.steps[stepIndex],
    ...(credit ? { credit } : {})
  };
}

/** lower is clearer: a small pattern, few links, a well-filled board */
function clutter(e: Example): number {
  const marks =
    (e.step.primary?.length ?? 0) + (e.step.secondary?.length ?? 0) + (e.step.fins?.length ?? 0);
  const links = e.step.links?.length ?? 0;
  const empty = e.values.split('').filter((v) => v === '0').length;
  return marks * 4 + links * 6 + empty + e.step.description.length / 40;
}

/** offer every technique this puzzle reaches cleanly as a candidate example */
function consider(puzzle: string, credit?: string): Tech[] {
  const rating = ratePuzzle(puzzle);
  if (!rating || !rating.solvable) return [];
  // only techniques reached without anything harder before them, as in
  // practice mode: the example position is then within a learner's reach
  for (const tech of cleanTechniques(rating)) {
    if (!wanted.includes(tech) || isSingle(tech)) continue;
    const candidate = exampleFrom(puzzle, tech, credit);
    if (!candidate) continue;
    const current = stored[tech];
    // a generated puzzle beats a published one: it carries no credit line
    if (!current || (!credit && current.credit) || (!!credit === !!current.credit && clutter(candidate) < clutter(current))) {
      if (!current) console.log(`+ ${tech}${credit ? ` (${credit})` : ''}`);
      stored[tech] = candidate;
    }
  }
  for (const tech of ['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'] as Tech[]) {
    if (!stored[tech]) {
      const candidate = exampleFrom(puzzle, tech, credit);
      if (candidate) stored[tech] = candidate;
    }
  }
  return Object.keys(rating.techniques) as Tech[];
}

const save = () => {
  const ordered: Partial<Record<Tech, Example>> = {};
  for (const tech of SOLVE_ORDER) if (stored[tech]) ordered[tech] = stored[tech];
  writeFileSync(EXAMPLES, JSON.stringify(ordered, null, 1) + '\n');
  const counts: Partial<Record<Tech, number>> = {};
  for (const tech of SOLVE_ORDER) counts[tech] = frequency.counts[tech] ?? 0;
  writeFileSync(FREQUENCY, JSON.stringify({ sample: frequency.sample, counts }, null, 1) + '\n');
};

if (process.argv.includes('refresh')) {
  let changed = 0;
  for (const tech of Object.keys(stored) as Tech[]) {
    const fresh = exampleFrom(stored[tech]!.puzzle, tech, stored[tech]!.credit);
    if (!fresh) {
      console.log(`${tech}: the stored puzzle no longer needs this technique, example dropped`);
      delete stored[tech];
      changed++;
    } else if (JSON.stringify(fresh) !== JSON.stringify(stored[tech])) {
      stored[tech] = fresh;
      changed++;
    }
  }
  save();
  console.log(`refreshed: ${changed} example(s) changed, ${Object.keys(stored).length} stored`);
} else {
  const minutes = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 15);
  const deadline = Date.now() + minutes * 60_000;

  // seeds first: published puzzles, plus every puzzle our own tests use
  const fixtures = readdirSync('tests')
    .filter((f) => f.endsWith('.test.ts'))
    .flatMap((f) => readFileSync(join('tests', f), 'utf8').match(/(?<![0-9.])[0-9.]{81}(?![0-9.])/g) ?? []);
  const seeds = [...SEEDS, ...[...new Set(fixtures)].map((puzzle) => ({ puzzle, credit: '' }))];
  let usable = 0;
  for (const seed of seeds) {
    const grid = parseGrid(seed.puzzle);
    if (!grid || countSolutions(cloneGrid(grid), 2) !== 1) {
      console.log(`seed rejected (not a puzzle with one solution): ${seed.credit} ${seed.puzzle.slice(0, 12)}…`);
      continue;
    }
    usable++;
    consider(gridToString(grid), seed.credit || undefined);
  }
  console.log(`${usable} of ${seeds.length} seeds usable; ${Object.keys(stored).length} examples so far`);
  save();

  let lastSave = Date.now();
  while (Date.now() < deadline) {
    const grid = generatePuzzle(Math.random() < 0.7 ? 'rotational' : 'none');
    const puzzle = gridToString(grid);
    const used = consider(puzzle);
    if (used.length) {
      frequency.sample++;
      for (const tech of used) frequency.counts[tech] = (frequency.counts[tech] ?? 0) + 1;
    }
    if (Date.now() - lastSave > 60_000) {
      save();
      lastSave = Date.now();
    }
  }
  save();
  const missing = wanted.filter((t) => !stored[t]);
  console.log(`${frequency.sample} generated puzzles counted; ${Object.keys(stored).length} examples stored`);
  console.log(missing.length ? `still without an example: ${missing.join(', ')}` : 'every technique has an example');
}
