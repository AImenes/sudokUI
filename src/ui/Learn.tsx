// The Learn dialog: every technique explained (what it is, why it works,
// how to spot it), the glossary of sudoku language, and how the rating
// works. The same content feeds the static /learn/ pages.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './Dialogs';
import { TECHS, ALL_TECHS, SOLVE_ORDER, LEVELS, LEVEL_MAX_SCORE, Tech, Category } from '../engine/ratings';
import { CATEGORY_NOTES, categoryLabel, techStatus } from '../content/categories';
import { TECH_DOCS } from '../content/techniqueDocs';
import { GLOSSARY, GLOSSARY_GROUPS } from '../content/glossary';
import { RATING_SUMMARY, RATING_POINTS, BAND_NOTES } from '../content/rating';
import { techSlug, slugify } from '../content/slugs';
import { linkGlossary } from '../content/glossaryLinks';
import { boardSvg, legendOf, Example } from '../content/boardSvg';
import { frequencyLabel, share, worth } from '../content/frequency';
import { LANDING_PAGES } from '../content/landing';

type Examples = Partial<Record<Tech, Example>>;

// the examples are a sizeable file: fetched when the guide is first opened,
// never as part of loading the game, and kept for the next opening
let loadedExamples: Examples | undefined;

/**
 * A real position where the technique applies, drawn by the same renderer
 * as the static pages. The drawing goes through an image so that its
 * styles cannot leak into the live board, which is SVG too.
 */
function WorkedExample({
  tech,
  example,
  onOpen
}: {
  tech: Tech;
  example: Example;
  onOpen: (tech: Tech) => void;
}) {
  const title = `${TECHS[tech].name} example on a sudoku board`;
  const src = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(boardSvg(example, title))}`,
    [example, title]
  );
  return (
    <figure className="learn-example">
      <span className="learn-label">Worked example</span>
      <img src={src} alt={`${title}. ${example.step.description}`} />
      <figcaption>
        <span className="learn-legend">
          {legendOf(example.step).map((l) => (
            <span key={l.label}>
              <i style={{ background: l.colour }} />
              {l.label}
            </span>
          ))}
        </span>
        {example.step.description}
        {example.credit && <span className="learn-see"> Puzzle: {example.credit}.</span>}
        {example.afterHarder && (
          <span className="learn-see"> In this puzzle the position comes after harder steps.</span>
        )}
      </figcaption>
      <button className="learn-link" onClick={() => onOpen(tech)}>
        Open this position on the board
      </button>
    </figure>
  );
}

export type LearnTab = 'techniques' | 'method' | 'glossary' | 'rating';

/** running text whose glossary terms open their definition */
function Linked({
  text,
  onTerm,
  exclude
}: {
  text: string;
  onTerm: (term: string) => void;
  exclude?: string;
}) {
  return (
    <>
      {linkGlossary(text, exclude).map((seg, i) =>
        seg.term ? (
          <button
            key={i}
            className="learn-link term"
            title={`Glossary: ${seg.term}`}
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
  term?: string;
}

/** the eight difficulty bands with their score ceilings */
export function BandTable() {
  return (
    <table className="shortcut-table band-table">
      <tbody>
        {LEVELS.map((level, i) => (
          <tr key={level}>
            <td>
              <span className={`level-badge level-${level.toLowerCase()}`}>{level}</span>
            </td>
            <td>
              {i === LEVELS.length - 1
                ? `above ${LEVEL_MAX_SCORE[LEVELS[i - 1]]}`
                : `up to ${LEVEL_MAX_SCORE[level]}`}
              : {BAND_NOTES[level]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RatingExplainer() {
  return (
    <>
      <p className="learn-lead">{RATING_SUMMARY}</p>
      <dl className="learn-points">
        {RATING_POINTS.map((p) => (
          <React.Fragment key={p.title}>
            <dt>{p.title}</dt>
            <dd>{p.text}</dd>
          </React.Fragment>
        ))}
      </dl>
      <BandTable />
    </>
  );
}

/** the orders the technique list can be read in */
export type LearnSort = 'family' | 'easiest' | 'common' | 'worth';

const SORTS: { value: LearnSort; label: string; note: string }[] = [
  { value: 'family', label: 'By family', note: '' },
  {
    value: 'easiest',
    label: 'Easiest first',
    note: 'In the order the solver tries them: a technique is only needed once everything above it has run dry.'
  },
  {
    value: 'common',
    label: 'Most often needed',
    note: 'The techniques that turn up in the most puzzles sudokUI generates, whatever their difficulty.'
  },
  {
    value: 'worth',
    label: 'Most worth learning',
    note: 'How often a technique is needed, weighted by its rating cost. Difficulty and frequency are different things: a hard technique that turns up often repays the effort of learning it, and those come first.'
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
  onTerm
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
  onTerm: (term: string) => void;
}) {
  const [examples, setExamples] = useState<Examples>(() => loadedExamples ?? {});
  useEffect(() => {
    if (loadedExamples) return;
    let live = true;
    import('../content/examples').then((m) => {
      loadedExamples = m.EXAMPLES;
      if (live) setExamples(m.EXAMPLES);
    });
    return () => {
      live = false;
    };
  }, []);

  const groups = useMemo((): Group[] => {
    const q = query.trim().toLowerCase();
    const visible = ALL_TECHS.filter((tech) => {
      const info = TECHS[tech];
      const doc = TECH_DOCS[tech];
      return (
        !q ||
        info.name.toLowerCase().includes(q) ||
        info.category.toLowerCase().includes(q) ||
        doc.aka.some((a) => a.toLowerCase().includes(q))
      );
    });
    if (sort === 'family') {
      const by = new Map<Category, Tech[]>();
      for (const tech of visible) {
        const cat = TECHS[tech].category;
        if (!by.has(cat)) by.set(cat, []);
        by.get(cat)!.push(tech);
      }
      return [...by.entries()].map(([cat, techs]) => ({
        key: slugify(cat),
        title: categoryLabel(cat),
        note: CATEGORY_NOTES[cat],
        techs
      }));
    }
    const byIndex = (a: Tech, b: Tech) => TECHS[a].index - TECHS[b].index;
    const order =
      sort === 'common'
        ? (a: Tech, b: Tech) => share(b) - share(a) || byIndex(a, b)
        : sort === 'worth'
          ? (a: Tech, b: Tech) => worth(b) - worth(a) || byIndex(a, b)
          : byIndex;
    const { label, note } = SORTS.find((s) => s.value === sort)!;
    return [{ key: sort, title: label, note, techs: [...visible].sort(order) }];
  }, [query, sort]);
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
      <input
        className="learn-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${ALL_TECHS.length} techniques`}
        aria-label="Search techniques"
      />
      <div className="learn-tools">
        <label>
          Sort{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as LearnSort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!query && sort === 'family' && (
        <nav className="learn-chips" aria-label="Technique families">
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
      {matches === 0 && <p className="dialog-note">No technique matches “{query}”.</p>}
      {groups.map((group) => (
        <section key={group.key} className="learn-group" id={`learn-cat-${group.key}`}>
          <h4>{group.title}</h4>
          <p className="learn-cat-note">{group.note}</p>
          {group.techs.map((tech) => {
            const info = TECHS[tech];
            const doc = TECH_DOCS[tech];
            const status = techStatus(tech);
            const needed = frequencyLabel(tech);
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
                    {info.name}
                  </span>
                  <span className={`level-badge level-${info.level.toLowerCase()}`}>{info.level}</span>
                  <span className="learn-score" title="Added to a puzzle's rating each time the solver needs this technique">
                    cost {info.score}
                  </span>
                  <span className="learn-what">
                    <Linked text={doc.what} onTerm={onTerm} />
                  </span>
                  {sort !== 'family' && (
                    <span className="learn-freq">{needed ? `Needed in ${needed}` : 'Never needed'}</span>
                  )}
                </summary>
                <div className="learn-body">
                  <p>
                    <span className="learn-label">Why it works</span>
                    <Linked text={doc.why} onTerm={onTerm} />
                  </p>
                  <p>
                    <span className="learn-label">How to spot it</span>
                    <Linked text={doc.spot} onTerm={onTerm} />
                  </p>
                  {examples[tech] && (open.has(tech) || (!!query && matches <= 3)) && (
                    <WorkedExample tech={tech} example={examples[tech]!} onOpen={onExample} />
                  )}
                  {needed && <p className="learn-aka">Needed in {needed} that sudokUI generates.</p>}
                  {doc.aka.length > 0 && (
                    <p className="learn-aka">Also called {doc.aka.join(', ')}.</p>
                  )}
                  {status && <p className="learn-aka">{status.note}</p>}
                  <div className="hint-actions">
                    {!status && <button onClick={() => onPractice(tech)}>Practice this technique</button>}
                    {onScan && SOLVE_ORDER.includes(tech) && (
                      <button className="ghost" onClick={() => onScan(tech)} title="Scan the running game for this technique (counts as assistance)">
                        Is it on my board?
                      </button>
                    )}
                    <a className="learn-permalink" href={`/learn/${techSlug(tech)}/`} target="_blank" rel="noopener">
                      Open as a page ↗
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
  onTerm
}: {
  focus?: string;
  /** the glossary was open before: keep its scroll position instead of jumping to `focus` */
  restored: boolean;
  onTerm: (term: string) => void;
}) {
  const known = useMemo(() => new Set(GLOSSARY.map((e) => e.term)), []);
  const jump = onTerm;

  useEffect(() => {
    if (focus && !restored) {
      document.getElementById(`term-${slugify(focus)}`)?.scrollIntoView({ block: 'center' });
    }
  }, [focus, restored]);

  return (
    <>
      <p className="dialog-note">
        The words sudoku solvers use, and that the hints in sudokUI use, each
        defined once.
      </p>
      {GLOSSARY_GROUPS.map((group) => (
        <section key={group} className="learn-group">
          <h4>{group}</h4>
          <dl className="learn-glossary">
            {GLOSSARY.filter((e) => e.group === group).map((e) => (
              <div
                key={e.term}
                id={`term-${slugify(e.term)}`}
                className={focus && slugify(focus) === slugify(e.term) ? 'focus' : ''}
              >
                <dt>
                  {e.term}
                  {e.aka.length > 0 && <span className="learn-aka"> · {e.aka.join(', ')}</span>}
                </dt>
                <dd>
                  <Linked text={e.definition} onTerm={onTerm} exclude={e.term} />
                  {e.see.filter((s) => known.has(s)).length > 0 && (
                    <span className="learn-see">
                      {' '}
                      See{' '}
                      {e.see
                        .filter((s) => known.has(s))
                        .map((s, i) => (
                          <React.Fragment key={s}>
                            {i > 0 && ', '}
                            <button className="learn-link" onClick={() => jump(s)}>
                              {s}
                            </button>
                          </React.Fragment>
                        ))}
                      .
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}

/** how the best solvers play: the same copy as the /how-the-best-solve/ page */
const METHOD = LANDING_PAGES.find((p) => p.url === '/how-the-best-solve/')!;

function MethodGuide({ onTerm }: { onTerm: (term: string) => void }) {
  return (
    <>
      <p className="learn-lead">
        <Linked text={METHOD.lead} onTerm={onTerm} />
      </p>
      {METHOD.sections.map((s) => (
        <section key={s.heading} className="learn-group">
          <h4>{s.heading}</h4>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="learn-prose">
              <Linked text={p} onTerm={onTerm} />
            </p>
          ))}
        </section>
      ))}
      <p className="learn-aka">
        <a className="learn-permalink" href={METHOD.url} target="_blank" rel="noopener">
          Open as a page ↗
        </a>
      </p>
    </>
  );
}

const TAB_LABELS: Record<LearnTab, string> = {
  techniques: 'Techniques',
  method: 'How to solve',
  glossary: 'Glossary',
  rating: 'Rating'
};

export function LearnDialog({
  target,
  onClose,
  onPractice,
  onExample,
  onScan
}: {
  target: LearnTarget;
  onClose: () => void;
  onPractice: (tech: Tech) => void;
  /** put a technique's worked example on the board */
  onExample: (tech: Tech) => void;
  /** scan the running game for a technique; absent when no game is on */
  onScan?: (tech: Tech) => void;
}) {
  const [tab, setTab] = useState<LearnTab>(target.tab);
  const [term, setTerm] = useState(target.term);
  // the tab a glossary term was looked up from, for the way back
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
    setTab(next);
  };
  // a glossary term clicked anywhere lands on its definition
  const openTerm = (t: string) => {
    leave();
    delete scrolls.current.glossary;
    if (tab !== 'glossary') setFrom(tab);
    setTerm(t);
    setTab('glossary');
  };
  useLayoutEffect(() => {
    const saved = scrolls.current[tab];
    const el = scroller();
    if (saved !== undefined && el) el.scrollTop = saved;
  }, [tab]);

  const tabs = Object.keys(TAB_LABELS) as LearnTab[];
  return (
    <Modal title="Learn" onClose={onClose} wide>
      <div ref={body}>
        <div className="segmented learn-tabs" role="tablist">
          {tabs.map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? 'active' : ''}
              onClick={() => switchTab(value)}
            >
              {TAB_LABELS[value]}
            </button>
          ))}
        </div>
        {tab === 'techniques' && (
          <TechniqueList
            focus={target.tech}
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
          />
        )}
        {tab === 'glossary' && (
          <>
            {from && (
              <button className="learn-link learn-back" onClick={() => switchTab(from)}>
                ← Back to {TAB_LABELS[from].toLowerCase()}
              </button>
            )}
            <GlossaryList focus={term} restored={scrolls.current.glossary !== undefined} onTerm={openTerm} />
          </>
        )}
        {tab === 'method' && <MethodGuide onTerm={openTerm} />}
        {tab === 'rating' && <RatingExplainer />}
      </div>
    </Modal>
  );
}
