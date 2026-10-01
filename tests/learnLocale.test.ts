/**
 * The Norwegian and Spanish Learn sections are held to the same rules as
 * the English: complete (every technique, glossary entry, Intuition section
 * and interface string), in house style, with every placeholder, number and
 * cell name of the English kept, and the "like I'm 12" texts free of
 * notation. The terminology follows docs/glossary_input.md.
 */
import { describe, it, expect } from 'vitest';
import { ALL_TECHS, LEVELS } from '../src/engine/ratings';
import { EN, LearnLocale } from '../src/content/learnLocale';
import { LEARN_STRINGS } from '../src/content/learnStrings';
import { GLOSSARY, GLOSSARY_GROUPS } from '../src/content/glossary';
import { INTUITION_SECTIONS, INTUITION } from '../src/content/intuition';
import { KIN } from '../src/content/kin';
import { linkGlossary } from '../src/content/glossaryLinks';
import nb from '../src/content/locales/nb';
import es from '../src/content/locales/es';

const LOCALES: [string, LearnLocale][] = [
  ['nb', nb],
  ['es', es]
];

const BANDS: Record<string, string[]> = {
  nb: ['Nybegynner', 'Lett', 'Middels', 'Lur', 'Vanskelig', 'Urettferdig', 'Ekstrem', 'Mareritt'],
  es: ['Principiante', 'Fácil', 'Medio', 'Engañoso', 'Difícil', 'Injusto', 'Extremo', 'Pesadilla']
};

const words = (s: string) => s.trim().split(/\s+/).length;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const numbers = (s: string, english: boolean) => {
  let x = s.replace(/\{\w+\}/g, '');
  x = english ? x.replace(/(\d),(\d{3})(?!\d)/g, '$1$2') : x.replace(/(\d)[ .  ](\d{3})(?!\d)/g, '$1$2');
  return [...x.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.')).sort().join(' ');
};

function houseStyle(text: string, where: string) {
  expect(typeof text, `${where}: a string`).toBe('string');
  expect(text.trim(), `${where}: not empty`).not.toBe('');
  expect(text, `${where}: no em or en dashes`).not.toMatch(/[–—]/);
  expect(text, `${where}: no exclamation marks`).not.toMatch(/[!¡]/);
  expect(text, `${where}: no markdown`).not.toMatch(/[*_`#]|\[[^\]]*\]\(/);
  expect(text.trim(), `${where}: no stray whitespace`).toBe(text);
}

/** the same claims as the English: placeholders, numbers and cell names survive */
function faithful(english: string, text: string, where: string) {
  houseStyle(text, where);
  expect(placeholders(text), `${where}: placeholders`).toBe(placeholders(english));
  expect(numbers(text, false), `${where}: numbers`).toBe(numbers(english, true));
  expect(/\br\d+c\d+\b/.test(text), `${where}: cell names`).toBe(/\br\d+c\d+\b/.test(english));
}

describe('glossary links in Norwegian and Spanish', () => {
  const linkedIn = (text: string, lang: 'nb' | 'es', loc: LearnLocale) =>
    linkGlossary(text, undefined, lang, loc.glossary)
      .filter((s) => s.term)
      .map((s) => s.term);
  it('follow the word endings of the language', () => {
    // rute, ruten, rutene; kandidat, kandidatene
    expect(linkedIn('Rutene og kandidatene i ruten.', 'nb', nb)).toEqual(['cell', 'candidate']);
    expect(linkedIn('Las casillas y sus candidatos.', 'es', es)).toEqual(['cell', 'candidate']);
  });
  it('leave everyday words that happen to be headwords alone', () => {
    // finne is a fin and the verb to find; ser is sees and looks; steg is any step
    expect(linkedIn('Når du finner den, ser du etter neste steg.', 'nb', nb)).toEqual([]);
    // único is a single and the word only; pasos are any steps
    expect(linkedIn('Es el único sitio, y quedan dos pasos.', 'es', es)).toEqual([]);
  });
});

for (const [lang, loc] of LOCALES) {
  describe(`the ${lang} Learn section`, () => {
    it('explains every technique, as faithfully and as briefly as the English', () => {
      for (const t of ALL_TECHS) {
        const en = EN.techDocs[t];
        const d = loc.techDocs[t];
        expect(d, t).toBeDefined();
        for (const k of ['what', 'why', 'spot'] as const) faithful(en[k], d[k], `${t}.${k}`);
        expect(words(d.what), `${t}.what`).toBeLessThanOrEqual(40);
        expect(words(d.why), `${t}.why`).toBeLessThanOrEqual(60);
        expect(words(d.spot), `${t}.spot`).toBeLessThanOrEqual(34);
      }
      for (const [t, name] of Object.entries(loc.techNames)) houseStyle(name!, `${t}.name`);
      for (const [t, aka] of Object.entries(loc.techAka)) aka!.forEach((a, i) => houseStyle(a, `${t}.aka[${i}]`));
    });

    it('gives every kin line, item for item', () => {
      expect(Object.keys(loc.kin).sort()).toEqual(Object.keys(KIN).sort());
      for (const [t, items] of Object.entries(KIN)) {
        const tr = loc.kin[t as keyof typeof KIN]!;
        expect(tr.length, t).toBe(items!.length);
        tr.forEach((k, i) => {
          houseStyle(k, `${t}.kin[${i}]`);
          expect(words(k), `${t}.kin[${i}]`).toBeLessThanOrEqual(7);
        });
      }
    });

    it('defines every glossary entry and names every group', () => {
      for (const g of GLOSSARY_GROUPS) houseStyle(loc.glossaryGroups[g], `group ${g}`);
      expect(Object.keys(loc.glossary).sort()).toEqual(GLOSSARY.map((e) => e.id).sort());
      for (const e of GLOSSARY) {
        const g = loc.glossary[e.id];
        houseStyle(g.term, `${e.id}.term`);
        g.aka.forEach((a, i) => houseStyle(a, `${e.id}.aka[${i}]`));
        faithful(e.definition, g.definition, `${e.id}.definition`);
        expect(words(g.definition), `${e.id}.definition`).toBeLessThanOrEqual(85);
      }
    });

    it('carries the whole Intuition guide, with no notation in the like-I-am-12 texts', () => {
      faithful(EN.intuition.lead, loc.intuition.lead, 'lead');
      for (const p of INTUITION) {
        const t = loc.intuition.parts[p.id];
        for (const k of ['nav', 'heading', 'intro'] as const) faithful(EN.intuition.parts[p.id][k], t[k], `${p.id}.${k}`);
      }
      for (const s of INTUITION_SECTIONS) {
        const en = EN.intuition.sections[s.id];
        const t = loc.intuition.sections[s.id];
        expect(t, s.id).toBeDefined();
        faithful(en.heading, t.heading, `${s.id}.heading`);
        expect(t.paragraphs.length, `${s.id}.paragraphs`).toBe(en.paragraphs.length);
        en.paragraphs.forEach((p, i) => faithful(p, t.paragraphs[i], `${s.id}.paragraphs[${i}]`));
        if (en.caption) faithful(en.caption, t.caption!, `${s.id}.caption`);
        if (en.points) {
          expect(t.points!.length, `${s.id}.points`).toBe(en.points.length);
          en.points.forEach((pt, i) => {
            faithful(pt.when, t.points![i].when, `${s.id}.points[${i}].when`);
            faithful(pt.what, t.points![i].what, `${s.id}.points[${i}].what`);
          });
        }
        if (en.eli12) {
          const e = t.eli12!;
          faithful(en.eli12, e, `${s.id}.eli12`);
          expect(e, `${s.id}.eli12: no cell names`).not.toMatch(/\br\d+c\d+\b/i);
          expect(e, `${s.id}.eli12: no letters for digits`).not.toMatch(/\b[NWXYZ]\b(?!-)/);
          expect(e, `${s.id}.eli12: no symbols`).not.toMatch(/[=+<>{}]/);
        }
      }
    });

    it('uses the agreed band names and translates the rating and How to solve', () => {
      expect(LEVELS.map((l) => loc.levels[l])).toEqual(BANDS[lang]);
      for (const l of LEVELS) {
        houseStyle(loc.bandLeads[l], `bandLeads.${l}`);
        houseStyle(loc.bandNotes[l], `bandNotes.${l}`);
      }
      faithful(EN.rating.summary, loc.rating.summary, 'rating.summary');
      expect(loc.rating.points.length).toBe(EN.rating.points.length);
      EN.rating.points.forEach((p, i) => {
        faithful(p.title, loc.rating.points[i].title, `rating.points[${i}].title`);
        faithful(p.text, loc.rating.points[i].text, `rating.points[${i}].text`);
      });
      faithful(EN.rating.solveTimeNote, loc.rating.solveTimeNote, 'rating.solveTimeNote');
      const m = loc.method;
      for (const k of ['name', 'h1', 'lead'] as const) faithful(EN.method[k], m[k], `method.${k}`);
      expect(m.title.length, 'method.title').toBeLessThanOrEqual(60);
      expect(m.description.length, 'method.description').toBeGreaterThanOrEqual(50);
      expect(m.description.length, 'method.description').toBeLessThanOrEqual(200);
      expect(m.sections.length).toBe(EN.method.sections.length);
      EN.method.sections.forEach((s, i) => {
        faithful(s.heading, m.sections[i].heading, `method.sections[${i}].heading`);
        expect(m.sections[i].paragraphs.length).toBe(s.paragraphs.length);
        s.paragraphs.forEach((p, j) => faithful(p, m.sections[i].paragraphs[j], `method.sections[${i}].paragraphs[${j}]`));
      });
    });

    it('translates every interface string, keeping its placeholders', () => {
      for (const key of LEARN_STRINGS) faithful(key, loc.strings[key], `strings "${key}"`);
      // a locale that only copied the English would pass the rules above:
      // most strings must actually read differently
      const same = LEARN_STRINGS.filter((k) => loc.strings[k] === k);
      expect(same.length, `untranslated: ${same.slice(0, 12).join(' | ')}`).toBeLessThan(LEARN_STRINGS.length * 0.15);
      const sameDocs = ALL_TECHS.filter((t) => loc.techDocs[t].why === EN.techDocs[t].why);
      expect(sameDocs, 'technique explanations translated').toEqual([]);
    });
  });
}
