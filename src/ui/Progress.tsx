// Your path and your record: the techniques worth learning in the order
// the solver needs them, with where the player stands on each from their
// own play, and the band records and the daily streak (src/content/path.ts,
// src/state/stats.ts). Everything here is on the device only.
import React from 'react';
import { Modal } from './Dialogs';
import { useStats, dailyStreak } from '../state/stats';
import { PATH, pathStatus, LEARNED_AT, PathRow } from '../content/path';
import { LEVELS, Tech, Level } from '../engine/ratings';
import { frequencyParts } from '../content/frequency';
import { useT, rich, Translator } from '../content/i18n';
import { HubTabs } from './HubTabs';
import { useBandWords } from './BandTable';
import type { LearnTarget } from './Learn';

/**
 * "34% of puzzles", "1 in 120 puzzles", or '' for a technique the solver
 * never uses: frequencyLabel's English, one whole phrase per kind. Not
 * through useLearnText, which would pull the guide into the main chunk.
 */
function frequencyText(t: Translator, tech: Tech): string {
  const p = frequencyParts(tech);
  if (!p) return '';
  if (p.kind === 'fewer') return t('fewer than 1 in {n} puzzles', { n: t.num(p.n) });
  if (p.kind === 'every') return t('every puzzle');
  if (p.kind === 'share') return t('{p}% of puzzles', { p: p.percent });
  return t('1 in {n} puzzles', { n: t.num(p.n) });
}

const clock = (ms: number) => {
  const secs = Math.floor(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

const MARK: Record<PathRow['state'], string> = { learned: '✓', started: '◐', next: '▶', ahead: '○' };

export function ProgressDialog({
  onClose,
  onLearn,
  onPractice,
  onPracticeList
}: {
  onClose: () => void;
  onLearn: (target: LearnTarget) => void;
  onPractice: (tech: Tech) => void;
  /** the practice list, the first part of Learn */
  onPracticeList: () => void;
}) {
  const techs = useStats((s) => s.techs);
  const bands = useStats((s) => s.bands);
  const dailyDays = useStats((s) => s.dailyDays);
  const t = useT();
  // each band's lead, in the words the guide uses
  const bandWords = useBandWords();
  const status = pathStatus(techs);
  const streak = dailyStreak(dailyDays);
  const played = LEVELS.filter((l) => bands[l]);
  // the path in sections, one per class, in order
  const sections = LEVELS.map((level) => ({ level, rows: status.rows.filter((r) => r.level === level) })).filter(
    (s) => s.rows.length
  );

  return (
    <Modal title={t('Learn')} onClose={onClose} wide>
      <HubTabs active="path" onPractice={onPracticeList} onTheory={() => onLearn({ tab: 'techniques' })} />
      <p className="dialog-note">
        {t(
          'The techniques worth learning, in the order puzzles need them. A technique counts as learned once you have played it unaided {n} times; every move of your own is credited with the easiest technique that justifies it. Nothing leaves this device.',
          { n: LEARNED_AT }
        )}
      </p>
      <p className="path-summary">
        <strong>{t('{n} of {total} learned', { n: status.learned, total: PATH.length })}</strong>
        {status.next && (
          <>
            {' · '}
            {rich(t('next: {tech}'), { tech: <strong>{t.tech(status.next)}</strong> })}{' '}
            <button className="path-go" onClick={() => onPractice(status.next!)}>
              {t('Practice')}
            </button>
          </>
        )}
      </p>
      {sections.map(({ level, rows }) => (
        <section key={level} className="path-section">
          <h4 className="setting-group">
            <span className={`level-badge level-${level.toLowerCase()}`}>{t.level(level)}</span> {bandWords.leads[level as Level]}
          </h4>
          <ul className="path-list">
            {rows.map((r) => (
              <li key={r.tech} className={`path-row path-${r.state}`}>
                <span className="path-mark" aria-hidden="true">
                  {MARK[r.state]}
                </span>
                <span className="path-name">
                  <button className="learn-link" onClick={() => onLearn({ tab: 'techniques', tech: r.tech })}>
                    {t.tech(r.tech)}
                  </button>
                  <span className="path-freq">{frequencyText(t, r.tech)}</span>
                </span>
                <span className="path-play">
                  {r.unaided || r.hinted ? t('{n} unaided · {h} hinted', { n: r.unaided, h: r.hinted }) : t('not yet')}
                </span>
                <button className="ghost path-practice" onClick={() => onPractice(r.tech)}>
                  {t('Practice')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <h4 className="setting-group">{t('Your record')}</h4>
      {played.length === 0 && !streak ? (
        <p className="dialog-note">{t('No finished games yet. Your solves by band, best times and the daily streak will show here.')}</p>
      ) : (
        <>
          <table className="path-record">
            <thead>
              <tr>
                <th>{t('Band')}</th>
                <th>{t('Solves')}</th>
                <th>{t('Unassisted')}</th>
                <th>{t('Best')}</th>
                <th>{t('Average')}</th>
              </tr>
            </thead>
            <tbody>
              {played.map((l) => {
                const b = bands[l]!;
                return (
                  <tr key={l}>
                    <td>
                      <span className={`level-badge level-${l.toLowerCase()}`}>{t.level(l)}</span>
                    </td>
                    <td>{b.solves}</td>
                    <td>{b.unassisted}</td>
                    <td>{clock(b.bestMs)}</td>
                    <td>{clock(b.totalMs / b.solves)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="dialog-note">
            🔥{' '}
            {t(
              streak === 1
                ? 'Daily streak: {n} day · {solved} daily puzzles solved'
                : 'Daily streak: {n} days · {solved} daily puzzles solved',
              { n: streak, solved: dailyDays.length }
            )}
          </p>
        </>
      )}
    </Modal>
  );
}
