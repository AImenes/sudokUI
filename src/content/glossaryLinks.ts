// Finds glossary terms inside running text, so explanations can link the
// jargon they use to its definition. Shared by the in-app Learn dialog
// (buttons) and the static /learn/ pages (anchors), in every language.
import { GLOSSARY, GlossaryText } from './glossary';
import type { Lang } from '../state/settings';

export interface Segment {
  text: string;
  /** set when this stretch of text is a glossary term: the entry's id */
  term?: string;
}

// Every glossary term links, but each at most once per text, so a sentence
// about cells and candidates carries one link for each, not a wall of them.
// Bare parts of technique names (the 'wing' in XY-Wing, the 'Swordfish' in
// Finned Swordfish) and words too plain to be worth a link stay plain.
const UNLINKED = new Set(['chain', 'node', 'wing', 'fish', 'x-wing', 'swordfish', 'jellyfish', 'digit', 'technique', 'solution', 'link']);

// headwords that are also everyday words in a language, and would link
// wherever that word appears: Norwegian "ser" (sees, also "looks"), "steg"
// (Steps, also any step), "sjekk" (Check, also "check whether"), "finne"
// (fin, also "to find"); Spanish "único" (single, also "only"), "pasos"
// (Steps, also any steps), "revisar" (Check, also "to check")
const UNLINKED_IN: Partial<Record<Lang, Set<string>>> = {
  nb: new Set(['sees', 'steps', 'check', 'fin']),
  es: new Set(['single', 'steps', 'check'])
};

// the endings a term may carry in running text: plurals in English and
// Spanish; plurals and the definite forms in Norwegian (rute, ruten, ruter,
// rutene; par, paret; mengde, mengden)
const SUFFIX: Record<Lang, string> = {
  en: '(?:s|es)?',
  es: '(?:s|es)?',
  nb: '(?:ene|ne|en|et|er|n|r|e|a|s)?'
};

interface Label {
  id: string;
  pattern: RegExp;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function labelsOf(term: string, aka: string[]): string[] {
  const out = new Set<string>();
  const add = (raw: string, isAlias: boolean) => {
    const label = raw.trim();
    // an alias that is a single everyday word ("group", "link", "note")
    // would match all over ordinary prose: only abbreviations and
    // multi-word aliases are distinctive enough to link
    if (isAlias && !/[\s-]/.test(label) && label !== label.toUpperCase()) return;
    if (label.length >= 3) out.add(label);
  };
  for (const raw of [term, ...aka]) {
    // "almost locked set (ALS)" also answers to "almost locked set" and "ALS"
    const paren = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (paren) {
      add(paren[1], raw !== term);
      add(paren[2], true);
    } else {
      add(raw, raw !== term);
    }
  }
  return [...out];
}

const cache = new Map<string, Label[]>();

function labelsFor(lang: Lang, texts?: Record<string, GlossaryText>): Label[] {
  // the texts of a language never change once loaded, so the language plus
  // whether a translation is present identifies them
  const key = `${lang}:${texts && lang !== 'en' ? 'own' : 'en'}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const labels = GLOSSARY.filter((e) => !UNLINKED.has(e.id) && !UNLINKED_IN[lang]?.has(e.id)).flatMap((e) => {
    const t = (lang !== 'en' && texts?.[e.id]) || e;
    return labelsOf(t.term, t.aka).map((label) => ({
      id: e.id,
      // abbreviations (ALS, AIC, BUG) only match in capitals. Word
      // boundaries are checked by hand below: regex lookbehind would throw
      // at load time on older Safari.
      pattern: new RegExp(`${escapeRe(label)}${SUFFIX[lang]}`, label === label.toUpperCase() ? 'gu' : 'giu')
    }));
  });
  cache.set(key, labels);
  return labels;
}

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}-]/u.test(ch);

/**
 * Split `text` into plain and glossary-term segments. Each term is linked at
 * most once per text, longer matches win over shorter ones they contain,
 * and `exclude` (an entry id) keeps a definition from linking to itself.
 * `texts` are the glossary entries in `lang`.
 */
export function linkGlossary(text: string, exclude?: string, lang: Lang = 'en', texts?: Record<string, GlossaryText>): Segment[] {
  const found: { start: number; end: number; id: string }[] = [];
  for (const { id, pattern } of labelsFor(lang, texts)) {
    if (id === exclude) continue;
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text))) {
      const end = m.index + m[0].length;
      if (isWordChar(text[m.index - 1]) || isWordChar(text[end])) continue;
      found.push({ start: m.index, end, id });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: Segment[] = [];
  const used = new Set<string>();
  let pos = 0;
  for (const f of found) {
    if (f.start < pos || used.has(f.id)) continue;
    if (f.start > pos) segments.push({ text: text.slice(pos, f.start) });
    segments.push({ text: text.slice(f.start, f.end), term: f.id });
    used.add(f.id);
    pos = f.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) });
  return segments;
}
