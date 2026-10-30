// Progressive hint disclosure: first only the technique name and what that
// technique is in general (stage 'tech'), then the full explanation with
// board highlights (stage 'full'), then one click applies the step. The
// highlights themselves are rendered by Grid from the Step's
// primary/secondary/fin/elimination data.
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/gameStore';
import { TECHS, Tech } from '../engine/ratings';
import type { Step } from '../engine/steps';
import { TECH_DOCS } from '../content/techniqueDocs';
import { frequencyParts } from '../content/frequency';
import { walkFrames, describe } from '../engine/hintFrames';
import { stepText } from '../content/eureka';
import { frameMarks, legendKinds, premiseOf, parityLegend, isParity, stemAlone, sharedTile } from '../content/hintMarks';
import type { Premise, Role, ParityEntry } from '../content/hintMarks';

interface TruthWords {
  isTrue: string;
  isFalse: string;
  /** a TRUE group, a FALSE group, and a set's true digit of several candidates (docs/hint-drawing-sets.md, decision 18) */
  squaresOnBar: string;
  ringsOnBar: string;
  squaresInSet: string;
  refuted: string;
}
import { copyText } from './send';
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
 * The legend's words for a chain's true discs and false rings, and for its
 * groups and sets drawn as shapes ("squares joined by a bar", "rings joined
 * by a bar", "squares in a set"; docs/hint-drawing-sets.md, decision 18),
 * under the premise of its first node, the one with the small start dot, a
 * group worded as a group (true: one of its candidates; false: none), a
 * digit of an almost locked set as the set's (true: the set holds it;
 * false: it holds none); and the line that says so when the drawing shows
 * that premise impossible
 */
function truthWords(t: Translator, p: Premise): TruthWords {
  if (p.kind === 'set') {
    const v = { L: p.letter, a: p.digit };
    // the digit with its article, "a 5" or "an 8", where the set holds one
    const w = { L: p.letter, aDigit: t(p.digit === 8 ? 'an {d}' : 'a {d}', { d: p.digit }) };
    return p.assumed
      ? {
          isTrue: t('true, if set {L} holds {aDigit} (by the small dot)', w),
          isFalse: t('false, if set {L} holds {aDigit} (by the small dot)', w),
          squaresOnBar: t('squares joined by a bar: one of them is true, if set {L} holds {aDigit} (by the small dot)', w),
          ringsOnBar: t('rings joined by a bar: none of them is true, if set {L} holds {aDigit} (by the small dot)', w),
          squaresInSet: t('squares in a set: one of them is true, if set {L} holds {aDigit} (by the small dot)', w),
          refuted: t('the chain shows that premise is impossible: set {L} holds no {a} (by the small dot)', v)
        }
      : {
          isTrue: t('true, if set {L} holds no {a} (by the small dot)', v),
          isFalse: t('false, if set {L} holds no {a} (by the small dot)', v),
          squaresOnBar: t('squares joined by a bar: one of them is true, if set {L} holds no {a} (by the small dot)', v),
          ringsOnBar: t('rings joined by a bar: none of them is true, if set {L} holds no {a} (by the small dot)', v),
          squaresInSet: t('squares in a set: one of them is true, if set {L} holds no {a} (by the small dot)', v),
          refuted: t('the chain shows that premise is impossible: set {L} holds {aDigit} (by the small dot)', w)
        };
  }
  if (p.kind === 'group') {
    return p.assumed
      ? {
          isTrue: t('true, if one candidate of the first group (by the small dot) is true'),
          isFalse: t('false, if one candidate of the first group (by the small dot) is true'),
          squaresOnBar: t('squares joined by a bar: one of them is true, if one candidate of the first group (by the small dot) is true'),
          ringsOnBar: t('rings joined by a bar: none of them is true, if one candidate of the first group (by the small dot) is true'),
          squaresInSet: t('squares in a set: one of them is true, if one candidate of the first group (by the small dot) is true'),
          refuted: t('the chain shows that premise is impossible: no candidate of the first group (by the small dot) is true')
        }
      : {
          isTrue: t('true, if no candidate of the first group (by the small dot) is true'),
          isFalse: t('false, if no candidate of the first group (by the small dot) is true'),
          squaresOnBar: t('squares joined by a bar: one of them is true, if no candidate of the first group (by the small dot) is true'),
          ringsOnBar: t('rings joined by a bar: none of them is true, if no candidate of the first group (by the small dot) is true'),
          squaresInSet: t('squares in a set: one of them is true, if no candidate of the first group (by the small dot) is true'),
          refuted: t('the chain shows that premise is impossible: one candidate of the first group (by the small dot) is true')
        };
  }
  return p.assumed
    ? {
        isTrue: t('true, if the first candidate (by the small dot) is true'),
        isFalse: t('false, if the first candidate (by the small dot) is true'),
        squaresOnBar: t('squares joined by a bar: one of them is true, if the first candidate (by the small dot) is true'),
        ringsOnBar: t('rings joined by a bar: none of them is true, if the first candidate (by the small dot) is true'),
        squaresInSet: t('squares in a set: one of them is true, if the first candidate (by the small dot) is true'),
        refuted: t('the chain shows that premise is impossible: the first candidate (by the small dot) is false')
      }
    : {
        isTrue: t('true, if the first candidate (by the small dot) is false'),
        isFalse: t('false, if the first candidate (by the small dot) is false'),
        squaresOnBar: t('squares joined by a bar: one of them is true, if the first candidate (by the small dot) is false'),
        ringsOnBar: t('rings joined by a bar: none of them is true, if the first candidate (by the small dot) is false'),
        squaresInSet: t('squares in a set: one of them is true, if the first candidate (by the small dot) is false'),
        refuted: t('the chain shows that premise is impossible: the first candidate (by the small dot) is true')
      };
}

/** a colouring legend entry's swatch, drawn like its mark (styles.css) */
const paritySwatch = (e: ParityEntry): string =>
  e.kind === 'pair'
    ? `swatch-shades-${e.cluster}`
    : e.kind === 'weakTie'
      ? 'swatch-weak-tie'
      : `swatch-${e.kind}`;

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
  const cells = useGame((s) => s.cells);
  const t = useT();
  if (!chain) return null;
  const elims = hint?.eliminations ?? [];
  const n = chain.nodes.length;
  const frames = hint ? walkFrames(hint) : [];
  const walking = stage === 'walk' && frames.length > 0;
  const frame = walking ? frames[Math.min(walkIndex, frames.length - 1)] : null;
  // the legend names what the board draws (G23), and a chain whose own
  // truths clash shows its premise impossible, and the legend says so
  const legend = hint ? legendKinds(hint, frameMarks(hint, frame, (c) => cells[c].value > 0)) : null;
  const words = truthWords(t, { assumed: false, kind: 'candidate' });
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
            {legend?.shown.has('true') && (
              <li>
                <i className="swatch-true" />
                {words.isTrue}
              </li>
            )}
            {legend?.shown.has('false') && (
              <li>
                <i className="swatch-false" />
                {words.isFalse}
              </li>
            )}
            <li>{t('your chain: solid into a candidate it makes true, dashed into one it makes false')}</li>
            {legend?.refuted && <li>{words.refuted}</li>}
            {legend?.shown.has('elim') && (
              <li>
                <i className="swatch-elim" />
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

export function HintPanel({ onLearn, onReport }: { onLearn: (tech: Tech) => void; onReport?: (hint: Step) => void }) {
  const hint = useGame((s) => s.hint);
  const stage = useGame((s) => s.hintStage);
  const revealHint = useGame((s) => s.revealHint);
  const walkHint = useGame((s) => s.walkHint);
  const walkIndex = useGame((s) => s.walkIndex);
  const applyHint = useGame((s) => s.applyHint);
  const dismissHint = useGame((s) => s.dismissHint);
  const cells = useGame((s) => s.cells);
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

  // the step as one line of the forums' notation (src/content/eureka.ts),
  // for a post or a second opinion; the button confirms for a moment, and
  // only when the clipboard took it (src/ui/send.ts)
  const [copied, setCopied] = useState(false);
  const copyStep = () => {
    if (!hint) return;
    void copyText(stepText(hint)).then((outcome) => {
      if (outcome !== 'copied') return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
  const frame = walking ? frames[Math.min(walkIndex, frames.length - 1)] : null;
  // the legend names what the board draws in the frame shown, and nothing
  // it does not (G23): a role whose every candidate became a removal or a
  // placement lends its words to that entry
  const marks = frameMarks(hint, frame, (c) => cells[c].value > 0);
  const legend = legendKinds(hint, marks);
  // a colouring names its shades, its lines and its proven colours
  // (docs/hint-drawing-colouring.md), in the words the Learn legend uses
  const parity = isParity(hint) ? parityLegend(hint, marks) : null;
  // a cell of two almost locked sets the view draws, as the board draws it (docs/hint-drawing-sets.md, decision 6)
  const shared = sharedTile(hint, marks);
  const lent = (roles: Role[]) =>
    roles
      .map((r) => (r === 'primary' ? hint.labels?.primary : r === 'secondary' ? hint.labels?.secondary : hint.labels?.fins))
      .filter((s): s is string => !!s);
  // what a derived chain's truths are under: its first node's premise
  const premise = premiseOf(hint);
  // a swatch is drawn like the role's mark: a disc, the solved digit's
  // outline, or a house band
  const swatch = (role: Role) =>
    `swatch-${role}${legend.onValue.has(role) ? ' on-value' : legend.onBand.has(role) ? ' on-band' : ''}`;

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
          title={t("{level}-class technique. Each use adds {score} to a puzzle's HoDoKu rating", { level, score: info.score })}
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
          {parity ? (
            <ul className="hint-legend">
              {parity.map((e) => (
                <li key={`${e.kind}${e.cluster ?? ''}:${e.label}`}>
                  <i className={paritySwatch(e)} />
                  {e.label}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="hint-legend">
              {legend.shown.has('place') && (
                <li>
                  <i className="swatch-place" />
                  {[t('place'), ...lent(legend.intoPlace)].join(': ')}
                </li>
              )}
              {legend.shown.has('elim') && (
                <li>
                  <i className="swatch-elim" />
                  {[t('remove'), ...lent(legend.intoRemove)].join(': ')}
                </li>
              )}
              {premise && legend.shown.has('true') && (
                <li>
                  <i className="swatch-true" />
                  {truthWords(t, premise).isTrue}
                </li>
              )}
              {premise && legend.shown.has('false') && (
                <li>
                  <i className="swatch-false" />
                  {truthWords(t, premise).isFalse}
                </li>
              )}
              {premise && legend.bars.has('oneOf') && (
                <li>
                  <i className="swatch-one-of-bar" />
                  {truthWords(t, premise).squaresOnBar}
                </li>
              )}
              {premise && legend.bars.has('false') && (
                <li>
                  <i className="swatch-false-bar" />
                  {truthWords(t, premise).ringsOnBar}
                </li>
              )}
              {premise && legend.setSquares && (
                <li>
                  <i className="swatch-one-of" />
                  {truthWords(t, premise).squaresInSet}
                </li>
              )}
              {premise && legend.refuted && <li>{truthWords(t, premise).refuted}</li>}
              {legend.shown.has('primary') && (
                <li>
                  <i className={swatch('primary')} />
                  {hint.labels?.primary ?? t('the pattern')}
                </li>
              )}
              {legend.shown.has('secondary') && (
                <li>
                  <i className={swatch('secondary')} />
                  {/* a Death Blossom's gold before any petal's digit is drawn: the stem's candidates alone */}
                  {stemAlone(hint, marks) ? t("the stem's candidates") : (hint.labels?.secondary ?? t('supporting cells'))}
                </li>
              )}
              {legend.shown.has('fin') && (
                <li>
                  <i className={swatch('fin')} />
                  {hint.labels?.fins ?? t('fin')}
                </li>
              )}
              {/* a bar in the pattern's ink (a proof-only view) or the removal's: what a bar is, its swatch in the ink drawn, or one bar in each where both are */}
              {(legend.bars.has('primary') || legend.bars.has('elim')) && (
                <li>
                  <i
                    className={
                      legend.bars.has('primary') && legend.bars.has('elim') ? 'swatch-bars' : legend.bars.has('primary') ? 'swatch-bar-primary' : 'swatch-bar-elim'
                    }
                  />
                  {t("bar: a group (one digit's cells in one box and one row or column), read as one node")}
                </li>
              )}
              {/* an almost locked set's lettered tiles, the swatch a small tile in the first tint drawn, with its tab (docs/hint-drawing-sets.md, decision 18) */}
              {legend.tiles.length > 0 && (
                <li>
                  <i className={`swatch-set-${legend.tiles[0]}`} />
                  {hint.tech === 'DEATH_BLOSSOM'
                    ? t("lettered cells: a petal, an almost locked set for one of the stem's digits")
                    : t('lettered cells: an almost locked set, one digit more than cells; without any one of its digits, the others fill its cells')}
                </li>
              )}
              {/* a cell of two sets: one set's tile with the other's outline dashed inside it, in their tints */}
              {shared && (
                <li>
                  <i className={`swatch-shared tile-${shared.tile} dash-${shared.dashed}`} />
                  {t('dashed outline: a cell of two sets; each tab names one')}
                </li>
              )}
              {/* a Death Blossom's weak ties from its stem to its petals, dashed with no head (docs/hint-drawing-sets.md, decision 15) */}
              {legend.lines.has('weakTie') && (
                <li>
                  <i className="swatch-weak-tie" />
                  {t('dashed line: its two ends see each other, so at most one is true')}
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
            <button
              className="ghost"
              onClick={copyStep}
              title={t('Copy this step as one line of notation (Eureka for a chain), the way the forums write it')}
            >
              {copied ? `✓ ${t('Copied')}` : t('Copy step')}
            </button>
            {/* a wrong hint teaches something false: the report carries it, the board and the settings it was found under */}
            {onReport && (
              <button className="ghost" onClick={() => onReport(hint)} title={t('Tell the developer this hint looks wrong; it goes with the board')}>
                {t('Looks wrong?')}
              </button>
            )}
            <button className="ghost" onClick={dismissHint}>{t('Close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
