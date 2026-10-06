// Learn is one place with three parts: your path (what to learn next, and
// the record), the practice list and the theory (the guide). Each lives in
// its own dialog, and this switch at the top of all three moves between
// them.
import React from 'react';
import { useT, msg } from '../content/i18n';

export type Hub = 'practice' | 'theory' | 'path';

export function HubTabs({
  active,
  onPractice,
  onTheory,
  onPath
}: {
  active: Hub;
  onPractice?: () => void;
  onTheory?: () => void;
  onPath?: () => void;
}) {
  const t = useT();
  // in the learner's order: what to learn next, then the drill, then the
  // reading behind it. The middle tab names a part, like Theory, not the
  // Practice button's action: its own key, so a language can use a noun
  const tabs: { key: Hub; icon: string; label: string; go?: () => void }[] = [
    { key: 'path', icon: '📈', label: msg('Your path'), go: onPath },
    { key: 'practice', icon: '🎯', label: msg('Practice||the Learn tab'), go: onPractice },
    { key: 'theory', icon: '📖', label: msg('Theory'), go: onTheory }
  ];
  return (
    <div className="segmented hub-tabs" role="tablist" aria-label={t('Learn')}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={tab.key === active}
          className={tab.key === active ? 'active' : ''}
          onClick={tab.key === active ? undefined : tab.go}
        >
          <span aria-hidden="true">{tab.icon}</span> {t(tab.label)}
        </button>
      ))}
    </div>
  );
}
