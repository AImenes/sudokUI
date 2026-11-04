// What sudokUI tells AI assistants about itself, /llms.txt (public/llms.txt,
// copied into dist/ as it is): the format llmstxt.org describes, every
// number the catalogue's own, every link a page the build writes, the
// pages it must point to, no other app named, and a plain file that the
// asset hosting serves, never the Worker or the service worker's shell.
// The browser test (tests/e2e/smoke.spec.ts) reads it from the build,
// with the home pages' structured data.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COUNTS } from '../src/content/landing';
import { buildLearnPages } from '../src/content/learnPages';
import { HOME_LANGS, homePath, APP_NAVIGATION, SITE } from '../src/content/home';
import { WHY_URL, PRIVACY_URL } from '../src/content/staticRoutes';
import { LEVELS } from '../src/engine/ratings';

/** a file as text (tests/node.d.ts declares readFileSync as it is used: bytes) */
const read = (path: string) => new TextDecoder().decode(readFileSync(path));
const text = read('public/llms.txt');
const pages = new Set([...HOME_LANGS.map(homePath), ...buildLearnPages().map((p) => p.url)]);

describe('llms.txt', () => {
  it('is laid out as llms.txt asks: the name, a one-paragraph summary, then sections of links', () => {
    const lines = text.split('\n');
    expect(lines[0]).toBe('# sudokUI');
    expect(lines[1]).toBe('');
    expect(lines[2]).toMatch(/^> sudokUI is a free sudoku app/);
    expect(text.match(/^# /gm)).toHaveLength(1);
    expect(text.match(/^## .+$/gm)).toEqual(['## Start here', '## Learn', '## Optional']);
    // after the first section, every line is a link with what it is
    const links = text.slice(text.indexOf('## Start here')).split('\n').filter((l) => l && !l.startsWith('## '));
    for (const line of links) expect(line, line).toMatch(/^- \[[^\]]+\]\([^)]+\): .+$/);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('says what the app is and does, with the catalogue’s numbers', () => {
    for (const words of [
      'free sudoku app',
      'walks you through it on your own grid, one step at a time',
      'works offline',
      'needs no account',
      'shows no ads',
      'In English, Norwegian and Spanish',
      'at their own pace',
      'There is no course to follow',
      'A daily puzzle, the same for everyone',
      `Hints for ${COUNTS.implemented} solving techniques`,
      `Practice for ${COUNTS.practice} named techniques`,
      `all ${COUNTS.catalogued} techniques`,
      `${['', 'one', 'two', 'three', 'four', 'five', 'six'][LEVELS.length]} difficulty levels`
    ])
      expect(text, words).toContain(words);
    const allowed = [COUNTS.implemented, COUNTS.practice, COUNTS.catalogued].map(String);
    for (const n of text.match(/\d+/g) ?? []) expect(allowed, n).toContain(n);
  });

  it('links to pages that exist: the home pages, Why, the Learn pages and the privacy page', () => {
    const own = [...text.matchAll(/\]\((https:\/\/sudokui\.app[^)]*)\)/g)].map((m) => m[1].slice(SITE.length));
    for (const path of own) expect(pages.has(path), path).toBe(true);
    for (const path of [...HOME_LANGS.map(homePath), WHY_URL, '/learn/', '/learn/intuition/', '/learn/glossary/', PRIVACY_URL]) expect(own, path).toContain(path);
    // nothing but the site, its source and its address
    const other = [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).filter((u) => !u.startsWith(SITE));
    expect(other).toEqual(['https://github.com/AImenes/sudokUI', 'mailto:feedback@sudokui.app']);
  });

  it('names no other app or site', () => {
    const others = [
      'sudokupad',
      'sudoku.coach',
      'sudoku coach',
      'good sudoku',
      'sudoku.com',
      'cracking the cryptic',
      'simple sudoku',
      'revisited',
      'sudokuwiki',
      'enjoy sudoku',
      'sudoku explainer',
      'yzf',
      'andoku',
      'brainium',
      'easybrain',
      'f-puzzles',
      'logic-masters',
      'menneske',
      'lichess'
    ];
    for (const name of others) expect(text.toLowerCase(), name).not.toContain(name);
  });

  it('is plain text the asset hosting serves as it is: ASCII, and no route of the Worker or the app', () => {
    expect(/^[\x09\x0a\x20-\x7e]*$/.test(text)).toBe(true);
    // wrangler.jsonc's run_worker_first: the Worker never sees it
    const config = JSON.parse(read('wrangler.jsonc').replace(/^\s*\/\/.*$/gm, ''));
    const first: string[] = config.assets.run_worker_first;
    const matches = (pattern: string, path: string) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(path);
    expect(first.filter((p) => matches(p, '/llms.txt'))).toEqual([]);
    // and an installed app's service worker never answers it with the game
    expect(APP_NAVIGATION.test('/llms.txt')).toBe(false);
  });
});
