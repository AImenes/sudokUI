// The Learn dialog: every technique explained (what it is, why it works,
// how to spot it), the ideas behind them, the glossary of sudoku language,
// and how the rating works, in the player's language. The same content
// feeds the static /learn/ pages.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { describe } from '../engine/hintFrames';
import { engineLang } from '../engine/text';
import type { Step } from '../engine/steps';
import { Modal } from './Dialogs';
import { BandTable } from './BandTable';
import { TECHS, ALL_TECHS, SOLVE_ORDER, LEVELS, LEVEL_MAX_SCORE, Tech } from '../engine/ratings';
import { techStatus, techniquesByFamily } from '../content/categories';
import { KIN } from '../content/kin';
import { INTUITION, INTUITION_URL } from '../content/intuition';
import { intuitionDiagram, DIAGRAM_IDS } from '../content/intuitionDiagrams';
import { GLOSSARY, GLOSSARY_GROUPS } from '../content/glossary';
import { techSlug, slugify } from '../content/slugs';
import { linkGlossary } from '../content/glossaryLinks';
import { boardSvg, legendOf, Example } from '../content/boardSvg';
import { share, worth } from '../content/frequency';
import { useStats, learnNextScore } from '../state/stats';
import { solveTimeTables } from '../content/solveTimes';
import { LearnText, langPrefix, exampleStep } from '../content/learnLocale';
import type { LearnString } from '../content/learnStrings';
import { useT, msg } from '../content/i18n';
import { HubTabs } from './HubTabs';
import { useLearnText } from './useLearnText';

type Examples = Partial<Record<Tech, Example>>;

// the examples are a sizeable file: fetched when the guide is first opened,
// never as part of loading the game, and kept for the next opening
let loadedExamples: Examples | undefined;

// each example's step in each language the engine has explained it in
const exampleSteps = new Map<string, Step>();

/**
 * A worked example's step in the language the engine writes in now (it
 * follows the setting, src/content/i18n.ts): the stored step is English,
 * and the engine takes the same step again in another language, once per
 * technique and language.
 */
function localStep(tech: Tech, example: Example): Step {
  const key = `${engineLang()}:${tech}`;
  let step = exampleSteps.get(key);
  if (!step) {
    step = exampleStep(tech, example);
    exampleSteps.set(key, step);
  }
  return step;
}

/**
 * A real position where the technique applies, drawn by the same renderer
 * as the static pages. The drawing goes through an image so that its
 * styles cannot leak into the live board, which is SVG too. The step's own
 * wording comes from the solver, in the player's language.
 */
function WorkedExample({
  tech,
  example,
  onOpen,
  lt
}: {
  tech: Tech;
  example: Example;
  onOpen: (tech: Tech) => void;
  lt: LearnText;
}) {
  const title = lt.s('{name} example on a sudoku board', { name: lt.techName(tech) });
  const src = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(boardSvg(example, title))}`,
    [example, title]
  );
  const step = localStep(tech, example);
  const text = describe(step);
  return (
    <figure className="learn-example">
      <span className="learn-label">{lt.s('Worked example')}</span>
      <img src={src} alt={`${title}. ${text}`} />
      <figcaption>
        <span className="learn-legend">
          {legendOf(step).map((l) => (
            <span key={l.label}>
              <i style={{ background: l.colour }} />
              {l.label}
            </span>
          ))}
        </span>
        <span>{text}</span>
        {example.credit && <span className="learn-see"> {lt.s('Puzzle: {credit}.', { credit: example.credit })}</span>}
        {example.afterHarder && (
          <span className="learn-see"> {lt.s('In this puzzle the position comes after harder steps.')}</span>
        )}
      </figcaption>
      <button className="learn-link" onClick={() => onOpen(tech)}>
        {lt.s('Open this position on the board')}
      </button>
    </figure>
  );
}

export type LearnTab = 'techniques' | 'intuition' | 'method' | 'glossary' | 'rating';

/** running text whose glossary terms open their definition */
function Linked({
  text,
  onTerm,
  exclude,
  lt
}: {
  text: string;
  /** called with the glossary entry's id */
  onTerm: (id: string) => void;
  exclude?: string;
  lt: LearnText;
}) {
  return (
    <>
      {linkGlossary(text, exclude, lt.lang, lt.loc.glossary).map((seg, i) =>
        seg.term ? (
          <button
            key={i}
            className="learn-link term"
            title={lt.s('Glossary: {term}', { term: lt.glossary(seg.term).term })}
            onClick={(e) => {
              // inside a <summary>, the click must not also fold the technique
              e.preventDefault();
              e.stopPropagation();
              onTerm(seg.term!);
            }}
          >
            {seg.text}
          </button>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
}

export interface LearnTarget {
  tab: LearnTab;
  tech?: Tech;
  /** a glossary entry: its id, or its English term */
  term?: string;
}

/** the glossary entry a link or a #learn=term: address means */
export function glossaryId(term: string | undefined): string | undefined {
  if (!term) return undefined;
  const t = term.toLowerCase();
  return GLOSSARY.find((e) => e.id === t || e.term.toLowerCase() === t || slugify(e.term) === slugify(term))?.id;
}

/** the eight difficulty bands with their score ceilings */
export function RatingExplainer() {
  const lt = useLearnText();
  const { rating } = lt.loc;
  return (
    <>
      <p className="learn-lead">{rating.summary}</p>
      <dl className="learn-points">
        {rating.points.map((p) => (
          <React.Fragment key={p.title}>
            <dt>{p.title}</dt>
            <dd>{p.text}</dd>
          </React.Fragment>
        ))}
      </dl>
      <BandTable
        level={lt.level}
        note={(l) => lt.loc.bandNotes[l]}
        upTo={(n) => lt.s('up to {n}', { n })}
        above={(n) => lt.s('above {n}', { n })}
      />
      <section className="learn-group">
        <h4>{lt.s('How fast is fast?')}</h4>
        <p className="learn-prose">{rating.solveTimeNote}</p>
        <table className="shortcut-table band-table time-table">
          <thead>
            <tr>
              <th></th>
              <th>{lt.s('Slow')}</th>
              <th>{lt.s('Typical')}</th>
              <th>{lt.s('Fast')}</th>
              <th>{lt.s('Expert')}</th>
              <th>{lt.s('World class')}</th>
            </tr>
          </thead>
          {solveTimeTables(lt.lang).map((t) => {
            const label = rating.modes[t.mode];
            return (
              <tbody key={t.mode}>
                <tr className="time-mode">
                  <th colSpan={6}>{label[0].toUpperCase() + label.slice(1)}</th>
                </tr>
                {t.rows.map((r) => (
                  <tr key={r.level}>
                    <td>
                      <span className={`level-badge level-${r.level.toLowerCase()}`}>{lt.level(r.level)}</span>
                    </td>
                    <td>{r.slow}</td>
                    <td>{r.typical}</td>
                    <td>{r.fast}</td>
                    <td>{r.expert}</td>
                    <td>{r.worldClass}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
        <p className="learn-aka">
          {lt.s(
            'Slow is where the slowest fifth begins. Typical is the median solver. Fast is faster than four solvers in five, Expert faster than 99 in 100, World class faster than 999 in 1,000.'
          )}
        </p>
      </section>
    </>
  );
}

/** the orders the technique list can be read in */
export type LearnSort = 'family' | 'easiest' | 'common' | 'worth' | 'next';

/** label: the heading of the sorted list; menu: how the option reads in the closed select */
const sortOptions = (lt: LearnText): { value: LearnSort; label: string; menu: string; note?: string }[] => [
  { value: 'family', label: lt.s('By family'), menu: lt.s('By family') },
  {
    value: 'easiest',
    label: lt.s('Easiest first'),
    menu: lt.s('Easiest first'),
    note: lt.s('In the order the solver tries them: a technique is only needed once everything above it has run dry.')
  },
  {
    value: 'common',
    label: lt.s('Most often needed'),
    menu: lt.s('Most often needed first'),
    note: lt.s('The techniques that turn up in the most puzzles sudokUI generates, whatever their difficulty.')
  },
  {
    value: 'worth',
    label: lt.s('Most worth learning'),
    menu: lt.s('Most worth learning first'),
    note: lt.s(
      'How often a technique is needed, weighted by its rating cost. Difficulty and frequency are different things: a hard technique that turns up often repays the effort of learning it, and those come first.'
    )
  },
  {
    value: 'next',
    label: lt.s('Learn next'),
    menu: lt.s('Learn next first'),
    note: lt.s(
      'The techniques most worth learning that you have used least on your own. Every move you make is credited with the easiest technique that justifies it, and a technique you have played unaided moves down the list. Your play stays on this device.'
    )
  }
];

interface Group {
  key: string;
  title: string;
  note: string;
  techs: Tech[];
}

function TechniqueList({
  focus,
  restored,
  query,
  setQuery,
  sort,
  setSort,
  open,
  setOpen,
  onPractice,
  onExample,
  onScan,
  onTerm,
  lt
}: {
  focus?: Tech;
  /** the list was open before: keep its scroll position instead of jumping to `focus` */
  restored: boolean;
  query: string;
  setQuery: (q: string) => void;
  sort: LearnSort;
  setSort: (s: LearnSort) => void;
  open: Set<Tech>;
  setOpen: React.Dispatch<React.SetStateAction<Set<Tech>>>;
  onPractice: (tech: Tech) => void;
  onExample: (tech: Tech) => void;
  /** look for the technique in the running game; absent when no game is on */
  onScan?: (tech: Tech) => void;
  onTerm: (id: string) => void;
  lt: LearnText;
}) {
  const [examples, setExamples] = useState<Examples>(() => loadedExamples ?? {});
  useEffect(() => {
    if (loadedExamples) return;
    let live = true;
    import('../content/examples')
      .then((m) => {
        loadedExamples = m.EXAMPLES;
        if (live) setExamples(m.EXAMPLES);
      })
      // without the file the guide reads without its worked examples
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // what the player has done with each technique, for the mastery line
  // and the "learn next" order (src/state/stats.ts)
  const techs = useStats((s) => s.techs);
  const sorts = useMemo(() => sortOptions(lt), [lt]);

  const groups = useMemo((): Group[] => {
    const q = query.trim().toLowerCase();
    // a search matches the name, family, aliases and kin line in the
    // reader's language and in English
    const visible = ALL_TECHS.filter((tech) => {
      if (!q) return true;
      const info = TECHS[tech];
      const words = [
        lt.techName(tech),
        info.name,
        lt.category(info.category),
        info.category,
        ...lt.techAka(tech),
        ...lt.kin(tech),
        ...(KIN[tech] ?? [])
      ];
      return words.some((w) => w.toLowerCase().includes(q));
    });
    if (sort === 'family') {
      return techniquesByFamily(visible).map(([cat, techs]) => ({
        key: slugify(cat),
        title: lt.category(cat),
        note: lt.categoryNote(cat),
        techs
      }));
    }
    const byIndex = (a: Tech, b: Tech) => TECHS[a].index - TECHS[b].index;
    const order =
      sort === 'common'
        ? (a: Tech, b: Tech) => share(b) - share(a) || byIndex(a, b)
        : sort === 'worth'
          ? (a: Tech, b: Tech) => worth(b) - worth(a) || byIndex(a, b)
          : sort === 'next'
            ? (a: Tech, b: Tech) => learnNextScore(b, techs) - learnNextScore(a, techs) || byIndex(a, b)
            : byIndex;
    const { label, note } = sorts.find((s) => s.value === sort)!;
    return [{ key: sort, title: label, note: note ?? '', techs: [...visible].sort(order) }];
  }, [query, sort, lt, sorts, techs]);
  const matches = groups.reduce((n, g) => n + g.techs.length, 0);

  useEffect(() => {
    if (!focus || restored) return;
    document.getElementById(`learn-${focus}`)?.scrollIntoView({ block: 'start' });
  }, [focus, restored]);

  const toggle = (tech: Tech, isOpen: boolean) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(tech);
      else next.delete(tech);
      return next;
    });

  return (
    <>
      <div className="learn-toolbar">
        <input
          className="learn-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lt.s('Search {n} techniques', { n: ALL_TECHS.length })}
          aria-label={lt.s('Search techniques')}
        />
        <select
          className="learn-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as LearnSort)}
          aria-label={lt.s('Order of the list')}
          title={lt.s('Order of the list')}
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.menu}
            </option>
          ))}
        </select>
      </div>
      {!query && sort === 'family' && (
        <nav className="learn-chips" aria-label={lt.s('Technique families')}>
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => document.getElementById(`learn-cat-${g.key}`)?.scrollIntoView({ block: 'start' })}
            >
              {g.title}
            </button>
          ))}
        </nav>
      )}
      {matches === 0 && <p className="dialog-note">{lt.s('No technique matches “{q}”.', { q: query })}</p>}
      {groups.map((group) => (
        <section key={group.key} className="learn-group" id={`learn-cat-${group.key}`}>
          <h4>{group.title}</h4>
          <p className="learn-cat-note">{group.note}</p>
          {group.techs.map((tech) => {
            const info = TECHS[tech];
            const doc = lt.techDoc(tech);
            const status = techStatus(tech);
            const needed = lt.frequency(tech);
            const aka = lt.techAka(tech);
            return (
              <details
                key={tech}
                id={`learn-${tech}`}
                className={`learn-tech ${focus === tech ? 'focus' : ''}`}
                open={open.has(tech) || (!!query && matches <= 3)}
                onToggle={(e) => toggle(tech, (e.target as HTMLDetailsElement).open)}
              >
                <summary>
                  <span className="learn-name">
                    {status && <span className="learn-mark">{status.mark} </span>}
                    {lt.techName(tech)}
                  </span>
                  <span className={`level-badge level-${info.level.toLowerCase()}`}>{lt.level(info.level)}</span>
                  <span className="learn-score" title={lt.s("Added to a puzzle's rating each time the solver needs this technique")}>
                    +{info.score}
                  </span>
                  {lt.kinLine(tech) && <span className="learn-kin">{lt.kinLine(tech)}</span>}
                  <span className="learn-what">
                    <Linked text={doc.what} onTerm={onTerm} lt={lt} />
                  </span>
                  {sort !== 'family' && (
                    <span className="learn-freq">{needed ? lt.s('Needed in {freq}', { freq: needed }) : lt.s('Never needed')}</span>
                  )}
                  {techs[tech] && (
                    <span className="learn-mastery">
                      {lt.s('Your play: {n} unaided, {h} from hints', { n: techs[tech]!.unaided, h: techs[tech]!.hinted })}
                    </span>
                  )}
                </summary>
                <div className="learn-body">
                  <p>
                    <span className="learn-label">{lt.s('Why it works')}</span>
                    <Linked text={doc.why} onTerm={onTerm} lt={lt} />
                  </p>
                  <p>
                    <span className="learn-label">{lt.s('How to spot it')}</span>
                    <Linked text={doc.spot} onTerm={onTerm} lt={lt} />
                  </p>
                  {examples[tech] && (open.has(tech) || (!!query && matches <= 3)) && (
                    <WorkedExample tech={tech} example={examples[tech]!} onOpen={onExample} lt={lt} />
                  )}
                  {needed && <p className="learn-aka">{lt.s('Needed in {freq} that sudokUI generates.', { freq: needed })}</p>}
                  {aka.length > 0 && <p className="learn-aka">{lt.s('Also called {list}.', { list: aka.join(', ') })}</p>}
                  {status && <p className="learn-aka">{lt.s(status.note as LearnString)}</p>}
                  <div className="hint-actions">
                    {!status && <button onClick={() => onPractice(tech)}>{lt.s('Practice this technique')}</button>}
                    {onScan && SOLVE_ORDER.includes(tech) && (
                      <button className="ghost" onClick={() => onScan(tech)} title={lt.s('Scan the running game for this technique (counts as assistance)')}>
                        {lt.s('Is it on my board?')}
                      </button>
                    )}
                    <a className="learn-permalink" href={`${langPrefix(lt.lang)}/learn/${techSlug(tech)}/`} target="_blank" rel="noopener">
                      {lt.s('Open as a page ↗')}
                    </a>
                  </div>
                </div>
              </details>
            );
          })}
        </section>
      ))}
    </>
  );
}

function GlossaryList({
  focus,
  restored,
  onTerm,
  lt
}: {
  /** the entry to show, by id */
  focus?: string;
  /** the glossary was open before: keep its scroll position instead of jumping to `focus` */
  restored: boolean;
  onTerm: (id: string) => void;
  lt: LearnText;
}) {
  const known = useMemo(() => new Set(GLOSSARY.map((e) => e.id)), []);

  useEffect(() => {
    if (focus && !restored) {
      document.getElementById(`term-${focus}`)?.scrollIntoView({ block: 'center' });
    }
  }, [focus, restored]);

  return (
    <>
      <p className="dialog-note">{lt.s('The words sudoku solvers use, and that the hints in sudokUI use, each defined once.')}</p>
      {GLOSSARY_GROUPS.map((group) => (
        <section key={group} className="learn-group">
          <h4>{lt.loc.glossaryGroups[group] ?? group}</h4>
          <dl className="learn-glossary">
            {GLOSSARY.filter((e) => e.group === group).map((e) => {
              const g = lt.glossary(e.id);
              const see = e.see.filter((s) => known.has(s));
              // in another language, the English word too: it is what most
              // sources and the hints use
              const aka = [...g.aka, ...(lt.lang !== 'en' && e.term.toLowerCase() !== g.term.toLowerCase() ? [lt.s('In English: {term}', { term: e.term })] : [])];
              return (
                <div key={e.id} id={`term-${e.id}`} className={focus === e.id ? 'focus' : ''}>
                  <dt>
                    {g.term}
                    {aka.length > 0 && <span className="learn-aka"> · {aka.join(', ')}</span>}
                  </dt>
                  <dd>
                    <Linked text={g.definition} onTerm={onTerm} exclude={e.id} lt={lt} />
                    {see.length > 0 && (
                      <span className="learn-see">
                        {' '}
                        {lt.s('See')}{' '}
                        {see.map((s, i) => (
                          <React.Fragment key={s}>
                            {i > 0 && ', '}
                            <button className="learn-link" onClick={() => onTerm(s)}>
                              {lt.glossary(s).term}
                            </button>
                          </React.Fragment>
                        ))}
                        .
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </>
  );
}

/** how the best solvers play: the same copy as the /how-the-best-solve/ page */
function MethodGuide({ onTerm, lt }: { onTerm: (id: string) => void; lt: LearnText }) {
  const { method } = lt.loc;
  return (
    <>
      <p className="learn-lead">
        <Linked text={method.lead} onTerm={onTerm} lt={lt} />
      </p>
      {method.sections.map((s) => (
        <section key={s.heading} className="learn-group">
          <h4>{s.heading}</h4>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="learn-prose">
              <Linked text={p} onTerm={onTerm} lt={lt} />
            </p>
          ))}
        </section>
      ))}
      <p className="learn-aka">
        <a className="learn-permalink" href={`${langPrefix(lt.lang)}/how-the-best-solve/`} target="_blank" rel="noopener">
          {lt.s('Open as a page ↗')}
        </a>
      </p>
    </>
  );
}

/**
 * The few ideas under the catalogue, each explained properly and then
 * "like I'm 12": the same copy as the /learn/intuition/ page.
 */
function IntuitionGuide({ onTerm, onTech, lt }: { onTerm: (id: string) => void; onTech: (tech: Tech) => void; lt: LearnText }) {
  const diagrams = useMemo(
    () =>
      Object.fromEntries(
        DIAGRAM_IDS.map((id) => [id, `data:image/svg+xml;utf8,${encodeURIComponent(intuitionDiagram(id, lt.s))}`])
      ),
    [lt]
  );
  const { intuition } = lt.loc;
  const jump = (id: string) => document.getElementById(`intuition-${id}`)?.scrollIntoView({ block: 'start' });
  return (
    <>
      <p className="learn-lead">
        <Linked text={intuition.lead} onTerm={onTerm} lt={lt} />
      </p>
      <nav className="learn-chips" aria-label={lt.s('Ideas on this page')}>
        {INTUITION.map((part) => (
          <button key={part.id} onClick={() => jump(part.id)}>
            {intuition.parts[part.id].nav}
          </button>
        ))}
      </nav>
      {INTUITION.map((part) => (
        <section key={part.id} className="learn-group intuition-part" id={`intuition-${part.id}`}>
          <h4>{intuition.parts[part.id].heading}</h4>
          <p className="learn-cat-note">{intuition.parts[part.id].intro}</p>
          {part.sections.map((s) => {
            const t = intuition.sections[s.id];
            return (
              <section key={s.id} className="intuition-section" id={`intuition-${s.id}`}>
                <h5>{t.heading}</h5>
                {t.paragraphs.map((p, i) => (
                  <p key={i} className="learn-prose">
                    <Linked text={p} onTerm={onTerm} lt={lt} />
                  </p>
                ))}
                {t.points && (
                  <dl className="intuition-timeline">
                    {t.points.map((pt) => (
                      <div key={pt.when}>
                        <dt>{pt.when}</dt>
                        <dd>{pt.what}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {s.diagram && (
                  <figure className="intuition-figure">
                    <img src={diagrams[s.diagram.id]} alt={t.caption} />
                    <figcaption>{t.caption}</figcaption>
                  </figure>
                )}
                {t.eli12 && (
                  <aside className="intuition-eli12">
                    <span className="learn-label">{lt.s("Explain it like I'm 12")}</span>
                    <p>{t.eli12}</p>
                  </aside>
                )}
                {s.techs && (
                  <p className="intuition-techs">
                    <span className="learn-label">{lt.s('In the catalogue')}</span>
                    {s.techs.map((tech, i) => (
                      <React.Fragment key={tech}>
                        {i > 0 && ' · '}
                        <button className="learn-link" onClick={() => onTech(tech)}>
                          {lt.techName(tech)}
                        </button>
                      </React.Fragment>
                    ))}
                  </p>
                )}
              </section>
            );
          })}
        </section>
      ))}
      <p className="learn-aka">
        <a className="learn-permalink" href={`${langPrefix(lt.lang)}${INTUITION_URL}`} target="_blank" rel="noopener">
          {lt.s('Open as a page ↗')}
        </a>
      </p>
    </>
  );
}

const TAB_LABELS: Record<LearnTab, string> = {
  techniques: msg('Techniques'),
  intuition: msg('Intuition'),
  method: msg('How to solve'),
  glossary: msg('Glossary'),
  rating: msg('Rating')
};

export function LearnDialog({
  target,
  onClose,
  onPractice,
  hub,
  onExample,
  onScan
}: {
  target: LearnTarget;
  onClose: () => void;
  onPractice: (tech: Tech) => void;
  /** the other parts of Learn, the practice list and your path */
  hub?: { onPractice: () => void; onPath: () => void };
  /** put a technique's worked example on the board */
  onExample: (tech: Tech) => void;
  /** scan the running game for a technique; absent when no game is on */
  onScan?: (tech: Tech) => void;
}) {
  const t = useT();
  const lt = useLearnText();
  const [tab, setTab] = useState<LearnTab>(target.tab);
  const [term, setTerm] = useState(() => glossaryId(target.term));
  const [focusTech, setFocusTech] = useState(target.tech);
  // the tab a glossary term or a technique was looked up from, for the way back
  const [from, setFrom] = useState<LearnTab | null>(null);

  // what the technique list looks like survives a trip to the glossary:
  // the search, the sort order, which techniques are unfolded...
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LearnSort>('family');
  const [open, setOpen] = useState<Set<Tech>>(() => new Set(target.tech ? [target.tech] : []));
  // ...and how far down each tab was scrolled (the dialog is the scroller)
  const body = useRef<HTMLDivElement>(null);
  const scrolls = useRef<Partial<Record<LearnTab, number>>>({});
  const scroller = () => body.current?.closest('.modal') as HTMLElement | null;
  const leave = () => {
    scrolls.current[tab] = scroller()?.scrollTop ?? 0;
  };
  const switchTab = (next: LearnTab) => {
    if (next === tab) return;
    leave();
    setFrom(null);
    setTab(next);
  };
  // a technique named in the Intuition guide opens unfolded in the list
  const openTech = (tech: Tech) => {
    leave();
    delete scrolls.current.techniques;
    setFrom(tab);
    setQuery('');
    setOpen((prev) => new Set(prev).add(tech));
    setFocusTech(tech);
    setTab('techniques');
  };
  // a glossary term clicked anywhere lands on its definition
  const openTerm = (id: string) => {
    leave();
    delete scrolls.current.glossary;
    if (tab !== 'glossary') setFrom(tab);
    setTerm(id);
    setTab('glossary');
  };
  useLayoutEffect(() => {
    const saved = scrolls.current[tab];
    const el = scroller();
    if (saved !== undefined && el) el.scrollTop = saved;
  }, [tab]);

  const tabs = Object.keys(TAB_LABELS) as LearnTab[];
  return (
    <Modal title={t('Learn')} onClose={onClose} wide>
      <div ref={body} lang={lt.lang}>
        {hub && <HubTabs active="theory" onPractice={hub.onPractice} onPath={hub.onPath} />}
        <div className="segmented learn-tabs" role="tablist">
          {tabs.map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? 'active' : ''}
              onClick={() => switchTab(value)}
            >
              {t(TAB_LABELS[value])}
            </button>
          ))}
        </div>
        {from && from !== tab && (
          <button className="learn-link learn-back" onClick={() => switchTab(from)}>
            ← {t(TAB_LABELS[from])}
          </button>
        )}
        {tab === 'techniques' && (
          <TechniqueList
            focus={focusTech}
            restored={scrolls.current.techniques !== undefined}
            query={query}
            setQuery={setQuery}
            sort={sort}
            setSort={setSort}
            open={open}
            setOpen={setOpen}
            onPractice={onPractice}
            onExample={onExample}
            onScan={onScan}
            onTerm={openTerm}
            lt={lt}
          />
        )}
        {tab === 'glossary' && (
          <GlossaryList focus={term} restored={scrolls.current.glossary !== undefined} onTerm={openTerm} lt={lt} />
        )}
        {tab === 'intuition' && <IntuitionGuide onTerm={openTerm} onTech={openTech} lt={lt} />}
        {tab === 'method' && <MethodGuide onTerm={openTerm} lt={lt} />}
        {tab === 'rating' && <RatingExplainer />}
      </div>
    </Modal>
  );
}
