// Game dialogs: new game, practice (full technique catalogue), import/export,
// generation progress and victory — plus useNewGame, the hook that ties the
// puzzle pools, the generation worker and the game store together.
import React, { useState } from 'react';
import { useGame, rateImport } from '../state/gameStore';
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
  Easy: 'Singles only — a relaxed solve',
  Medium: 'Locked candidates and subsets',
  Hard: 'Fish, wings and single-digit patterns',
  Unfair: 'Chains, ALS and finned fish',
  Extreme: 'Everything the solver has got'
};

export function NewGameDialog({ onClose, onStart }: { onClose: () => void; onStart: (level: Level) => void }) {
  return (
    <Modal title="New game" onClose={onClose}>
      <div className="level-list">
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
        <button
          className="level-btn"
          onClick={() => onStart(LEVELS[Math.floor(Math.random() * LEVELS.length)])}
        >
          <strong>🎲 Surprise me</strong>
          <span>
            Any difficulty — enable "Hide difficulty while playing" in Settings
            for the full mystery
          </span>
        </button>
      </div>
    </Modal>
  );
}

export function PracticeDialog({ onClose, onStart }: { onClose: () => void; onStart: (tech: Tech) => void }) {
  const byCategory = new Map<Category, Tech[]>();
  for (const tech of ALL_TECHS) {
    if (TECHS[tech].category === 'Last Resort') continue;
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
        the position where it applies. Techniques marked ✗ or ≈ are shown for
        completeness but deliberately not playable: hover them to see why.
        The number on each technique is its rating cost: a puzzle's
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
                // implemented but disabled = mathematically redundant (large
                // fish): the solver knows it, but it never appears in a solve
                // path, so there is nothing to practise
                const redundant = !ok && info.implemented;
                return (
                  <button
                    key={tech}
                    disabled={!ok}
                    className={ok ? '' : redundant ? 'tech-redundant' : 'tech-missing'}
                    onClick={() => ok && onStart(tech)}
                    title={
                      ok
                        ? `Score ${info.score} · ${info.level}`
                        : redundant
                          ? `${info.name} is implemented, but provably redundant — its conclusions are always found by earlier techniques, so it never appears in a solve path`
                          : `${info.name} is deliberately not implemented — everything it can find, the AIC/ALS chain engines already find. It stays in the catalogue (score ${info.score}, ${info.level}) so the map of sudoku techniques is complete.`
                    }
                  >
                    {ok ? '' : redundant ? <span className="tech-tilde">≈ </span> : <span className="tech-x">✗ </span>}
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
    const rating = rateImport(cleaned);
    if (!rating) {
      setError('That puzzle has no unique solution.');
      return;
    }
    startGame(cleaned, rating.score, rating.level);
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
  const [copied, setCopied] = useState('');

  const currentAsString = () =>
    cells.map((c) => (c.given ? String(c.value) : '.')).join('');

  // the puzzle string doubles as the seed: anyone opening this link plays
  // the exact same game
  const shareLink = () =>
    `${window.location.origin}${window.location.pathname}#p=${currentAsString()}`;

  const copy = (what: 'link' | 'string') => {
    navigator.clipboard?.writeText(what === 'link' ? shareLink() : currentAsString());
    setCopied(what);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <Modal title="Share this puzzle" onClose={onClose}>
      <p className="dialog-note">
        Friends, streams, classrooms: anyone opening the link gets exactly
        this puzzle. The address bar always carries it too.
      </p>
      <div className="hint-actions">
        <button onClick={() => copy('link')}>
          {copied === 'link' ? '✓ Copied' : '🔗 Copy link'}
        </button>
        <button className="ghost" onClick={() => copy('string')}>
          {copied === 'string' ? '✓ Copied' : 'Copy puzzle string'}
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

export function VictoryDialog({ onNewGame, onClose }: { onNewGame: () => void; onClose: () => void }) {
  const info = useGame((s) => s.info);
  const elapsedMs = useGame((s) => s.elapsedMs);
  const [copied, setCopied] = useState(false);
  if (!info) return null;
  const secs = Math.floor(elapsedMs() / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');

  // same-puzzle challenge: the share text carries the seed link, so the
  // recipient plays exactly this grid
  const shareResult = () => {
    const text = `I solved a ${info.level} sudoku (rating ${info.score}) in ${mm}:${ss} on sudokUI — can you beat that? https://sudokui.app/#p=${info.puzzle}`;
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
        <div className="hint-actions">
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
