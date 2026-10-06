// Your path and your record: the techniques worth learning in the order
// the solver needs them, with where the player stands on each from their
// own play, and the band records and the daily streak (src/content/path.ts,
// src/state/stats.ts). Everything here is on the device only.
import React from 'react';
import { Modal } from './Dialogs';
import { useStats, dailyStreak } from '../state/stats';
import { PATH, pathStatus, LEARNED_AT, PathRow } from '../content/path';
import { TECHS, LEVELS, Tech, Level } from '../engine/ratings';
import { frequencyLabel } from '../content/frequency';
import { BAND_LEADS } from '../content/rating';
import { useT } from '../content/i18n';
import { HubTabs } from './HubTabs';
import type { LearnTarget } from './Learn';

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
        {t('The techniques worth learning, in the order puzzles need them. A technique counts as learned once you have played it unaided')}{' '}
        {LEARNED_AT} {t('times; every move of your own is credited with the easiest technique that justifies it. Nothing leaves this device.')}
      </p>
      <p className="path-summary">
        <strong>
          {status.learned} {t('of')} {PATH.length} {t('learned')}
        </strong>
        {status.next && (
          <>
            {' · '}
            {t('next')}: <strong>{TECHS[status.next].name}</strong>{' '}
            <button className="path-go" onClick={() => onPractice(status.next!)}>
              {t('Practice')}
            </button>
          </>
        )}
      </p>
      {sections.map(({ level, rows }) => (
        <section key={level} className="path-section">
          <h4 className="setting-group">
            <span className={`level-badge level-${level.toLowerCase()}`}>{level}</span> {BAND_LEADS[level as Level]}
          </h4>
          <ul className="path-list">
            {rows.map((r) => (
              <li key={r.tech} className={`path-row path-${r.state}`}>
                <span className="path-mark" aria-hidden="true">
                  {MARK[r.state]}
                </span>
                <span className="path-name">
                  <button className="learn-link" onClick={() => onLearn({ tab: 'techniques', tech: r.tech })}>
                    {TECHS[r.tech].name}
                  </button>
                  <span className="path-freq">{frequencyLabel(r.tech) ?? ''}</span>
                </span>
                <span className="path-play">
                  {r.unaided || r.hinted ? `${r.unaided} ${t('unaided')} · ${r.hinted} ${t('hinted')}` : t('not yet')}
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
                      <span className={`level-badge level-${l.toLowerCase()}`}>{l}</span>
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
            🔥 {t('Daily streak')}: {streak} {streak === 1 ? t('day') : t('days')} · {dailyDays.length} {t('daily puzzles solved')}
          </p>
        </>
      )}
    </Modal>
  );
}
