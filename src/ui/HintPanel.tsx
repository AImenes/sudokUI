// Progressive hint disclosure: first only the technique name and what that
// technique is in general (stage 'tech'), then the full explanation with
// board highlights (stage 'full'), then one click applies the step. The
// highlights themselves are rendered by Grid from the Step's
// primary/secondary/fin/elimination data.
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/gameStore';
import { TECHS, Tech } from '../engine/ratings';
import { TECH_DOCS } from '../content/techniqueDocs';
import { frequencyLabel } from '../content/frequency';
import { walkFrames, describe } from '../engine/hintFrames';

const KEY_SEEN = 'sudokui-cellkey-seen';

/** the chain trainer's panel: what each tap did, what the chain proves */
export function ChainPanel() {
  const chain = useGame((s) => s.chain);
  const note = useGame((s) => s.chainNote);
  const hint = useGame((s) => s.hint);
  const endChain = useGame((s) => s.endChain);
  const chainUndo = useGame((s) => s.chainUndo);
  const chainClear = useGame((s) => s.chainClear);
  const chainApply = useGame((s) => s.chainApply);
  const chainSuggest = useGame((s) => s.chainSuggest);
  const chainToggleSuggest = useGame((s) => s.chainToggleSuggest);
  const stage = useGame((s) => s.hintStage);
  const walkIndex = useGame((s) => s.walkIndex);
  const walkHint = useGame((s) => s.walkHint);
  const revealHint = useGame((s) => s.revealHint);
  if (!chain) return null;
  const elims = hint?.eliminations ?? [];
  const n = chain.nodes.length;
  const frames = hint ? walkFrames(hint) : [];
  const walking = stage === 'walk' && frames.length > 0;
  const frame = walking ? frames[Math.min(walkIndex, frames.length - 1)] : null;
  return (
    <div className="hint-panel" role="region" aria-label="Build a chain" aria-live="polite">
      <div className="hint-head">
        <strong>Build a chain</strong>
        <span className="hint-level">{n ? `${n} candidate${n > 1 ? 's' : ''}` : 'your move'}</span>
      </div>
      <div className="hint-body">
        <p className="chain-note">{note}</p>
        {frame ? (
          <div className="hint-walk" aria-live="polite">
            <p className="hint-walk-text">{frame.text}</p>
            <div className="hint-walk-nav">
              <button className="ghost" onClick={() => walkHint(-1)} disabled={walkIndex === 0} aria-label="Previous">
                ◀
              </button>
              <span className="hint-walk-count">
                {Math.min(walkIndex, frames.length - 1) + 1} of {frames.length}
              </span>
              <button className="ghost" onClick={() => walkHint(1)} disabled={walkIndex >= frames.length - 1} aria-label="Next">
                ▶
              </button>
            </div>
          </div>
        ) : (
          hint && <p>{hint.description}</p>
        )}
        {n > 1 && (
          <ul className="hint-legend">
            <li>
              <i style={{ background: 'var(--hint-primary)' }} />
              your chain: solid for a strong link, dashed for a weak one
            </li>
            {elims.length > 0 && (
              <li>
                <i style={{ background: 'var(--hint-elim)' }} />
                removed by it
              </li>
            )}
          </ul>
        )}
        <div className="hint-actions">
          {elims.length > 0 && (
            <button onClick={chainApply}>Apply: remove {elims.length}</button>
          )}
          {n > 0 && !chain.closed && (
            <button className="ghost" onClick={chainToggleSuggest} title="Mark every candidate linked to the last one">
              {chainSuggest ? 'Hide links' : 'Show links'}
            </button>
          )}
          {chain.links.length > 0 && frames.length > 1 && !walking && (
            <button className="ghost" onClick={() => walkHint()} title="Read your chain one link at a time (← and →)">
              Walk through it
            </button>
          )}
          {walking && (
            <button className="ghost" onClick={revealHint}>
              Show all
            </button>
          )}
          <button className="ghost" onClick={chainUndo} disabled={!n} title="Take the last candidate off (Backspace)">
            Undo last
          </button>
          <button className="ghost" onClick={chainClear} disabled={!n}>
            Clear
          </button>
          <button className="ghost" onClick={endChain} title="Leave the trainer (Escape)">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
const KEY_VIEWS = 8;

export function HintPanel({ onLearn }: { onLearn: (tech: Tech) => void }) {
  const hint = useGame((s) => s.hint);
  const stage = useGame((s) => s.hintStage);
  const revealHint = useGame((s) => s.revealHint);
  const walkHint = useGame((s) => s.walkHint);
  const walkIndex = useGame((s) => s.walkIndex);
  const applyHint = useGame((s) => s.applyHint);
  const dismissHint = useGame((s) => s.dismissHint);

  // cell names such as r2c3 are explained under the first few hints only:
  // a newcomer needs the key, a regular would find it noise
  const [showKey] = useState(() => Number(localStorage.getItem(KEY_SEEN) ?? 0) < KEY_VIEWS);
  useEffect(() => {
    if (hint && stage === 'full' && showKey) {
      localStorage.setItem(KEY_SEEN, String(Number(localStorage.getItem(KEY_SEEN) ?? 0) + 1));
    }
  }, [hint, stage, showKey]);

  // stacked layouts (phone, tablet) and short desktop windows: the panel
  // moves to the top of the column (styles.css), so bring the page back to
  // the top where the board and the panel can be seen together
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hint || stage === 'hidden') return;
    if (!window.matchMedia('(max-width: 860px), (max-height: 900px)').matches) return;
    panel.current?.closest('.layout')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [hint, stage]);

  if (!hint || stage === 'hidden') return null;
  const info = TECHS[hint.tech];
  const frames = walkFrames(hint);
  const walking = stage === 'walk';
  const banded = (role: 'primary' | 'secondary') => !!hint.units?.some((u) => u.role === role);
  const frame = walking ? frames[Math.min(walkIndex, frames.length - 1)] : null;

  return (
    <div className="hint-panel" ref={panel} role="region" aria-label="Hint" aria-live="polite">
      <div className="hint-head">
        <button
          className="hint-tech"
          onClick={() => onLearn(hint.tech)}
          title={`What is ${info.name}? Open the technique guide`}
        >
          <strong>{info.name}</strong>
          <span className="mini-i" aria-hidden="true">ⓘ</span>
        </button>
        <span
          className="hint-score"
          title={`${info.level}-class technique. Each use adds ${info.score} to a puzzle's rating`}
        >
          {info.level} · cost {info.score}
        </span>
      </div>
      {stage === 'tech' ? (
        <div className="hint-body">
          <p>
            The next step uses <strong>{info.name}</strong>.
          </p>
          <p className="hint-what">{TECH_DOCS[hint.tech].what}</p>
          {frequencyLabel(hint.tech) && (
            <p className="hint-freq">Needed in {frequencyLabel(hint.tech)} that sudokUI generates.</p>
          )}
          <div className="hint-actions">
            <button onClick={revealHint}>Show me</button>
            <button className="ghost" onClick={dismissHint}>Close</button>
          </div>
        </div>
      ) : (
        <div className="hint-body">
          {frame ? (
            <div className="hint-walk" aria-live="polite">
              <p className="hint-walk-text">{frame.text}</p>
              <div className="hint-walk-nav">
                <button
                  className="ghost"
                  onClick={() => walkHint(-1)}
                  disabled={walkIndex === 0}
                  aria-label="Previous step of the explanation (left arrow)"
                  title="Previous (←)"
                >
                  ◀
                </button>
                <span className="hint-walk-count">
                  {Math.min(walkIndex, frames.length - 1) + 1} of {frames.length}
                </span>
                <button
                  className="ghost"
                  onClick={() => walkHint(1)}
                  disabled={walkIndex >= frames.length - 1}
                  aria-label="Next step of the explanation (right arrow)"
                  title="Next (→)"
                >
                  ▶
                </button>
              </div>
            </div>
          ) : (
            <p>{describe(hint)}</p>
          )}
          {!frame && showKey && /r\dc\d/.test(hint.description) && (
            <p className="hint-key">r2c3 means row 2, column 3, counted from the top left.</p>
          )}
          {(
            <ul className="hint-legend">
              {hint.placements.length > 0 && (
                <li>
                  <i style={{ background: 'var(--hint-place)' }} />
                  place
                </li>
              )}
              {hint.eliminations.length > 0 && (
                <li>
                  <i style={{ background: 'var(--hint-elim)' }} />
                  remove
                </li>
              )}
              {(!!hint.primary?.length || !!hint.links?.length || banded('primary')) && (
                <li>
                  <i style={{ background: 'var(--hint-primary)' }} />
                  {hint.labels?.primary ?? 'the pattern'}
                </li>
              )}
              {(!!hint.secondary?.length || banded('secondary')) && (
                <li>
                  <i style={{ background: 'var(--hint-secondary)' }} />
                  {hint.labels?.secondary ?? 'supporting cells'}
                </li>
              )}
              {!!hint.fins?.length && (
                <li>
                  <i style={{ background: 'var(--hint-fin)' }} />
                  {hint.labels?.fins ?? 'fin'}
                </li>
              )}
            </ul>
          )}
          <div className="hint-actions">
            {frames.length > 1 && !walking && (
              <button className="ghost" onClick={() => walkHint()} title="Reveal the drawing one idea at a time (← and → step through it)">
                Walk through it
              </button>
            )}
            {walking && (
              <button className="ghost" onClick={revealHint} title="Show the whole drawing and the explanation">
                Show all
              </button>
            )}
            <button onClick={applyHint}>Apply step</button>
            <button className="ghost" onClick={dismissHint}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
