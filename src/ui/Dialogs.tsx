// Game dialogs: new game, practice (full technique catalogue), import/export,
// generation progress and victory — plus useNewGame, the hook that ties the
// puzzle pools, the generation worker and the game store together.
import React, { useState, useEffect, useRef } from 'react';
import {
  useGame,
  validatePuzzle,
  solvePath,
  encodePosition,
  contractGrid,
  hasManualMarks,
  markSlip,
  stepMatchesSolution
} from '../state/gameStore';
import { findAllSteps } from '../engine/humanSolver';
import { Step } from '../engine/steps';
import { Level, LEVELS, Tech, TECHS, PRACTICE_TECHS, ALL_TECHS, Category, SOLVE_ORDER, NOT_PRACTISABLE } from '../engine/ratings';
import { requestPuzzle, takePoolEntry, levelKey, techKey, poolSize, filePoolEntries, practisable, GenerationHandle } from '../state/pools';
import { useStats, gameSummary, dailyStreak } from '../state/stats';
import { practiceSeeds } from '../content/practicePuzzles';
import { seedPuzzles, SEEDED_LEVELS } from '../content/seeds';
import { cruxIndex } from '../engine/generator';
import { timeVerdict, percentileText, MODE_LABEL, SolveMode } from '../content/solveTimes';
import { useT, translator, msg, rich, langRoot, Translator } from '../content/i18n';
import { HubTabs } from './HubTabs';
import { techniquesByFamily } from '../content/categories';
import { useLearnLocale } from './useLearnLocale';
import type { LearnLocale } from '../content/learnLocale';
import { BAND_LEADS, BAND_NOTES } from '../content/rating';
import { TECH_DOCS } from '../content/techniqueDocs';
import { KIN } from '../content/kin';
import { useSettings } from '../state/settings';
import type { Lang } from '../state/settings';

/** what is being generated: a band's puzzle or a technique's practice puzzle */
type GenRequest = { kind: 'level'; level: Level } | { kind: 'tech'; tech: Tech };

interface GenState {
  label: GenRequest;
  attempts: number;
  handle: GenerationHandle;
}

/** keep the pool of a band or technique stocked, in the background and rated in full */
function topUp(req: { kind: 'level'; level: Level } | { kind: 'tech'; tech: Tech }) {
  const key = req.kind === 'level' ? levelKey(req.level) : techKey(req.tech);
  if (poolSize(key) >= 2) return;
  requestPuzzle(req).promise.then((entry) => entry && filePoolEntries([entry]));
}

/**
 * Stock the seeded bands' pools from seed isomorphs while the app is idle,
 * so even the first Nightmare starts at once. Called once after start-up.
 */
export async function warmSeededPools() {
  for (const level of SEEDED_LEVELS) {
    if (poolSize(levelKey(level)) > 0) continue;
    const seeds = await seedPuzzles(level);
    requestPuzzle({ kind: 'level', level, seeds }).promise.then((entry) => entry && filePoolEntries([entry]));
  }
}

export function useNewGame() {
  const startGame = useGame((s) => s.startGame);
  const [genState, setGenState] = useState<GenState | null>(null);
  const cancelled = useRef(false);

  const start = async (req: { kind: 'level'; level: Level } | { kind: 'tech'; tech: Tech }) => {
    const key = req.kind === 'level' ? levelKey(req.level) : techKey(req.tech);
    // named in the player's language where it is shown (GeneratingDialog)
    const label: GenRequest = req;
    // a pooled puzzle filed before the practice ceiling existed may be above it
    const pooled = takePoolEntry(key, (e) => req.kind !== 'tech' || practisable(e, req.tech));
    if (pooled) {
      startGame(pooled.puzzle, pooled.score, pooled.level, req.kind === 'tech' ? req.tech : null);
      topUp(req);
      return true;
    }
    // the player is waiting. The hardest bands and the rarest techniques
    // come from puzzles saved at build time, each served through a random
    // isomorphism, so they start at once and never repeat; the rest is
    // generated, with the rating capped at what was asked for
    const seeds = req.kind === 'level' ? await seedPuzzles(req.level) : await practiceSeeds(req.tech);
    const { promise, handle } = requestPuzzle(
      { ...req, seeds },
      { urgent: true, onProgress: (attempts) => setGenState((g) => (g ? { ...g, attempts } : g)) }
    );
    // the dialog only once the wait is noticeable: a seed answers in milliseconds
    const show = setTimeout(() => setGenState({ label, attempts: 0, handle }), 250);
    const entry = await promise;
    clearTimeout(show);
    setGenState(null);
    if (entry) {
      startGame(entry.puzzle, entry.score, entry.level, req.kind === 'tech' ? req.tech : null);
      topUp(req);
      return true;
    }
    // nothing found (the attempts ran out, or the worker died): say so,
    // unless the player cancelled
    if (!cancelled.current) {
      const t = translator();
      useGame.setState({
        notice:
          req.kind === 'level'
            ? t('No {level} puzzle could be found this time. Please try again', { level: t.level(req.level) })
            : t('No {name} practice could be found this time. Please try again', { name: t.tech(req.tech) })
      });
    }
    cancelled.current = false;
    return false;
  };

  const cancel = () => {
    cancelled.current = true;
    genState?.handle.cancel();
  };
  return { start, genState, cancel };
}

// The Learn section's words for a band, a technique and its kin, in the
// chosen language (useLearnLocale.ts) or, until that arrives, in English
// from the content modules: the guide itself stays in its own chunk.

/** what a level asks of you, in plain words, then the techniques behind it */
const levelDescription = (loc: LearnLocale | undefined, level: Level) =>
  `${(loc?.bandLeads ?? BAND_LEADS)[level]}: ${(loc?.bandNotes ?? BAND_NOTES)[level]}`;
/** what a technique is, in one line */
const techWhat = (loc: LearnLocale | undefined, tech: Tech) => loc?.techDocs[tech]?.what ?? TECH_DOCS[tech].what;
/** another name for it, or the same logic in another family */
const kinLine = (loc: LearnLocale | undefined, tech: Tech) => (loc?.kin[tech] ?? KIN[tech] ?? []).join(' · ');

// engine/ratings.ts imports no translation, so the reasons of its
// NOT_PRACTISABLE are marked here, word for word; a reason changed there
// shows in English until it is marked again
const NOT_PRACTISABLE_REASONS = new Set([
  msg('never needed in practice: X-Chains, which run first, find the same loops'),
  msg('never needed in practice: basic and finned fish, which run first, find what it finds'),
  msg('only ever needed in specially constructed puzzles; none can be generated')
]);
const notPractisableReason = (t: Translator, reason: string) => (NOT_PRACTISABLE_REASONS.has(reason) ? t(reason) : reason);

// and the ways of solving of solveTimes.ts's MODE_LABEL, in the Learn
// section's words, so the verdict after a solve is one language at once
const MODE_LABELS = new Set([msg('with automatic candidates'), msg('with your own marks'), msg('on paper')]);
const modeLabel = (t: Translator, mode: SolveMode) => (MODE_LABELS.has(MODE_LABEL[mode]) ? t(MODE_LABEL[mode]) : MODE_LABEL[mode]);

export function NewGameDialog({
  onClose,
  onStart,
  onCustom,
  onDaily
}: {
  onClose: () => void;
  onStart: (level: Level) => void;
  onCustom: () => void;
  onDaily: () => void;
}) {
  const t = useT();
  const loc = useLearnLocale();
  return (
    <Modal title={t('New game')} onClose={onClose}>
      <div className="level-list">
        <button className="level-btn daily" onClick={onDaily}>
          <strong>{t('Daily puzzle')}</strong>
          <span>
            {t('One shared puzzle per day. Everyone in the world gets this exact board today, so compare times with your friends')}
          </span>
        </button>
        <button
          className="level-btn surprise"
          onClick={() => onStart(LEVELS[Math.floor(Math.random() * LEVELS.length)])}
        >
          <strong>{t('Surprise me')}</strong>
          <span>
            {t('Any difficulty. Enable "{setting}" in {settings} for the full mystery', {
              setting: t('Hide difficulty while playing'),
              settings: t('Settings')
            })}
          </span>
        </button>
        {LEVELS.map((level) => (
          <button
            key={level}
            className={`level-btn level-${level.toLowerCase()}`}
            onClick={() => onStart(level)}
          >
            <strong>{t.level(level)}</strong>
            <span>{levelDescription(loc, level)}</span>
          </button>
        ))}
        <button className="level-btn" onClick={onCustom}>
          <strong>{t('Custom')}</strong>
          <span>
            {t('Type in a puzzle from a newspaper or book. sudokUI checks it has exactly one solution and rates it before you play')}
          </span>
        </button>
      </div>
      <h4 className="setting-group">{t('Or scan a photo of one')}</h4>
      <ScanControls onDone={onClose} />
    </Modal>
  );
}

export function PracticeDialog({
  onClose,
  onStart,
  onLearn,
  onPath
}: {
  onClose: () => void;
  onStart: (tech: Tech) => void;
  /** open the technique guide (every technique explained) */
  onLearn: () => void;
  /** open your path, the third part of Learn */
  onPath: () => void;
}) {
  const t = useT();
  const loc = useLearnLocale();
  const byCategory = techniquesByFamily();
  const shown = byCategory.flatMap(([, techs]) => techs);
  const playable = shown.filter((x) => PRACTICE_TECHS.includes(x));
  return (
    <Modal title={t('Learn')} onClose={onClose} wide>
      <HubTabs active="practice" onTheory={onLearn} onPath={onPath} />
      <p className="dialog-note">
        {t('Pick a technique. sudokUI builds a puzzle that needs it, with nothing harder before it, and takes you to the move where it applies.')}
      </p>
      <p className="dialog-note">
        {t("The number on each button is the technique's cost. A puzzle's difficulty rating is the sum of the costs of every step needed to solve it.")}
      </p>
      <p className="tech-count">
        {rich(t('{n} of {total} techniques playable', { total: shown.length }), { n: <strong>{playable.length}</strong> })}
      </p>
      <ul className="tech-legend">
        <li>
          <span className="pool-dot" /> {t('a puzzle is ready and starts instantly')}
        </li>
        <li>
          <span className="tech-gear">⚙</span> {t('solver only: there is no pattern to spot, so nothing to practise')}
        </li>
        <li>
          <span className="tech-tilde">≈</span> {t('never needed: an easier technique always gets there first')}
        </li>
        <li>
          <span className="tech-x">✗</span> {t('not implemented: the chain techniques already cover it')}
        </li>
      </ul>
      <div className="practice-list">
        {byCategory.map(([cat, techs]) => (
          <div key={cat} className="practice-group">
            <h4>{t.family(cat)}</h4>
            <div className="practice-btns">
              {techs.map((tech) => {
                const info = TECHS[tech];
                const name = t.tech(tech);
                const ok = PRACTICE_TECHS.includes(tech);
                // three honest reasons a technique can't be practised:
                // ⚙ last resorts — the solver uses them, but there is no
                //   pattern to SPOT (they try candidates and propagate), and
                //   Exocet-grade patterns are too rare to generate on demand;
                // ≈ provably redundant — never appears in any solve path;
                // ✗ deliberately not implemented.
                const lastResort =
                  !ok && info.category === 'Last Resort' && info.implemented && info.enabled;
                const redundant = !ok && !lastResort && info.implemented;
                return (
                  <button
                    key={tech}
                    disabled={!ok}
                    className={
                      ok ? '' : lastResort ? 'tech-lastresort' : redundant ? 'tech-redundant' : 'tech-missing'
                    }
                    onClick={() => ok && onStart(tech)}
                    title={
                      ok
                        ? t('{what} ({level}, score {score})', {
                            what: techWhat(loc, tech),
                            level: t.level(info.level),
                            score: info.score
                          })
                        : lastResort
                          ? t(
                              '{name} is implemented and the solver uses it on the hardest puzzles. But there is nothing to spot: it assumes candidates and propagates, so practising it would just be trial and error',
                              { name }
                            )
                          : redundant
                            ? NOT_PRACTISABLE[tech]
                              ? t('{name} is implemented and the solver uses it, but it cannot be practised: {reason}', {
                                  name,
                                  reason: notPractisableReason(t, NOT_PRACTISABLE[tech]!)
                                })
                              : t(
                                  '{name} is implemented, but provably redundant: its conclusions are always found by earlier techniques, so it never appears in a solve path',
                                  { name }
                                )
                            : t(
                                '{name} is deliberately not implemented. Everything it can find, the AIC/ALS chain engines already find. It stays in the catalogue (score {score}, {level}) so the map of sudoku techniques is complete.',
                                { name, score: info.score, level: t.level(info.level) }
                              )
                    }
                  >
                    {ok ? (
                      ''
                    ) : lastResort ? (
                      <span className="tech-gear">⚙ </span>
                    ) : redundant ? (
                      <span className="tech-tilde">≈ </span>
                    ) : (
                      <span className="tech-x">✗ </span>
                    )}
                    {name}
                    <span className="tech-score">{info.score}</span>
                    {ok && poolSize(techKey(tech)) > 0 && (
                      <span className="pool-dot" title={t('cached puzzle ready')} />
                    )}
                    {kinLine(loc, tech) && <span className="tech-kin">{kinLine(loc, tech)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Enter or Space on a focused row does what a click does */
const onActivate = (action: () => void) => (e: React.KeyboardEvent) => {
  if (e.target !== e.currentTarget) return; // a nested button handles its own keys
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
};

/** a run of consecutive Easy-level steps, collapsed to one row */
type PathRow = { kind: 'single'; index: number; step: Step } | { kind: 'group'; index: number; steps: Step[] };

/**
 * The solution path: every solver step from the puzzle's start, with runs of
 * singles collapsed and the hardest technique's first step marked as the crux. Clicking
 * a row sets the board to the position just before that step (and flags the
 * game as assisted — opening this dialog already does).
 */
export function SolutionPathDialog({ onClose }: { onClose: () => void }) {
  const info = useGame((s) => s.info);
  const jumpToStep = useGame((s) => s.jumpToStep);
  const markAssisted = useGame((s) => s.markAssisted);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const t = useT();

  useEffect(() => {
    if (!info) return;
    markAssisted(); // seeing the path (even its shape) is assistance
    // defer the (possibly slow) rating so the dialog paints first
    const timer = setTimeout(() => setSteps(solvePath(info.puzzle)), 30);
    return () => clearTimeout(timer);
  }, [info?.puzzle]);

  if (!info) return null;

  const rows: PathRow[] = [];
  if (steps) {
    const isSingle = (s: Step) => TECHS[s.tech].category === 'Singles';
    for (let i = 0; i < steps.length; i++) {
      if (isSingle(steps[i])) {
        const run: Step[] = [];
        const start = i;
        while (i < steps.length && isSingle(steps[i])) run.push(steps[i++]);
        i--;
        if (run.length >= 3 && !expanded.has(start)) {
          rows.push({ kind: 'group', index: start, steps: run });
          continue;
        }
        run.forEach((s, k) => rows.push({ kind: 'single', index: start + k, step: s }));
      } else {
        rows.push({ kind: 'single', index: i, step: steps[i] });
      }
    }
  }
  // the crux badge means something only when the path needed more than singles
  const cruxAt = steps ? cruxIndex(steps) : -1;
  const crux = cruxAt >= 0 && TECHS[steps![cruxAt].tech].category !== 'Singles' ? cruxAt : -1;

  const jump = (k: number) => {
    jumpToStep(k);
    onClose();
  };

  return (
    <Modal title={t('Solution path')} onClose={onClose}>
      <p className="dialog-note">
        {t('Every step of one complete solution, easiest technique first. Click a step to set the board to the position just before it. The crux, the single most expensive step, is highlighted. Viewing this counts as assistance.')}
      </p>
      {!steps ? (
        <div className="spinner" />
      ) : (
        <div className="path-list">
          {rows.map((row) =>
            row.kind === 'group' ? (
              // the whole group row expands; the step-range button jumps
              <div
                key={row.index}
                className="path-row path-group"
                role="button"
                tabIndex={0}
                title={t('Expand these steps')}
                onClick={() => setExpanded(new Set([...expanded, row.index]))}
                onKeyDown={onActivate(() => setExpanded(new Set([...expanded, row.index])))}
              >
                <button
                  className="path-jump"
                  onClick={(e) => {
                    e.stopPropagation();
                    jump(row.index);
                  }}
                >
                  {row.index + 1}–{row.index + row.steps.length}
                </button>
                <span className="path-label">{t('{n} singles ▸', { n: row.steps.length })}</span>
                <span className="path-score">
                  +{row.steps.reduce((a, s) => a + TECHS[s.tech].score, 0)}
                </span>
              </div>
            ) : (
              // the whole step row jumps to the position before the step
              <div
                key={row.index}
                className={`path-row ${row.index === crux ? 'path-crux' : ''}`}
                role="button"
                tabIndex={0}
                title={row.step.description}
                onClick={() => jump(row.index)}
                onKeyDown={onActivate(() => jump(row.index))}
              >
                <span className="path-jump">{row.index + 1}</span>
                <span className="path-label">
                  {t.tech(row.step.tech)}
                  {row.index === crux && <span className="crux-badge">{t('crux')}</span>}
                </span>
                <span className="path-score">+{TECHS[row.step.tech].score}</span>
              </div>
            )
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * Scan: every technique that fires in the CURRENT position, easiest first —
 * not just the one the solve path would take. For players who are
 * better at spotting, say, uniqueness patterns than wings: pick the step you
 * want and it is shown as a full hint on the board.
 */
/**
 * The two possible meanings of manual pencil marks — the one question the
 * engine cannot answer itself. Shared by the Hint flow (as a dialog) and
 * Scan (inline); the answer holds for the rest of the game.
 */
export function ContractChoices({ onAnswer }: { onAnswer: (c: 'exhaustive' | 'open') => void }) {
  const t = useT();
  return (
    <div className="level-list">
      <button className="level-btn" onClick={() => onAnswer('exhaustive')}>
        <strong>{t('They are my remaining candidates')}</strong>
        <span>
          {t('You filled candidates and have been eliminating: a missing digit in a marked cell means you ruled it out. Hints continue from exactly where you are. (Corner or centre makes no difference.)')}
        </span>
      </button>
      <button className="level-btn" onClick={() => onAnswer('open')}>
        <strong>{t('They are partial notes')}</strong>
        <span>
          {t('Snyder-style or still filling: a missing digit means nothing yet. Hints reason from every remaining possibility instead.')}
        </span>
      </button>
    </div>
  );
}

/** Asked at most once per game, the first time Hint meets manual marks. */
export function ContractDialog({
  onAnswer,
  onClose
}: {
  onAnswer: (c: 'exhaustive' | 'open') => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Modal title={t('How should hints read your pencil marks?')} onClose={onClose}>
      <p className="dialog-note">
        {t('A missing pencil mark can mean "eliminated" or just "not written yet", and only you know which. Your answer is remembered for the rest of this puzzle (Auto, or Fill on the whole board, answers it automatically).')}
      </p>
      <ContractChoices onAnswer={onAnswer} />
    </Modal>
  );
}

export function ScanDialog({ onClose, lookFor }: { onClose: () => void; lookFor?: Tech }) {
  const cells = useGame((s) => s.cells);
  const auto = useGame((s) => s.autoCandidates);
  const solution = useGame((s) => s.info?.solution);
  const contract = useGame((s) => s.markContract);
  const setMarkContract = useGame((s) => s.setMarkContract);
  const markAssisted = useGame((s) => s.markAssisted);
  const showStep = useGame((s) => s.showStep);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [slip, setSlip] = useState(false);
  const t = useT();
  // "is there a Jellyfish here?": one technique by name, with a plain no
  const [query, setQuery] = useState(lookFor ? t.tech(lookFor) : '');
  const q = query.trim().toLowerCase();
  // a technique answers to its name in the player's language and in English
  const names = (tech: Tech) => [TECHS[tech].name.toLowerCase(), t.tech(tech).toLowerCase()];
  const matching = SOLVE_ORDER.filter((tech) => names(tech).some((n) => n.includes(q)));
  // the technique named exactly, when it does not fire: said in so many
  // words even if its finned and franken cousins do
  const exact = SOLVE_ORDER.find((tech) => names(tech).includes(q));
  const missing =
    exact && steps && !steps.some((st) => st.tech === exact)
      ? t('No {name} fires in this position with your candidates.', { name: t.tech(exact) })
      : null;
  const shown = steps?.filter((st) => !q || names(st.tech).some((n) => n.includes(q))) ?? null;

  // manual marks with no declared meaning: ask before scanning
  const needsContract = !auto && contract === 'unknown' && hasManualMarks(cells);

  useEffect(() => {
    if (needsContract) return; // the choices below re-trigger this effect
    markAssisted();
    // defer the finder sweep so the dialog paints first
    const timer = setTimeout(() => {
      // under the exhaustive contract a mark that lost its true digit means
      // the scan would reason from a corrupted position — say so instead
      if (solution && !auto && contract === 'exhaustive' && markSlip(cells, solution) >= 0) {
        setSlip(true);
        setSteps([]);
        return;
      }
      // scan from the declared candidates; a step the marks faked (one that
      // would contradict the solution) is silently dropped, never listed
      const all = findAllSteps(contractGrid(cells, auto, contract)).filter(
        (st) => !solution || stepMatchesSolution(st, solution)
      );
      setSteps(all);
    }, 30);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsContract, contract]);

  return (
    <Modal title={t("What's in this position?")} onClose={onClose}>
      {needsContract ? (
        <>
          <p className="dialog-note">
            {t('A missing pencil mark can mean "eliminated" or just "not written yet", and only you know which. Your answer is remembered for the rest of this puzzle.')}
          </p>
          <ContractChoices onAnswer={setMarkContract} />
        </>
      ) : (
        <>
          <p className="dialog-note">
            {t('Every technique the solver can apply right now, with your exact candidates, easiest first. Click one to see it highlighted on the board. Counts as assistance.')}
          </p>
          <input
            className="learn-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Looking for one technique? Jellyfish, X-Wing…')}
            aria-label={t('Technique to look for')}
          />
          {!steps || !shown ? (
            <div className="spinner" />
          ) : slip ? (
            <p className="dialog-note">
              {t('A pencil mark somewhere dropped a digit that belongs in the solution. Run Check to find it before scanning.')}
            </p>
          ) : steps.length === 0 ? (
            <p className="dialog-note">
              {t("Nothing fires here. You may need a technique beyond the catalogue's reach from this position, or a candidate is off (run Check).")}
            </p>
          ) : (
            <>
              {missing && (
                <p className="dialog-note">
                  {missing}{' '}
                  {shown.length > 0
                    ? t('Related techniques that do:')
                    : t('The pattern may still be there without removing anything, which is why the solver passes it by.')}
                </p>
              )}
              {shown.length === 0 && !missing && (
                <p className="dialog-note">
                  {matching.length === 0
                    ? t('No technique called “{q}” is in the catalogue.', { q: query.trim() })
                    : t(
                        matching.length === 1
                          ? 'None of the {n} techniques matching “{q}” fires here.||one technique matches'
                          : 'None of the {n} techniques matching “{q}” fires here.',
                        { n: matching.length, q: query.trim() }
                      )}
                </p>
              )}
              {shown.length > 0 && (
            <div className="path-list">
              {shown.map((step, i) => (
                <div
                  key={i}
                  className="path-row"
                  role="button"
                  tabIndex={0}
                  title={step.description}
                  onClick={() => {
                    showStep(step);
                    onClose();
                  }}
                  onKeyDown={onActivate(() => {
                    showStep(step);
                    onClose();
                  })}
                >
                  <span className="path-jump">+{TECHS[step.tech].score}</span>
                  <span className="path-label">{t.tech(step.tech)}</span>
                  <span className="path-score">
                    {step.placements.length > 0 &&
                      t(step.placements.length === 1 ? '{n} placed||one digit' : '{n} placed', { n: step.placements.length })}
                    {step.placements.length > 0 && step.eliminations.length > 0 && ' · '}
                    {step.eliminations.length > 0 &&
                      t(step.eliminations.length === 1 ? '{n} removed||one candidate' : '{n} removed', {
                        n: step.eliminations.length
                      })}
                  </span>
                </div>
              ))}
            </div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/**
 * Scan a photo of a printed puzzle (src/scan): a file (the phone offers
 * the camera or the library) or a live camera frame. The digits land on
 * the custom-entry board for checking; `onDone` closes the dialog.
 */
export function ScanControls({ onDone }: { onDone: () => void }) {
  const loadScan = useGame((s) => s.loadScan);
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState('');
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const t = useT();
  const canCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const closeCamera = () => {
    camera?.getTracks().forEach((track) => track.stop());
    setCamera(null);
  };
  useEffect(() => () => camera?.getTracks().forEach((track) => track.stop()), [camera]);
  useEffect(() => {
    if (camera && video.current) video.current.srcObject = camera;
  }, [camera]);
  const scan = async (blob: Blob) => {
    setBusy(true);
    setScanError('');
    try {
      const { scanImage } = await import('../scan/scanner');
      const r = await scanImage(blob);
      const found = r.digits.filter(Boolean).length;
      if (found < 17) {
        const read = r.foundGrid
          ? t(found === 1 ? 'Only {n} digit could be read.' : 'Only {n} digits could be read.', { n: found })
          : t(
              found === 1
                ? 'Only {n} digit could be read, and no grid was found.'
                : 'Only {n} digits could be read, and no grid was found.',
              { n: found }
            );
        setScanError(`${read} ${t('Printed puzzles only; fill the frame with the grid, in good light, and try again.')}`);
        return;
      }
      closeCamera();
      loadScan(r.digits, r.doubts, r.preview);
      onDone();
    } catch (e) {
      setScanError(e instanceof Error ? e.message : t('The photo could not be read.'));
    } finally {
      setBusy(false);
    }
  };
  const openCamera = async () => {
    setScanError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } }
      });
      setCamera(stream);
    } catch {
      setScanError(t('The camera could not be opened. Take a photo with the camera app and choose the file instead.'));
    }
  };
  const snap = async () => {
    if (!video.current) return;
    const { captureFrame } = await import('../scan/scanner');
    await scan(await captureFrame(video.current));
  };
  return (
    <>
      <p className="dialog-note">
        {t("Printed puzzles: a newspaper, a book, a screen. Fill the frame with the grid; a tilt, a turn or a mirror image is read anyway. The digits land on the board with the scanner's doubts in red, for you to check before playing.")}
      </p>
      {camera ? (
        <div className="scan-camera">
          <video ref={video} autoPlay playsInline muted />
          <div className="hint-actions">
            <button onClick={snap} disabled={busy}>
              {busy ? t('Reading…') : t('Snap')}
            </button>
            <button className="ghost" onClick={closeCamera}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="hint-actions">
          <label className="file-btn">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) scan(f);
              }}
            />
            📷 {busy ? t('Reading…') : t('Photo or file')}
          </label>
          {canCamera && (
            <button className="ghost" onClick={openCamera} disabled={busy}>
              🎥 {t('Use the camera')}
            </button>
          )}
        </div>
      )}
      {scanError && <p className="dialog-error">{scanError}</p>}
    </>
  );
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const startGame = useGame((s) => s.startGame);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const t = useT();

  const doImport = () => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (cleaned.length !== 81) {
      setError(t('A puzzle needs exactly 81 characters (digits and dots).'));
      return;
    }
    const v = validatePuzzle(cleaned);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    startGame(cleaned, v.score, v.level);
    onClose();
  };

  return (
    <Modal title={t('Import a puzzle')} onClose={onClose}>
      <p className="dialog-note">{t('Paste an 81-character puzzle string (dots or zeros for empty cells).')}</p>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
        placeholder="..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3.."
      />
      {error && <p className="dialog-error">{error}</p>}
      <div className="hint-actions">
        <button onClick={doImport}>{t('Load puzzle')}</button>
      </div>
      <h4 className="setting-group">{t('Scan a photo')}</h4>
      <ScanControls onDone={onClose} />
    </Modal>
  );
}

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const cells = useGame((s) => s.cells);
  const autoCandidates = useGame((s) => s.autoCandidates);
  const [copied, setCopied] = useState('');
  const t = useT();

  const currentAsString = () =>
    cells.map((c) => (c.given ? String(c.value) : '.')).join('');

  const base = () => `${window.location.origin}${window.location.pathname}`;
  // the puzzle string doubles as the seed: anyone opening this link plays
  // the exact same game
  const shareLink = () => `${base()}#p=${currentAsString()}`;
  // the position link additionally carries every entry, pencil mark,
  // exclusion and colour — the recipient continues exactly where you are
  const positionLink = () => `${base()}#s=${encodePosition(cells, autoCandidates)}`;

  const copy = (what: 'link' | 'position' | 'string') => {
    navigator.clipboard?.writeText(
      what === 'link' ? shareLink() : what === 'position' ? positionLink() : currentAsString()
    );
    setCopied(what);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <Modal title={t('Share this puzzle')} onClose={onClose}>
      <p className="dialog-note">
        {rich(
          t(
            '{puzzle} shares a fresh copy from the start. {position} shares it exactly as it stands, with your entries, pencil marks and colours, for a second opinion or a race from the same spot.'
          ),
          {
            puzzle: <strong>{t('Puzzle||the Puzzle link button')}</strong>,
            position: <strong>{t('Position||the Position link button')}</strong>
          }
        )}
      </p>
      <div className="hint-actions">
        <button onClick={() => copy('link')}>
          {copied === 'link' ? `✓ ${t('Copied')}` : `🔗 ${t('Puzzle link')}`}
        </button>
        <button onClick={() => copy('position')}>
          {copied === 'position' ? `✓ ${t('Copied')}` : `📍 ${t('Position link')}`}
        </button>
        <button className="ghost" onClick={() => copy('string')}>
          {copied === 'string' ? `✓ ${t('Copied')}` : t('Puzzle string')}
        </button>
      </div>
    </Modal>
  );
}

export function GeneratingDialog({ label, attempts, onCancel }: { label: GenRequest; attempts: number; onCancel: () => void }) {
  const t = useT();
  const heading =
    label.kind === 'level'
      ? t('Generating {level} puzzle', { level: t.level(label.level) })
      : t('Generating {name} practice', { name: t.tech(label.tech) });
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label={heading}>
        <h3>{heading}…</h3>
        <div className="spinner" />
        <p className="dialog-note">
          {attempts > 0
            ? t(attempts === 1 ? '{n} puzzles examined||one puzzle' : '{n} puzzles examined', { n: t.num(attempts) })
            : t('Searching for a matching puzzle')}
        </p>
        <div className="hint-actions">
          <button className="ghost" onClick={onCancel}>{t('Cancel')}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * The ordinal of a count of solves in a language: 3rd; Norwegian 3.;
 * Spanish 3.ª, the sentence counting partidas (feminine, so one form for
 * every number)
 */
const ordinal = (n: number, lang: Lang) => {
  if (lang === 'nb') return `${n}.`;
  if (lang === 'es') return `${n}.ª`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};
const clock = (ms: number) => {
  const secs = Math.floor(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

export function VictoryDialog({
  onNewGame,
  onClose,
  onAnother,
  onProgress
}: {
  onNewGame: () => void;
  onClose: () => void;
  /** start a fresh practice puzzle for the same technique */
  onAnother?: () => void;
  /** open the path and the record */
  onProgress?: () => void;
}) {
  const info = useGame((s) => s.info);
  const assisted = useGame((s) => s.assisted);
  const elapsedMs = useGame((s) => s.elapsedMs);
  const autoCandidates = useGame((s) => s.autoCandidates);
  const practiceFound = useGame((s) => s.practiceFound);
  const game = useStats((s) => s.game);
  const bands = useStats((s) => s.bands);
  const dailyDays = useStats((s) => s.dailyDays);
  const [copied, setCopied] = useState(false);
  const t = useT();
  if (!info) return null;
  const secs = Math.floor(elapsedMs() / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  // a practice game starts part-way through, so its time compares with nothing
  const mode = autoCandidates ? 'auto' : 'marks';
  const verdict = info.practiceTech ? null : timeVerdict(info.level, secs, mode);
  // what the player did, technique by technique (docs/technique-stats.md)
  const summary = gameSummary(game);
  const band = info.practiceTech ? null : bands[info.level];
  const newBest = !!band && band.solves > 1 && band.bestMs === elapsedMs();
  const streak = info.dailyKey ? dailyStreak(dailyDays) : 0;
  const practiceName = info.practiceTech ? t.tech(info.practiceTech) : '';
  const practiceLine = info.practiceTech
    ? practiceFound
      ? `🎯 ${t('You found the {name} yourself', { name: practiceName })}`
      : game.hinted[info.practiceTech]
        ? t('The {name} came from a hint. Next time, look for it first', { name: practiceName })
        : t('You solved it without playing the {name}. Next time, look for it first', { name: practiceName })
    : null;

  // same-puzzle challenge: the share text carries the seed link, so the
  // recipient plays exactly this grid
  const shareResult = () => {
    const vars = {
      level: t.level(info.level),
      score: info.score,
      time: `${mm}:${ss}`,
      standing: verdict ? percentileText(verdict.percentile) : '',
      link: `https://sudokui.app${langRoot(t.lang)}#p=${info.puzzle}`
    };
    const text = verdict
      ? assisted
        ? t('I solved a {level} sudoku (rating {score}) in {time}, {standing} on sudokUI. Can you beat that? {link}', vars)
        : t(
            'I solved a {level} sudoku (rating {score}) in {time}, {standing}, no assists, every mark my own on sudokUI. Can you beat that? {link}',
            vars
          )
      : assisted
        ? t('I solved a {level} sudoku (rating {score}) in {time} on sudokUI. Can you beat that? {link}', vars)
        : t('I solved a {level} sudoku (rating {score}) in {time}, no assists, every mark my own on sudokUI. Can you beat that? {link}', vars);
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} style={{ '--n': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="modal victory" role="dialog" aria-modal="true" aria-label={t('Puzzle solved')}>
        <h3>{t('Solved!')} 🎉</h3>
        <p>{t('{level} · score {score} · {time}', { level: t.level(info.level), score: info.score, time: `${mm}:${ss}` })}</p>
        {verdict && (
          <p
            className="solve-verdict"
            title={t('Against typical times of online solvers of this band. See {learn}, {rating}', {
              learn: t('Learn'),
              rating: t('Rating')
            })}
          >
            {rich(
              t('{verdict}: {standing} of {level} puzzles {mode}', {
                standing: percentileText(verdict.percentile),
                level: t.level(info.level),
                mode: modeLabel(t, mode)
              }),
              { verdict: <strong>{verdict.label}</strong> }
            )}
          </p>
        )}
        <p className={assisted ? 'solve-assisted' : 'solve-clean'}>
          {assisted
            ? info.practiceTech && useSettings.getState().practiceFastForward
              ? t("Solved with assistance: a practice puzzle that jumps to its technique counts as help. For an unassisted run, switch off '{setting}' in Settings", {
                  setting: t('Jump to the technique')
                })
              : t('Solved with assistance. Restart the puzzle for an unassisted run')
            : `✨ ${t('Unassisted solve: no help, every mark your own')}`}
        </p>
        {practiceLine && <p className={practiceFound ? 'solve-clean' : 'solve-assisted'}>{practiceLine}</p>}
        {summary && (
          <p className="solve-summary" title={t('Every move of your own is credited with the easiest technique that justifies it')}>
            {summary}
          </p>
        )}
        {band && band.solves > 1 && (
          <p className="solve-record">
            {newBest
              ? t('Your {nth} {level} solve, a new best', { nth: ordinal(band.solves, t.lang), level: t.level(info.level) })
              : t('Your {nth} {level} solve; best {time}', {
                  nth: ordinal(band.solves, t.lang),
                  level: t.level(info.level),
                  time: clock(band.bestMs)
                })}
          </p>
        )}
        {streak > 1 && <p className="solve-record">🔥 {t('Daily streak: {n} days', { n: streak })}</p>}
        <div className="hint-actions">
          {info.practiceTech && onAnother && (
            <button onClick={onAnother}>{t('Another {name}', { name: practiceName })}</button>
          )}
          <button onClick={onNewGame}>{t('New game')}</button>
          <button onClick={shareResult}>{copied ? `✓ ${t('Copied')}` : `🔗 ${t('Challenge a friend')}`}</button>
          {onProgress && (
            <button className="ghost" onClick={onProgress}>
              📈 {t('Your path')}
            </button>
          )}
          <button className="ghost" onClick={onClose}>{t('Admire the grid')}</button>
        </div>
      </div>
    </div>
  );
}

/** what Tab can land on inside a dialog */
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  children,
  onClose,
  wide = false
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** reading-width dialog for long-form content (the Learn dialog) */
  wide?: boolean;
}) {
  const t = useT();
  // Escape closes the dialog (capture phase so the app's own Escape
  // handling — clearing the selection — doesn't also fire)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // without this, Tab keeps walking the controls hidden behind the dialog
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, []);
  // and Tab stays inside: past the last control it wraps to the first
  const onTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        className={wide ? 'modal wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onTab}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose} aria-label={t('Close dialog')}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
