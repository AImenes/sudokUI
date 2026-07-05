import React from 'react';
import { useGame } from '../state/gameStore';
import { TECHS } from '../engine/ratings';

export function HintPanel() {
  const hint = useGame((s) => s.hint);
  const stage = useGame((s) => s.hintStage);
  const revealHint = useGame((s) => s.revealHint);
  const applyHint = useGame((s) => s.applyHint);
  const dismissHint = useGame((s) => s.dismissHint);

  if (!hint || stage === 'hidden') return null;
  const info = TECHS[hint.tech];

  return (
    <div className="hint-panel">
      <div className="hint-head">
        <strong>{info.name}</strong>
        <span className="hint-score">
          {info.level} · +{info.score}
        </span>
      </div>
      {stage === 'tech' ? (
        <div className="hint-body">
          <p>The next step uses <strong>{info.name}</strong>. Want to see it?</p>
          <div className="hint-actions">
            <button onClick={revealHint}>Show me</button>
            <button className="ghost" onClick={dismissHint}>Close</button>
          </div>
        </div>
      ) : (
        <div className="hint-body">
          <p>{hint.description}</p>
          <div className="hint-actions">
            <button onClick={applyHint}>Apply step</button>
            <button className="ghost" onClick={dismissHint}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
