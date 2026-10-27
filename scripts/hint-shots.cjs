// Photographs of the hint drawings, for the reviews (docs/hint-drawing.md,
// Checking it; docs/hint-drawing-handoff.md). Nothing here is deployed;
// write the pictures somewhere git-ignored, such as .vite/.
//
// The app's own board, with a dev server running (npx vite --port 4174):
//
//   node scripts/hint-shots.cjs <outDir> [TECH ...]
//       every stored example with links (or the techniques named), full
//       view; <TECH>-<theme>-<desktop|phone>[-walkN][-panel].png
//   node scripts/hint-shots.cjs <outDir> --puzzle <puzzle> <steps> [TECH]
//       the hint after <steps> steps of the puzzle's solve path (the
//       solver's next step, or TECH's finder's step there, as the drawing
//       fixtures find it)
//
//   env: BASE (http://localhost:4174), THEMES (dark,light,rose,forest),
//   SIZES (desktop,phone), WALK=1 every walk frame, PANEL=1 the hint panel
//   too, PLAYER=1 the board again over the player's own cell colours,
//   TRAINER=1 the chain trainer building the X-Chain, XY-Chain and AIC
//   examples, PW_CHROMIUM a browser of your own
//
// PLAYER=1 paints the cells of the hint's sets and groups (for a step with
// none, the cells of its links), and beside each the cell to its right (to
// its left in column 9), in one of the player's nine colours, none
// elsewhere: the full view in each colour in turn,
// <TECH>-<theme>-<size>-player<1-9>.png, and with WALK=1 every walk frame
// once, its colour turning frame by frame, -walkN-player<k>.png. The
// colours are the player's own (src/ui/Grid.tsx PALETTE, in the order the
// colour keys give them), drawn as the app draws them, under the hint.
//
// The Learn diagrams, from the page scripts/hint-gallery.ts writes:
//
//   node scripts/hint-shots.cjs <outDir> --gallery <gallery.html>
//
// Each position is loaded through the game store (#s= with auto candidates
// and the position's removals excluded) and the step shown through it, so
// the drawing is that step's and nothing else.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const [out, ...rest] = process.argv.slice(2);
if (!out) {
  console.error('usage: node scripts/hint-shots.cjs <outDir> [TECH ...] | --puzzle <puzzle> <steps> [TECH] | --gallery <html>');
  process.exit(1);
}
const BASE = process.env.BASE || 'http://localhost:4174';
const THEMES = (process.env.THEMES || 'dark,light,rose,forest').split(',');
const SIZES = { desktop: { width: 1280, height: 1000, dpr: 1 }, phone: { width: 390, height: 844, dpr: 2 } };
const sizes = (process.env.SIZES || 'desktop,phone').split(',');
const launch = () => chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

/** in the page: a position as the store's cells, from its values, its candidates and the puzzle's givens */
const loadInPage = async ({ values, cands, given }) => {
  const gs = await import('/src/state/gameStore.ts');
  const board = await import('/src/engine/board.ts');
  const basic = board.gridFromValues(values);
  const cells = values.map((v, i) => ({ given: given[i], value: v, corner: 0, center: 0, excluded: v ? 0 : basic.cands[i] & ~cands[i], colors: [] }));
  if (!gs.useGame.getState().loadPosition(gs.encodePosition(cells, true))) throw new Error('the position did not load');
};

/** in the page: the cells the player's colours go under, from the hint shown (PLAYER=1, above) */
const paintedInPage = async () => {
  const step = (await import('/src/state/gameStore.ts')).useGame.getState().hint;
  const own = step.sets?.length ? step.sets.flatMap((x) => x.cells) : (step.links ?? []).flatMap((l) => [...l.from, ...l.to].map((cd) => cd.cell));
  const cells = new Set(own);
  for (const c of own) cells.add(c % 9 === 8 ? c - 1 : c + 1);
  return [...cells].sort((a, b) => a - b);
};

/** in the page: the player's colour k (0-8) on the cells given and none elsewhere, or none at all (k null); the hint stays as it is */
const paintInPage = async ({ cells, k }) => {
  const gs = await import('/src/state/gameStore.ts');
  const on = new Set(cells);
  gs.useGame.setState((s) => ({ cells: s.cells.map((c, i) => ({ ...c, colors: k !== null && on.has(i) ? [k] : [] })) }));
};

/** in the page: the hint's full view, or frame i of its walk */
const viewInPage = async (i) => {
  const { useGame } = await import('/src/state/gameStore.ts');
  useGame.getState().showStep(useGame.getState().hint);
  if (i === null) return;
  useGame.getState().walkHint();
  for (let j = 0; j < i; j++) useGame.getState().walkHint(1);
};

/** the board over the player's own colours: the full view in each of the nine, then each walk frame in one, turning */
async function shootPlayer(page, base, frames) {
  const cells = await page.evaluate(paintedInPage);
  await page.evaluate(viewInPage, null);
  for (let k = 0; k < 9; k++) {
    await page.evaluate(paintInPage, { cells, k });
    await page.waitForTimeout(80);
    await page.locator('svg.board').screenshot({ path: path.join(out, `${base}-player${k + 1}.png`) });
  }
  if (process.env.WALK && frames >= 2) {
    for (let i = 0; i < frames; i++) {
      await page.evaluate(paintInPage, { cells, k: i % 9 });
      await page.evaluate(viewInPage, i);
      await page.waitForTimeout(80);
      await page.locator('svg.board').screenshot({ path: path.join(out, `${base}-walk${i + 1}-player${(i % 9) + 1}.png`) });
    }
  }
  await page.evaluate(paintInPage, { cells, k: null });
  await page.evaluate(viewInPage, null);
}

async function shoot(page, base, frames) {
  await page.waitForTimeout(150);
  await page.locator('svg.board').screenshot({ path: path.join(out, `${base}.png`) });
  if (process.env.PANEL) await page.locator('.hint-panel').screenshot({ path: path.join(out, `${base}-panel.png`) });
  if (!process.env.WALK || frames < 2) return;
  for (let i = 0; i < frames; i++) {
    await page.evaluate(async (i) => {
      const s = (await import('/src/state/gameStore.ts')).useGame.getState();
      if (i === 0) s.walkHint();
      else s.walkHint(1);
    }, i);
    await page.waitForTimeout(80);
    await page.locator('svg.board').screenshot({ path: path.join(out, `${base}-walk${i + 1}.png`) });
    if (process.env.PANEL) await page.locator('.hint-panel').screenshot({ path: path.join(out, `${base}-walk${i + 1}-panel.png`) });
  }
}

/** the plain shots, then, with PLAYER=1, the board over the player's colours */
async function shootAll(page, base, frames) {
  await shoot(page, base, frames);
  if (process.env.PLAYER) await shootPlayer(page, base, frames);
}

async function board(mode) {
  const examples = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/content/examples.json'), 'utf8'));
  const browser = await launch();
  for (const size of sizes) {
    const s = SIZES[size];
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dpr, ...(size === 'phone' ? { hasTouch: true, isMobile: true } : {}) });
    await ctx.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    await page.goto(BASE + '/');
    await page.locator('svg.board').waitFor();
    for (const theme of THEMES) {
      await page.evaluate(async (theme) => (await import('/src/state/settings.ts')).useSettings.setState({ theme, lang: 'en' }), theme);
      if (mode.puzzle) {
        const r = await page.evaluate(
          async ({ puzzle, steps, tech, load }) => {
            const board = await import('/src/engine/board.ts');
            const hs = await import('/src/engine/humanSolver.ts');
            const hf = await import('/src/engine/hintFrames.ts');
            const g = board.parseGrid(puzzle);
            for (let i = 0; i < steps; i++) hs.applyStep(g, hs.findNextStep(g));
            const step = tech ? hs.findStep(tech, g) : hs.findNextStep(g);
            if (!step || (tech && step.tech !== tech)) throw new Error('no such step there');
            await new Function('return ' + load)()({ values: [...g.values], cands: [...g.cands], given: [...g.given].map(Boolean) });
            (await import('/src/state/gameStore.ts')).useGame.getState().showStep(step);
            return hf.walkFrames(step).map((f) => f.text);
          },
          { ...mode.puzzle, load: loadInPage.toString() }
        );
        const base = `${mode.puzzle.tech ?? 'step'}-${mode.puzzle.steps}-${theme}-${size}`;
        await shootAll(page, base, r.length);
        fs.writeFileSync(path.join(out, `${base}.txt`), r.join('\n') + '\n');
        console.log('shot', base);
        continue;
      }
      for (const tech of mode.techs) {
        const ex = examples[tech];
        const frames = await page.evaluate(
          async ({ ex, load }) => {
            await new Function('return ' + load)()({ values: [...ex.values].map(Number), cands: ex.cands, given: [...ex.puzzle].map((c) => c !== '.' && c !== '0') });
            (await import('/src/state/gameStore.ts')).useGame.getState().showStep(ex.step);
            return (await import('/src/engine/hintFrames.ts')).walkFrames(ex.step).length;
          },
          { ex, load: loadInPage.toString() }
        );
        await shootAll(page, `${tech}-${theme}-${size}`, frames);
        console.log('shot', `${tech}-${theme}-${size}`);
      }
      if (process.env.TRAINER) {
        for (const tech of ['X_CHAIN', 'XY_CHAIN', 'AIC']) {
          const ex = examples[tech];
          const nodes = [ex.step.links[0].from[0], ...ex.step.links.map((l) => l.to[0])];
          await page.evaluate(
            async ({ ex, nodes, load }) => {
              await new Function('return ' + load)()({ values: [...ex.values].map(Number), cands: ex.cands, given: [...ex.puzzle].map((c) => c !== '.' && c !== '0') });
              const gs = await import('/src/state/gameStore.ts');
              gs.useGame.getState().startChain(ex.step.eliminations);
              // one short of the end with suggestions on, so the gold shows beside the truth
              for (const n of nodes.slice(0, -1)) gs.useGame.getState().chainTap(n.cell, n.digit);
              gs.useGame.getState().chainToggleSuggest();
            },
            { ex, nodes, load: loadInPage.toString() }
          );
          const base = `trainer-${tech}-${theme}-${size}`;
          await page.waitForTimeout(150);
          await page.locator('svg.board').screenshot({ path: path.join(out, `${base}-suggest.png`) });
          await page.evaluate(async (last) => {
            const s = (await import('/src/state/gameStore.ts')).useGame.getState();
            s.chainToggleSuggest();
            s.chainTap(last.cell, last.digit);
          }, nodes[nodes.length - 1]);
          await page.waitForTimeout(150);
          await page.locator('svg.board').screenshot({ path: path.join(out, `${base}.png`) });
          await page.locator('.hint-panel').screenshot({ path: path.join(out, `${base}-panel.png`) });
          await page.evaluate(async () => (await import('/src/state/gameStore.ts')).useGame.getState().endChain());
          console.log('shot', base);
        }
      }
    }
    await ctx.close();
  }
  await browser.close();
}

async function gallery(html) {
  const browser = await launch();
  for (const [name, width, dpr] of [['desktop', 1400, 1], ['phone', 390, 2]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: dpr });
    await page.goto('file://' + path.resolve(html));
    const ids = await page.$$eval('figure', (fs) => fs.map((f) => f.id));
    for (const id of ids) await page.locator(`figure#${id}`).screenshot({ path: path.join(out, `${id}-${name}.png`) });
    console.log(name, ids.length, 'figures');
    await page.close();
  }
  await browser.close();
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  if (rest[0] === '--gallery') return gallery(rest[1]);
  if (rest[0] === '--puzzle') return board({ puzzle: { puzzle: rest[1], steps: Number(rest[2]), tech: rest[3] } });
  const examples = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/content/examples.json'), 'utf8'));
  return board({ techs: rest.length ? rest : Object.keys(examples).filter((t) => examples[t].step.links) });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
