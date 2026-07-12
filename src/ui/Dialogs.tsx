// Game dialogs: new game, practice (full technique catalogue), import/export,
// generation progress and victory — plus useNewGame, the hook that ties the
// puzzle pools, the generation worker and the game store together.
import React, { useState, useEffect } from 'react';
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
import { Level, LEVELS, Tech, TECHS, PRACTICE_TECHS, ALL_TECHS, Category } from '../engine/ratings';
import { requestPuzzle, takePoolEntry, levelKey, techKey, poolSize, filePoolEntry, GenerationHandle } from '../state/pools';

interface GenState {
  label: string;
  attempts: number;
  handle: GenerationHandle;
}

export function useNewGame() {
  const startGame = useGame((s) => s.startGame);
  const [genState, setGenState] = useState<GenState | null>(null);

  const start = async (req: { kind: 'level'; level: Level } | { kind: 'tech'; tech: Tech }) => {
    const key = req.kind === 'level' ? levelKey(req.level) : techKey(req.tech);
    const label =
      req.kind === 'level' ? `${req.level} puzzle` : TECHS[req.tech].name + ' practice';
    const pooled = takePoolEntry(key);
    if (pooled) {
      startGame(pooled.puzzle, pooled.score, pooled.level, req.kind === 'tech' ? req.tech : null);
      // top up the pool in the background
      if (poolSize(key) < 2) {
        const { promise } = requestPuzzle(req);
        promise.then((entry) => entry && filePoolEntry(entry));
      }
      return true;
    }
    const { promise, handle } = requestPuzzle(req, (attempts) =>
      setGenState((g) => (g ? { ...g, attempts } : g))
    );
    setGenState({ label, attempts: 0, handle });
    const entry = await promise;
    setGenState(null);
    if (entry) {
      startGame(entry.puzzle, entry.score, entry.level, req.kind === 'tech' ? req.tech : null);
      return true;
    }
    return false;
  };

  return { start, genState, cancel: () => genState?.handle.cancel() };
}

const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  Beginner: 'Full houses and easy singles — learn the ropes',
  Easy: 'Singles only — a relaxed solve',
  Medium: 'Locked candidates and subsets',
  Tricky: 'A first fish, wing or kite — one new trick',
  Hard: 'Fish, wings and single-digit patterns in force',
  Unfair: 'Chains, ALS and finned fish',
  Extreme: 'Long chains, colouring and nets',
  Nightmare: 'Forcing nets and Exocet territory — ratings past 3000'
};

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
  return (
    <Modal title="New game" onClose={onClose}>
      <div className="level-list">
        <button className="level-btn daily" onClick={onDaily}>
          <strong>Daily puzzle</strong>
          <span>
            One shared puzzle per day — everyone in the world gets this exact
            board today. Compare times with your friends
          </span>
        </button>
        <button
          className="level-btn surprise"
          onClick={() => onStart(LEVELS[Math.floor(Math.random() * LEVELS.length)])}
        >
          <strong>Surprise me</strong>
          <span>
            Any difficulty — enable "Hide difficulty while playing" in Settings
            for the full mystery
          </span>
        </button>
        {LEVELS.map((level) => (
          <button
            key={level}
            className={`level-btn level-${level.toLowerCase()}`}
            onClick={() => onStart(level)}
          >
            <strong>{level}</strong>
            <span>{LEVEL_DESCRIPTIONS[level]}</span>
          </button>
        ))}
        <button className="level-btn" onClick={onCustom}>
          <strong>Custom</strong>
          <span>
            Type in a puzzle from a newspaper or book — sudokUI checks it has
            exactly one solution and rates it before you play
          </span>
        </button>
      </div>
    </Modal>
  );
}

export function PracticeDialog({ onClose, onStart }: { onClose: () => void; onStart: (tech: Tech) => void }) {
  const byCategory = new Map<Category, Tech[]>();
  for (const tech of ALL_TECHS) {
    const cat = TECHS[tech].category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(tech);
  }
  const shown = [...byCategory.values()].flat();
  const playable = shown.filter((t) => PRACTICE_TECHS.includes(t));
  return (
    <Modal title="Practice a technique" onClose={onClose}>
      <p className="dialog-note">
        sudokUI generates a puzzle whose solution path requires the chosen
        technique — with nothing harder needed before it — and skips you to
        the position where it applies. Techniques marked ✗, ≈ or ⚙ are shown
        for completeness but deliberately not playable: hover them to see
        why. The number on each technique is its rating cost: a puzzle's
        difficulty rating is the sum of these over its solve path.
      </p>
      <p className="tech-count">
        <strong>{playable.length}</strong> of {shown.length} techniques playable
      </p>
      <div className="practice-list">
        {[...byCategory.entries()].map(([cat, techs]) => (
          <div key={cat} className="practice-group">
            <h4>{cat}</h4>
            <div className="practice-btns">
              {techs.map((tech) => {
                const info = TECHS[tech];
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
                        ? `Score ${info.score} · ${info.level}`
                        : lastResort
                          ? `${info.name} is implemented and the solver uses it on the hardest puzzles — but there is nothing to spot: it assumes candidates and propagates, so practising it would just be trial and error`
                          : redundant
                            ? `${info.name} is implemented, but provably redundant — its conclusions are always found by earlier techniques, so it never appears in a solve path`
                            : `${info.name} is deliberately not implemented — everything it can find, the AIC/ALS chain engines already find. It stays in the catalogue (score ${info.score}, ${info.level}) so the map of sudoku techniques is complete.`
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
                    {info.name}
                    <span className="tech-score">{info.score}</span>
                    {ok && poolSize(techKey(tech)) > 0 && (
                      <span className="pool-dot" title="cached puzzle ready" />
                    )}
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

/** a run of consecutive Easy-level steps, collapsed to one row */
type PathRow = { kind: 'single'; index: number; step: Step } | { kind: 'group'; index: number; steps: Step[] };

/**
 * The solution path: every solver step from the puzzle's start, with runs of
 * singles collapsed and the most expensive step marked as the crux. Clicking
 * a row sets the board to the position just before that step (and flags the
 * game as assisted — opening this dialog already does).
 */
export function SolutionPathDialog({ onClose }: { onClose: () => void }) {
  const info = useGame((s) => s.info);
  const jumpToStep = useGame((s) => s.jumpToStep);
  const markAssisted = useGame((s) => s.markAssisted);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!info) return;
    markAssisted(); // seeing the path (even its shape) is assistance
    // defer the (possibly slow) rating so the dialog paints first
    const t = setTimeout(() => setSteps(solvePath(info.puzzle)), 30);
    return () => clearTimeout(t);
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
  const cruxIndex = steps?.length
    ? steps.reduce((best, s, i) => (TECHS[s.tech].score > TECHS[steps[best].tech].score ? i : best), 0)
    : -1;

  const jump = (k: number) => {
    jumpToStep(k);
    onClose();
  };

  return (
    <Modal title="Solution path" onClose={onClose}>
      <p className="dialog-note">
        Every step of one complete solution, cheapest technique first. Click a
        step to set the board to the position just before it — the crux is
        highlighted. Viewing this counts as assistance.
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
                title="Expand these steps"
                onClick={() => setExpanded(new Set([...expanded, row.index]))}
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
                <span className="path-label">{row.steps.length} singles ▸</span>
                <span className="path-score">
                  +{row.steps.reduce((a, s) => a + TECHS[s.tech].score, 0)}
                </span>
              </div>
            ) : (
              // the whole step row jumps to the position before the step
              <div
                key={row.index}
                className={`path-row ${row.index === cruxIndex ? 'path-crux' : ''}`}
                role="button"
                title={row.step.description}
                onClick={() => jump(row.index)}
              >
                <span className="path-jump">{row.index + 1}</span>
                <span className="path-label">
                  {TECHS[row.step.tech].name}
                  {row.index === cruxIndex && <span className="crux-badge">crux</span>}
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
 * Scan: every technique that fires in the CURRENT position, cheapest first —
 * not just the cheapest one the solve path would take. For players who are
 * better at spotting, say, uniqueness patterns than wings: pick the step you
 * want and it is shown as a full hint on the board.
 */
/**
 * The two possible meanings of manual pencil marks — the one question the
 * engine cannot answer itself. Shared by the Hint flow (as a dialog) and
 * Scan (inline); the answer holds for the rest of the game.
 */
export function ContractChoices({ onAnswer }: { onAnswer: (c: 'exhaustive' | 'open') => void }) {
  return (
    <div className="level-list">
      <button className="level-btn" onClick={() => onAnswer('exhaustive')}>
        <strong>They are my remaining candidates</strong>
        <span>
          You filled candidates and have been eliminating — a missing digit in
          a marked cell means you ruled it out. Hints continue from exactly
          where you are. (Corner or centre makes no difference.)
        </span>
      </button>
      <button className="level-btn" onClick={() => onAnswer('open')}>
        <strong>They are partial notes</strong>
        <span>
          Snyder-style or still filling — a missing digit means nothing yet.
          Hints reason from every remaining possibility instead.
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
  return (
    <Modal title="How should hints read your pencil marks?" onClose={onClose}>
      <p className="dialog-note">
        A missing pencil mark can mean "eliminated" or just "not written yet" —
        only you know which. Your answer is remembered for the rest of this
        puzzle (Auto and Fill answer it automatically).
      </p>
      <ContractChoices onAnswer={onAnswer} />
    </Modal>
  );
}

export function ScanDialog({ onClose }: { onClose: () => void }) {
  const cells = useGame((s) => s.cells);
  const auto = useGame((s) => s.autoCandidates);
  const solution = useGame((s) => s.info?.solution);
  const contract = useGame((s) => s.markContract);
  const setMarkContract = useGame((s) => s.setMarkContract);
  const markAssisted = useGame((s) => s.markAssisted);
  const showStep = useGame((s) => s.showStep);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [slip, setSlip] = useState(false);

  // manual marks with no declared meaning: ask before scanning
  const needsContract = !auto && contract === 'unknown' && hasManualMarks(cells);

  useEffect(() => {
    if (needsContract) return; // the choices below re-trigger this effect
    markAssisted();
    // defer the finder sweep so the dialog paints first
    const t = setTimeout(() => {
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
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsContract, contract]);

  return (
    <Modal title="What's in this position?" onClose={onClose}>
      {needsContract ? (
        <>
          <p className="dialog-note">
            A missing pencil mark can mean "eliminated" or just "not written
            yet" — only you know which. Your answer is remembered for the rest
            of this puzzle.
          </p>
          <ContractChoices onAnswer={setMarkContract} />
        </>
      ) : (
        <>
          <p className="dialog-note">
            Every technique the solver can apply right now, with your exact
            candidates — cheapest first. Click one to see it highlighted on
            the board. Counts as assistance.
          </p>
          {!steps ? (
            <div className="spinner" />
          ) : slip ? (
            <p className="dialog-note">
              A pencil mark somewhere dropped a digit that belongs in the
              solution — run Check to find it before scanning.
            </p>
          ) : steps.length === 0 ? (
            <p className="dialog-note">
              Nothing fires here — you may need a technique beyond the
              catalogue's reach from this position, or a candidate is off
              (run Check).
            </p>
          ) : (
            <div className="path-list">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="path-row"
                  role="button"
                  title={step.description}
                  onClick={() => {
                    showStep(step);
                    onClose();
                  }}
                >
                  <span className="path-jump">+{TECHS[step.tech].score}</span>
                  <span className="path-label">{TECHS[step.tech].name}</span>
                  <span className="path-score">
                    {step.placements.length > 0 && `${step.placements.length} placed`}
                    {step.placements.length > 0 && step.eliminations.length > 0 && ' · '}
                    {step.eliminations.length > 0 && `${step.eliminations.length} removed`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const startGame = useGame((s) => s.startGame);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const doImport = () => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (cleaned.length !== 81) {
      setError('A puzzle needs exactly 81 characters (digits and dots).');
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
    <Modal title="Import a puzzle" onClose={onClose}>
      <p className="dialog-note">Paste an 81-character puzzle string (dots or zeros for empty cells).</p>
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
        <button onClick={doImport}>Load puzzle</button>
      </div>
    </Modal>
  );
}

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const cells = useGame((s) => s.cells);
  const autoCandidates = useGame((s) => s.autoCandidates);
  const [copied, setCopied] = useState('');

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
    <Modal title="Share this puzzle" onClose={onClose}>
      <p className="dialog-note">
        <strong>Puzzle</strong> shares a fresh copy from the start.{' '}
        <strong>Position</strong> shares it exactly as it stands — your
        entries, pencil marks and colours included — for a second opinion or
        a race from the same spot.
      </p>
      <div className="hint-actions">
        <button onClick={() => copy('link')}>
          {copied === 'link' ? '✓ Copied' : '🔗 Puzzle link'}
        </button>
        <button onClick={() => copy('position')}>
          {copied === 'position' ? '✓ Copied' : '📍 Position link'}
        </button>
        <button className="ghost" onClick={() => copy('string')}>
          {copied === 'string' ? '✓ Copied' : 'Puzzle string'}
        </button>
      </div>
    </Modal>
  );
}

export function GeneratingDialog({ label, attempts, onCancel }: { label: string; attempts: number; onCancel: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Generating {label}…</h3>
        <div className="spinner" />
        <p className="dialog-note">
          {attempts > 0 ? `${attempts} puzzles examined` : 'Searching for a matching puzzle'}
        </p>
        <div className="hint-actions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function VictoryDialog({
  onNewGame,
  onClose,
  onAnother
}: {
  onNewGame: () => void;
  onClose: () => void;
  /** start a fresh practice puzzle for the same technique */
  onAnother?: () => void;
}) {
  const info = useGame((s) => s.info);
  const assisted = useGame((s) => s.assisted);
  const elapsedMs = useGame((s) => s.elapsedMs);
  const [copied, setCopied] = useState(false);
  if (!info) return null;
  const secs = Math.floor(elapsedMs() / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');

  // same-puzzle challenge: the share text carries the seed link, so the
  // recipient plays exactly this grid
  const shareResult = () => {
    const clean = assisted ? '' : ', no assists, every mark my own';
    const text = `I solved a ${info.level} sudoku (rating ${info.score}) in ${mm}:${ss}${clean} on sudokUI — can you beat that? https://sudokui.app/#p=${info.puzzle}`;
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
      <div className="modal victory">
        <h3>Solved! 🎉</h3>
        <p>
          {info.level} · score {info.score} · {mm}:{ss}
        </p>
        <p className={assisted ? 'solve-assisted' : 'solve-clean'}>
          {assisted
            ? 'Solved with assistance — restart the puzzle for a clean run'
            : '✨ Clean solve — no assists, every mark your own'}
        </p>
        <div className="hint-actions">
          {info.practiceTech && onAnother && (
            <button onClick={onAnother}>Another {TECHS[info.practiceTech].name}</button>
          )}
          <button onClick={onNewGame}>New game</button>
          <button onClick={shareResult}>{copied ? '✓ Copied' : '🔗 Challenge a friend'}</button>
          <button className="ghost" onClick={onClose}>Admire the grid</button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
