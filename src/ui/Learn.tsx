// The Learn dialog: every technique explained (what it is, why it works,
// how to spot it), the glossary of sudoku language, and how the rating
// works. The same content feeds the static /learn/ pages.
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Dialogs';
import { TECHS, ALL_TECHS, LEVELS, LEVEL_MAX_SCORE, Tech, Category } from '../engine/ratings';
import { CATEGORY_NOTES, categoryLabel, techStatus } from '../content/categories';
import { TECH_DOCS } from '../content/techniqueDocs';
import { GLOSSARY, GLOSSARY_GROUPS } from '../content/glossary';
import { RATING_SUMMARY, RATING_POINTS, BAND_NOTES } from '../content/rating';
import { techSlug, slugify } from '../content/slugs';
import { linkGlossary } from '../content/glossaryLinks';
import { boardSvg, legendOf, Example } from '../content/boardSvg';
import { frequencyLabel } from '../content/frequency';

type Examples = Partial<Record<Tech, Example>>;

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
      </figcaption>
      <button className="learn-link" onClick={() => onOpen(tech)}>
        Open this position on the board
      </button>
    </figure>
  );
}

export type LearnTab = 'techniques' | 'glossary' | 'rating';

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
            onClick={() => onTerm(seg.term!)}
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

function TechniqueList({
  focus,
  onPractice,
  onExample,
  onTerm
}: {
  focus?: Tech;
  onPractice: (tech: Tech) => void;
  onExample: (tech: Tech) => void;
  onTerm: (term: string) => void;
}) {
  const [query, setQuery] = useState('');
  // the examples are a sizeable file: fetched when the guide is opened,
  // never as part of loading the game
  const [examples, setExamples] = useState<Examples>({});
  useEffect(() => {
    let live = true;
    import('../content/examples').then((m) => live && setExamples(m.EXAMPLES));
    return () => {
      live = false;
    };
  }, []);
  const [open, setOpen] = useState<Set<Tech>>(() => new Set(focus ? [focus] : []));

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const by = new Map<Category, Tech[]>();
    for (const tech of ALL_TECHS) {
      const info = TECHS[tech];
      const doc = TECH_DOCS[tech];
      if (
        q &&
        !info.name.toLowerCase().includes(q) &&
        !info.category.toLowerCase().includes(q) &&
        !doc.aka.some((a) => a.toLowerCase().includes(q))
      ) {
        continue;
      }
      if (!by.has(info.category)) by.set(info.category, []);
      by.get(info.category)!.push(tech);
    }
    return [...by.entries()];
  }, [query]);
  const matches = groups.reduce((n, [, techs]) => n + techs.length, 0);

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`learn-${focus}`)?.scrollIntoView({ block: 'start' });
  }, [focus]);

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
      {!query && (
        <nav className="learn-chips" aria-label="Technique families">
          {groups.map(([cat]) => (
            <button
              key={cat}
              onClick={() =>
                document.getElementById(`learn-cat-${slugify(cat)}`)?.scrollIntoView({ block: 'start' })
              }
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </nav>
      )}
      {matches === 0 && <p className="dialog-note">No technique matches “{query}”.</p>}
      {groups.map(([cat, techs]) => (
        <section key={cat} className="learn-group" id={`learn-cat-${slugify(cat)}`}>
          <h4>{categoryLabel(cat)}</h4>
          <p className="learn-cat-note">{CATEGORY_NOTES[cat]}</p>
          {techs.map((tech) => {
            const info = TECHS[tech];
            const doc = TECH_DOCS[tech];
            const status = techStatus(tech);
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
                  <span className="learn-what">{doc.what}</span>
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
                  {frequencyLabel(tech) && (
                    <p className="learn-aka">
                      Needed in {frequencyLabel(tech)} that sudokUI generates.
                    </p>
                  )}
                  {doc.aka.length > 0 && (
                    <p className="learn-aka">Also called {doc.aka.join(', ')}.</p>
                  )}
                  {status && <p className="learn-aka">{status.note}</p>}
                  <div className="hint-actions">
                    {!status && <button onClick={() => onPractice(tech)}>Practice this technique</button>}
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

function GlossaryList({ focus, onTerm }: { focus?: string; onTerm: (term: string) => void }) {
  const known = useMemo(() => new Set(GLOSSARY.map((e) => e.term)), []);
  const jump = onTerm;

  useEffect(() => {
    if (focus) {
      document.getElementById(`term-${slugify(focus)}`)?.scrollIntoView({ block: 'center' });
    }
  }, [focus]);

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

export function LearnDialog({
  target,
  onClose,
  onPractice,
  onExample
}: {
  target: LearnTarget;
  onClose: () => void;
  onPractice: (tech: Tech) => void;
  /** put a technique's worked example on the board */
  onExample: (tech: Tech) => void;
}) {
  const [tab, setTab] = useState<LearnTab>(target.tab);
  const [term, setTerm] = useState(target.term);
  // a glossary term clicked anywhere lands on its definition
  const openTerm = (t: string) => {
    setTerm(t);
    setTab('glossary');
  };
  const tabs: [LearnTab, string][] = [
    ['techniques', 'Techniques'],
    ['glossary', 'Glossary'],
    ['rating', 'Rating']
  ];
  return (
    <Modal title="Learn" onClose={onClose} wide>
      <div className="segmented learn-tabs" role="tablist">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'active' : ''}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'techniques' && (
        <TechniqueList
          focus={target.tech}
          onPractice={onPractice}
          onExample={onExample}
          onTerm={openTerm}
        />
      )}
      {tab === 'glossary' && <GlossaryList focus={term} onTerm={openTerm} />}
      {tab === 'rating' && <RatingExplainer />}
    </Modal>
  );
}
