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

const KEY_SEEN = 'sudokui-cellkey-seen';
const KEY_VIEWS = 8;

export function HintPanel({ onLearn }: { onLearn: (tech: Tech) => void }) {
  const hint = useGame((s) => s.hint);
  const stage = useGame((s) => s.hintStage);
  const revealHint = useGame((s) => s.revealHint);
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

  // stacked layouts (phone, tablet): the hint opens under the board, so
  // bring the board back to the top where both can be seen together
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hint || stage === 'hidden') return;
    if (!window.matchMedia('(max-width: 860px)').matches) return;
    panel.current?.closest('.layout')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [hint, stage]);

  if (!hint || stage === 'hidden') return null;
  const info = TECHS[hint.tech];

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
          <p>{hint.description}</p>
          {showKey && /r\dc\d/.test(hint.description) && (
            <p className="hint-key">r2c3 means row 2, column 3, counted from the top left.</p>
          )}
          {/* colouring techniques name their own colours in the text */}
          {info.category !== 'Coloring' && (
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
              {(!!hint.primary?.length || !!hint.links?.length) && (
                <li>
                  <i style={{ background: 'var(--hint-primary)' }} />
                  {hint.labels?.primary ?? 'the pattern'}
                </li>
              )}
              {!!hint.secondary?.length && (
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
            <button onClick={applyHint}>Apply step</button>
            <button className="ghost" onClick={dismissHint}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
