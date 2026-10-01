// The Learn section in one language. English is assembled from the content
// modules themselves, which stay the source of truth; a locale
// (locales/nb.ts, locales/es.ts) translates every piece of it, keyed the
// same way: techniques by key, glossary entries and Intuition sections by
// id, strings by their English text. The in-app Learn dialog loads a
// locale only when that language is chosen; the static pages build all
// three.
//
// Technique names stay English except where a language has its own,
// established name (docs/glossary_input.md, section 4): Naken singel,
// Único desnudo. The English name is then listed among its aliases, so a
// reader can find it in English sources.
import { TECHS, LEVELS, Tech, Category, Level } from '../engine/ratings';
import type { Lang } from '../state/settings';
import { TECH_DOCS } from './techniqueDocs';
import { KIN } from './kin';
import { CATEGORY_NOTES, categoryLabel } from './categories';
import { BAND_LEADS, BAND_NOTES, RATING_POINTS, RATING_SUMMARY } from './rating';
import { SOLVE_TIME_NOTE, MODE_LABEL } from './solveTimes';
import type { SolveMode } from './solveTimes';
import { GLOSSARY, GLOSSARY_GROUPS, GlossaryGroup, GlossaryText } from './glossary';
import { INTUITION, INTUITION_LEAD } from './intuition';
import { LANDING_PAGES } from './landing';
import { LEARN_STRINGS, LearnString, fill } from './learnStrings';
import { FREQUENCY, frequencyParts } from './frequency';

export interface TechDocText {
  what: string;
  why: string;
  spot: string;
}

export interface IntuitionSectionText {
  heading: string;
  paragraphs: string[];
  eli12?: string;
  caption?: string;
  points?: { when: string; what: string }[];
}

export interface MethodText {
  name: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export interface LearnLocale {
  /** names the language has its own word for; the rest stay English */
  techNames: Partial<Record<Tech, string>>;
  techDocs: Record<Tech, TechDocText>;
  /** this language's own aliases, listed before the English ones */
  techAka: Partial<Record<Tech, string[]>>;
  kin: Partial<Record<Tech, string[]>>;
  categories: Record<Category, { label: string; note: string }>;
  levels: Record<Level, string>;
  bandLeads: Record<Level, string>;
  bandNotes: Record<Level, string>;
  rating: {
    summary: string;
    points: { title: string; text: string }[];
    solveTimeNote: string;
    modes: Record<SolveMode, string>;
  };
  method: MethodText;
  glossaryGroups: Record<GlossaryGroup, string>;
  glossary: Record<string, GlossaryText>;
  intuition: {
    lead: string;
    parts: Record<string, { nav: string; heading: string; intro: string }>;
    sections: Record<string, IntuitionSectionText>;
  };
  strings: Record<LearnString, string>;
}

const METHOD = LANDING_PAGES.find((p) => p.url === '/how-the-best-solve/')!;

/** English, gathered from the content modules */
export const EN: LearnLocale = {
  techNames: {},
  techDocs: Object.fromEntries(
    (Object.keys(TECH_DOCS) as Tech[]).map((t) => [t, { what: TECH_DOCS[t].what, why: TECH_DOCS[t].why, spot: TECH_DOCS[t].spot }])
  ) as Record<Tech, TechDocText>,
  techAka: Object.fromEntries((Object.keys(TECH_DOCS) as Tech[]).map((t) => [t, TECH_DOCS[t].aka])),
  kin: KIN,
  categories: Object.fromEntries(
    (Object.keys(CATEGORY_NOTES) as Category[]).map((c) => [c, { label: categoryLabel(c), note: CATEGORY_NOTES[c] }])
  ) as Record<Category, { label: string; note: string }>,
  levels: Object.fromEntries(LEVELS.map((l) => [l, l])) as Record<Level, string>,
  bandLeads: BAND_LEADS,
  bandNotes: BAND_NOTES,
  rating: { summary: RATING_SUMMARY, points: RATING_POINTS, solveTimeNote: SOLVE_TIME_NOTE, modes: MODE_LABEL },
  method: {
    name: METHOD.name,
    title: METHOD.title,
    description: METHOD.description,
    h1: METHOD.h1,
    lead: METHOD.lead,
    sections: METHOD.sections
  },
  glossaryGroups: Object.fromEntries(GLOSSARY_GROUPS.map((g) => [g, g])) as Record<GlossaryGroup, string>,
  glossary: Object.fromEntries(GLOSSARY.map((e) => [e.id, { term: e.term, aka: e.aka, definition: e.definition }])),
  intuition: {
    lead: INTUITION_LEAD,
    parts: Object.fromEntries(INTUITION.map((p) => [p.id, { nav: p.nav, heading: p.heading, intro: p.intro }])),
    sections: Object.fromEntries(
      INTUITION.flatMap((p) => p.sections).map((s) => [
        s.id,
        {
          heading: s.heading,
          paragraphs: s.paragraphs,
          ...(s.eli12 ? { eli12: s.eli12 } : {}),
          ...(s.diagram ? { caption: s.diagram.caption } : {}),
          ...(s.points ? { points: s.points } : {})
        }
      ])
    )
  },
  strings: Object.fromEntries(LEARN_STRINGS.map((k) => [k, k])) as Record<LearnString, string>
};

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

/** everything the Learn section says, in one language */
export interface LearnText {
  lang: Lang;
  loc: LearnLocale;
  s(key: LearnString, vars?: Record<string, string | number>): string;
  num(n: number): string;
  techName(t: Tech): string;
  techDoc(t: Tech): TechDocText;
  /** other names: this language's, the English name when it differs, then the English aliases */
  techAka(t: Tech): string[];
  kin(t: Tech): string[];
  kinLine(t: Tech): string;
  category(c: Category): string;
  categoryNote(c: Category): string;
  level(l: Level): string;
  glossary(id: string): GlossaryText;
  /** "34% of puzzles" and the like, or null when the solver never needs it */
  frequency(t: Tech): string | null;
}

export function learnText(lang: Lang, loc: LearnLocale = EN): LearnText {
  const L = lang === 'en' ? EN : loc;
  const s = (key: LearnString, vars?: Record<string, string | number>) => fill(L.strings[key] ?? key, vars);
  const num = (n: number) => n.toLocaleString(lang === 'nb' ? 'nb-NO' : lang === 'es' ? 'es-ES' : 'en');
  const text: LearnText = {
    lang,
    loc: L,
    s,
    num,
    techName: (t) => L.techNames[t] ?? TECHS[t].name,
    techDoc: (t) => L.techDocs[t] ?? EN.techDocs[t],
    techAka: (t) =>
      lang === 'en'
        ? TECH_DOCS[t].aka
        : unique([
            ...(L.techAka[t] ?? []),
            L.techNames[t] && L.techNames[t] !== TECHS[t].name ? TECHS[t].name : '',
            ...TECH_DOCS[t].aka
          ]),
    kin: (t) => L.kin[t] ?? EN.kin[t] ?? [],
    kinLine: (t) => text.kin(t).join(' · '),
    category: (c) => L.categories[c]?.label ?? categoryLabel(c),
    categoryNote: (c) => L.categories[c]?.note ?? CATEGORY_NOTES[c],
    level: (l) => L.levels[l] ?? l,
    glossary: (id) => L.glossary[id] ?? EN.glossary[id],
    frequency: (t) => {
      const p = frequencyParts(t);
      if (!p) return null;
      if (p.kind === 'fewer') return s('fewer than 1 in {n} puzzles', { n: num(p.n) });
      if (p.kind === 'every') return s('every puzzle');
      if (p.kind === 'share') return s('{p}% of puzzles', { p: p.percent });
      return s('1 in {n} puzzles', { n: num(p.n) });
    }
  };
  return text;
}

/** URL prefix of a language's static pages: '' for English, '/nb' and '/es' */
export const langPrefix = (lang: Lang) => (lang === 'en' ? '' : `/${lang}`);
