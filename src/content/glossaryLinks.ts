// Finds glossary terms inside running text, so explanations can link the
// jargon they use to its definition. Shared by the in-app Learn dialog
// (buttons) and the static /learn/ pages (anchors).
import { GLOSSARY } from './glossary';

export interface Segment {
  text: string;
  /** set when this stretch of text is a glossary term: the entry's headword */
  term?: string;
}

// Everyday words (cell, row, candidate) would turn every sentence into a
// wall of links, so only the vocabulary of actual solving logic is linked.
const LINKED_GROUPS = new Set(['Basic logic', 'Links and chains', 'Patterns', 'Uniqueness']);
const UNLINKED = new Set([
  'candidate',
  'single',
  'naked',
  'hidden',
  'subset',
  'placement',
  'elimination',
  'chain',
  'node',
  'wing',
  'fish',
  'x-wing'
]);

interface Label {
  term: string;
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

const LABELS: Label[] = GLOSSARY.filter(
  (e) => LINKED_GROUPS.has(e.group) && !UNLINKED.has(e.term.toLowerCase())
).flatMap((e) =>
  labelsOf(e.term, e.aka)
    .filter((l) => !UNLINKED.has(l.toLowerCase()))
    .map((label) => ({
      term: e.term,
      // abbreviations (ALS, AIC, BUG) only match in capitals. Word
      // boundaries are checked by hand below: regex lookbehind would throw
      // at load time on older Safari.
      pattern: new RegExp(
        `${escapeRe(label)}(?:s|es)?`,
        label === label.toUpperCase() ? 'g' : 'gi'
      )
    }))
);

const isWordChar = (ch: string | undefined) => !!ch && /[A-Za-z0-9-]/.test(ch);

/**
 * Split `text` into plain and glossary-term segments. Each term is linked at
 * most once per text, longer matches win over shorter ones they contain,
 * and `exclude` keeps a definition from linking to itself.
 */
export function linkGlossary(text: string, exclude?: string): Segment[] {
  const found: { start: number; end: number; term: string }[] = [];
  for (const { term, pattern } of LABELS) {
    if (term === exclude) continue;
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text))) {
      const end = m.index + m[0].length;
      if (isWordChar(text[m.index - 1]) || isWordChar(text[end])) continue;
      found.push({ start: m.index, end, term });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: Segment[] = [];
  const used = new Set<string>();
  let pos = 0;
  for (const f of found) {
    if (f.start < pos || used.has(f.term)) continue;
    if (f.start > pos) segments.push({ text: text.slice(pos, f.start) });
    segments.push({ text: text.slice(f.start, f.end), term: f.term });
    used.add(f.term);
    pos = f.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) });
  return segments;
}
