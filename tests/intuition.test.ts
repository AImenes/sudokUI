/**
 * The Intuition guide and the kin lines under technique names are teaching
 * copy, held to the same house style as the rest of the guide, plus two
 * rules of their own: an "explain it like I'm 12" text uses no notation at
 * all, and a kin line stays a few words long.
 */
import { describe, it, expect } from 'vitest';
import { TECHS, ALL_TECHS, Tech, Category } from '../src/engine/ratings';
import { INTUITION, INTUITION_LEAD, INTUITION_SECTIONS, INTUITION_URL } from '../src/content/intuition';
import { intuitionDiagram, DIAGRAM_IDS } from '../src/content/intuitionDiagrams';
import { KIN } from '../src/content/kin';
import { FAMILY_ORDER, techniquesByFamily } from '../src/content/categories';
import { buildLearnPages } from '../src/content/learnPages';

const words = (s: string) => s.trim().split(/\s+/).length;

function expectHouseStyle(text: string, where: string) {
  expect(text, `${where}: no em or en dashes`).not.toMatch(/[–—]/);
  expect(text, `${where}: no exclamation marks`).not.toContain('!');
  expect(text, `${where}: no markdown`).not.toMatch(/[*_`#]|\[[^\]]*\]\(/);
  expect(text, `${where}: British spelling`).not.toMatch(/\b(color|colors|colored|coloring|center|centers)\b/);
  expect(text.trim(), `${where}: no stray whitespace`).toBe(text);
}

describe('the Intuition guide', () => {
  it('keeps to house style everywhere', () => {
    expectHouseStyle(INTUITION_LEAD, 'lead');
    for (const part of INTUITION) {
      for (const [k, v] of [['heading', part.heading], ['nav', part.nav], ['intro', part.intro]] as const) {
        expectHouseStyle(v, `${part.id}.${k}`);
      }
      for (const s of part.sections) {
        expectHouseStyle(s.heading, `${s.id}.heading`);
        s.paragraphs.forEach((p, i) => {
          expectHouseStyle(p, `${s.id}.paragraphs[${i}]`);
          expect(words(p), `${s.id}.paragraphs[${i}]: at most 110 words`).toBeLessThanOrEqual(110);
        });
        if (s.eli12) expectHouseStyle(s.eli12, `${s.id}.eli12`);
        if (s.diagram) expectHouseStyle(s.diagram.caption, `${s.id}.caption`);
        for (const pt of s.points ?? []) {
          expectHouseStyle(pt.when, `${s.id}.points`);
          expectHouseStyle(pt.what, `${s.id}.points`);
        }
      }
    }
  });

  it('explains like I am 12 without any notation', () => {
    for (const s of INTUITION_SECTIONS) {
      if (!s.eli12) continue;
      const where = `${s.id}.eli12`;
      expect(s.eli12, `${where}: no cell names`).not.toMatch(/\br\d+c\d+\b/i);
      // a letter standing for a digit; technique names such as X-Wing are fine
      expect(s.eli12, `${where}: no letters for digits`).not.toMatch(/\b[NWXYZ]\b(?!-)/);
      expect(s.eli12, `${where}: no symbols`).not.toMatch(/[=+<>{}]/);
      expect(words(s.eli12), `${where}: at most 90 words`).toBeLessThanOrEqual(90);
    }
  });

  it('has unique anchors and only real techniques and diagrams', () => {
    const ids = [...INTUITION.map((p) => p.id), ...INTUITION_SECTIONS.map((s) => s.id)];
    expect(new Set(ids).size, 'anchors are unique').toBe(ids.length);
    for (const s of INTUITION_SECTIONS) {
      for (const t of s.techs ?? []) expect(TECHS[t], `${s.id} names ${t}`).toBeDefined();
      if (s.diagram) expect(DIAGRAM_IDS, s.id).toContain(s.diagram.id);
    }
    const used = INTUITION_SECTIONS.flatMap((s) => (s.diagram ? [s.diagram.id] : []));
    for (const id of DIAGRAM_IDS) expect(used, `diagram ${id} is shown somewhere`).toContain(id);
  });

  it('draws every diagram as a titled SVG document', () => {
    for (const id of DIAGRAM_IDS) {
      const svg = intuitionDiagram(id);
      expect(svg, id).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 [\d.]+ [\d.]+"/);
      expect(svg, id).toMatch(/<title>[^<]+<\/title>/);
      expect(svg.trim().endsWith('</svg>'), id).toBe(true);
      expect(svg, `${id}: no unfilled values`).not.toMatch(/undefined|NaN/);
    }
  });

  it('is published as a static page with every section and box', () => {
    const page = buildLearnPages().find((p) => p.url === INTUITION_URL)!;
    expect(page).toBeDefined();
    for (const id of [...INTUITION.map((p) => p.id), ...INTUITION_SECTIONS.map((s) => s.id)]) {
      expect(page.html, id).toContain(` id="${id}"`);
    }
    const boxes = (page.html.match(/class="eli12"/g) ?? []).length;
    expect(boxes).toBe(INTUITION_SECTIONS.filter((s) => s.eli12).length);
  });
});

describe('kin lines', () => {
  it('are short, in house style and never repeat the name', () => {
    for (const [tech, items] of Object.entries(KIN) as [Tech, string[]][]) {
      expect(TECHS[tech], tech).toBeDefined();
      expect(items.length, `${tech}: one to three items`).toBeGreaterThan(0);
      expect(items.length, `${tech}: one to three items`).toBeLessThanOrEqual(3);
      expect(new Set(items).size, `${tech}: no duplicates`).toBe(items.length);
      for (const item of items) {
        expectHouseStyle(item, `${tech} kin`);
        expect(words(item), `${tech} kin "${item}": at most 6 words`).toBeLessThanOrEqual(6);
        expect(item.toLowerCase(), `${tech} kin repeats the name`).not.toBe(TECHS[tech].name.toLowerCase());
      }
    }
  });
});

describe('family order', () => {
  it('lists every family once and every technique exactly once', () => {
    const categories = new Set<Category>(ALL_TECHS.map((t) => TECHS[t].category));
    expect(new Set(FAMILY_ORDER).size).toBe(FAMILY_ORDER.length);
    for (const c of categories) expect(FAMILY_ORDER, c).toContain(c);
    const listed = techniquesByFamily().flatMap(([, techs]) => techs);
    expect([...listed].sort()).toEqual([...ALL_TECHS].sort());
  });

  it('keeps catalogue order inside each family', () => {
    for (const [, techs] of techniquesByFamily()) {
      const idx = techs.map((t) => ALL_TECHS.indexOf(t));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  });
});
