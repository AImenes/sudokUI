// Progressive hint disclosure: first only the technique name and what that
// technique is in general (stage 'tech'), then the full explanation with
// board highlights (stage 'full'), then one click applies the step. The
// highlights themselves are rendered by Grid from the Step's
// primary/secondary/fin/elimination data.
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/gameStore';
import { TECHS, Tech } from '../engine/ratings';
import { TECH_DOCS } from '../content/techniqueDocs';
import { frequencyParts } from '../content/frequency';
import { walkFrames, describe } from '../engine/hintFrames';
import { useT, rich, Translator } from '../content/i18n';
import { useLearnLocale } from './useLearnLocale';

const KEY_SEEN = 'sudokui-cellkey-seen';

/**
 * What a technique is, in the player's language: from the Learn section's
 * translation (useLearnLocale.ts), English until it has arrived and if it
 * cannot be fetched. The fetch starts when the panel mounts, so it has
 * arrived by the time a hint is asked for.
 */
function useTechWhat(): (tech: Tech) => string {
  const loc = useLearnLocale();
  return (tech) => loc?.techDocs[tech]?.what ?? TECH_DOCS[tech].what;
}

/**
 * "Needed in 34% of puzzles that sudokUI generates.", or null for a
 * technique the solver never uses: one whole sentence per kind, so each
 * language words it its own way (the English is frequencyLabel's)
 */
function neededIn(t: Translator, tech: Tech): string | null {
  const p = frequencyParts(tech);
  if (!p) return null;
  if (p.kind === 'fewer') return t('Needed in fewer than 1 in {n} puzzles that sudokUI generates.', { n: t.num(p.n) });
  if (p.kind === 'every') return t('Needed in every puzzle that sudokUI generates.');
  if (p.kind === 'share') return t('Needed in {p}% of puzzles that sudokUI generates.', { p: p.percent });
  return t('Needed in 1 in {n} puzzles that sudokUI generates.', { n: t.num(p.n) });
}

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
  const t = useT();
  if (!chain) return null;
  const elims = hint?.eliminations ?? [];
  const n = chain.nodes.length;
  const frames = hint ? walkFrames(hint) : [];
  const walking = stage === 'walk' && frames.length > 0;
  const frame = walking ? frames[Math.min(walkIndex, frames.length - 1)] : null;
  return (
    <div className="hint-panel" role="region" aria-label={t('Build a chain')} aria-live="polite">
      <div className="hint-head">
        <strong>{t('Build a chain')}</strong>
        <span className="hint-level">{n ? t(n === 1 ? '{n} candidate' : '{n} candidates', { n }) : t('your move')}</span>
      </div>
      <div className="hint-body">
        <p className="chain-note">{note}</p>
        {frame ? (
          <div className="hint-walk" aria-live="polite">
            <p className="hint-walk-text">{frame.text}</p>
            <div className="hint-walk-nav">
              <button className="ghost" onClick={() => walkHint(-1)} disabled={walkIndex === 0} aria-label={t('Previous')}>
                ◀
              </button>
              <span className="hint-walk-count">
                {t('{i} of {n}', { i: Math.min(walkIndex, frames.length - 1) + 1, n: frames.length })}
              </span>
              <button className="ghost" onClick={() => walkHint(1)} disabled={walkIndex >= frames.length - 1} aria-label={t('Next')}>
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
              {t('your chain: solid for a strong link, dashed for a weak one')}
            </li>
            {elims.length > 0 && (
              <li>
                <i style={{ background: 'var(--hint-elim)' }} />
                {t('removed by it')}
              </li>
            )}
          </ul>
        )}
        <div className="hint-actions">
          {elims.length > 0 && (
            <button onClick={chainApply}>{t('Apply: remove {n}', { n: elims.length })}</button>
          )}
          {n > 0 && !chain.closed && (
            <button className="ghost" onClick={chainToggleSuggest} title={t('Mark every candidate linked to the last one')}>
              {chainSuggest ? t('Hide links') : t('Show links')}
            </button>
          )}
          {chain.links.length > 0 && frames.length > 1 && !walking && (
            <button className="ghost" onClick={() => walkHint()} title={t('Read your chain one link at a time (← and →)')}>
              {t('Walk through it')}
            </button>
          )}
          {walking && (
            <button className="ghost" onClick={revealHint}>
              {t('Show all')}
            </button>
          )}
          <button className="ghost" onClick={chainUndo} disabled={!n} title={t('Take the last candidate off (Backspace)')}>
            {t('Undo last')}
          </button>
          <button className="ghost" onClick={chainClear} disabled={!n}>
            {t('Clear||the chain')}
          </button>
          <button className="ghost" onClick={endChain} title={t('Leave the trainer (Escape)')}>
            {t('Done')}
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
  const t = useT();
  const techWhat = useTechWhat();

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
  const name = t.tech(hint.tech);
  const level = t.level(info.level);
  const needed = neededIn(t, hint.tech);
  const frames = walkFrames(hint);
  const walking = stage === 'walk';
  const banded = (role: 'primary' | 'secondary') => !!hint.units?.some((u) => u.role === role);
  const frame = walking ? frames[Math.min(walkIndex, frames.length - 1)] : null;

  return (
    <div className="hint-panel" ref={panel} role="region" aria-label={t('Hint')} aria-live="polite">
      <div className="hint-head">
        <button
          className="hint-tech"
          onClick={() => onLearn(hint.tech)}
          title={t('What is {name}? Open the technique guide', { name })}
        >
          <strong>{name}</strong>
          <span className="mini-i" aria-hidden="true">ⓘ</span>
        </button>
        <span
          className="hint-score"
          title={t("{level}-class technique. Each use adds {score} to a puzzle's rating", { level, score: info.score })}
        >
          {t('{level} · cost {score}', { level, score: info.score })}
        </span>
      </div>
      {stage === 'tech' ? (
        <div className="hint-body">
          <p>{rich(t('The next step uses {name}.'), { name: <strong>{name}</strong> })}</p>
          <p className="hint-what">{techWhat(hint.tech)}</p>
          {needed && <p className="hint-freq">{needed}</p>}
          <div className="hint-actions">
            <button onClick={revealHint}>{t('Show me')}</button>
            <button className="ghost" onClick={dismissHint}>{t('Close')}</button>
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
                  aria-label={t('Previous step of the explanation (left arrow)')}
                  title={t('Previous (←)')}
                >
                  ◀
                </button>
                <span className="hint-walk-count">
                  {t('{i} of {n}', { i: Math.min(walkIndex, frames.length - 1) + 1, n: frames.length })}
                </span>
                <button
                  className="ghost"
                  onClick={() => walkHint(1)}
                  disabled={walkIndex >= frames.length - 1}
                  aria-label={t('Next step of the explanation (right arrow)')}
                  title={t('Next (→)')}
                >
                  ▶
                </button>
              </div>
            </div>
          ) : (
            <p>{describe(hint)}</p>
          )}
          {!frame && showKey && /r\dc\d/.test(hint.description) && (
            <p className="hint-key">{t('r2c3 means row 2, column 3, counted from the top left.')}</p>
          )}
          {(
            <ul className="hint-legend">
              {hint.placements.length > 0 && (
                <li>
                  <i style={{ background: 'var(--hint-place)' }} />
                  {t('place')}
                </li>
              )}
              {hint.eliminations.length > 0 && (
                <li>
                  <i style={{ background: 'var(--hint-elim)' }} />
                  {t('remove')}
                </li>
              )}
              {(!!hint.primary?.length || !!hint.links?.length || banded('primary')) && (
                <li>
                  <i style={{ background: 'var(--hint-primary)' }} />
                  {hint.labels?.primary ?? t('the pattern')}
                </li>
              )}
              {(!!hint.secondary?.length || banded('secondary')) && (
                <li>
                  <i style={{ background: 'var(--hint-secondary)' }} />
                  {hint.labels?.secondary ?? t('supporting cells')}
                </li>
              )}
              {!!hint.fins?.length && (
                <li>
                  <i style={{ background: 'var(--hint-fin)' }} />
                  {hint.labels?.fins ?? t('fin')}
                </li>
              )}
            </ul>
          )}
          <div className="hint-actions">
            {frames.length > 1 && !walking && (
              <button className="ghost" onClick={() => walkHint()} title={t('Reveal the drawing one idea at a time (← and → step through it)')}>
                {t('Walk through it')}
              </button>
            )}
            {walking && (
              <button className="ghost" onClick={revealHint} title={t('Show the whole drawing and the explanation')}>
                {t('Show all')}
              </button>
            )}
            <button onClick={applyHint}>{t('Apply step')}</button>
            <button className="ghost" onClick={dismissHint}>{t('Close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
