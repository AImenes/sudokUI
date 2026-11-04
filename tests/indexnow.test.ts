/**
 * IndexNow on every deploy (scripts/indexnow.ts, docs/deployment.md): the
 * key file is served as a static file, never through the Worker; the
 * build's list maps every sitemap URL to a hash of its page that moves
 * with the page's words, not with the app's script names; and the job on a
 * push to main sends only the new and changed URLs, the home pages alone
 * when there is no earlier list, nothing when its deploy never shows, and
 * never fails the push's checks, whatever IndexNow or the network answer.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  SITE,
  HOME_URLS,
  MAX_URLS,
  ENDPOINT,
  KEY_FILE,
  keyFrom,
  keyLocation,
  pageHash,
  sitemapUrls,
  filesOf,
  buildManifest,
  parseManifest,
  urlsToSubmit,
  submission,
  isDeployed,
  sameCommit,
  submitChanges
} from '../scripts/indexnow';
import type { Manifest, SubmitOptions } from '../scripts/indexnow';

const text = (path: string) => new TextDecoder().decode(readFileSync(path));
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const OLD_SHA = 'ffffeeeeddddccccbbbbaaaa9999888877776666';

describe('the key', () => {
  const names = readdirSync('public');
  const key = keyFrom(names, (name) => text(`public/${name}`));

  it('is one file in public/, named after the key and holding nothing else', () => {
    expect(names.filter((n) => KEY_FILE.test(n))).toEqual([`${key}.txt`]);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(text(`public/${key}.txt`)).toBe(key);
    expect(keyLocation(key)).toBe(`${SITE}/${key}.txt`);
  });

  it('is refused when missing, doubled or holding anything else', () => {
    const k = '0123456789abcdef0123456789abcdef';
    expect(() => keyFrom(['robots.txt'], () => '')).toThrow(/found 0/);
    expect(() => keyFrom([`${k}.txt`, `${'f'.repeat(32)}.txt`], () => k)).toThrow(/found 2/);
    expect(() => keyFrom([`${k}.txt`], () => `${k}\n`)).toThrow(/nothing else/);
    expect(keyFrom([`${k}.txt`, 'robots.txt'], () => k)).toBe(k);
  });

  /** a run_worker_first pattern as Cloudflare reads it: an exact path, or * for any run of characters */
  const matches = (pattern: string, path: string) =>
    new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(path);

  it('and the list are files the asset hosting answers, which the Worker never sees first', () => {
    const config = JSON.parse(
      text('wrangler.jsonc')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n')
    ) as { assets: { run_worker_first: string[] } };
    const first = config.assets.run_worker_first;
    expect(first.length).toBeGreaterThan(0);
    for (const path of [`/${key}.txt`, '/indexnow.json']) {
      expect(first.filter((p) => matches(p, path)), path).toEqual([]);
    }
    // the matcher itself, on the patterns it must read
    expect(matches('/p/*', '/p/123')).toBe(true);
    expect(matches('/', '/')).toBe(true);
    expect(matches('/', `/${key}.txt`)).toBe(false);
  });
});

describe('the build’s list', () => {
  const page = (words: string, script = 'index-CCtYCYTJ') =>
    `<!doctype html><html><head><script type="module" src="/assets/${script}.js"></script><link rel="stylesheet" href="/assets/index-Bx_9-aZq.css"></head><body>${words}</body></html>`;

  it('hashes a page by its words, not by the fingerprints in its script names', async () => {
    const h = await pageHash(page('Play sudoku'));
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(await pageHash(page('Play sudoku', 'index-yueLCgr2'))).toBe(h);
    expect(await pageHash(page('Play sudoku', 'Learn-a-b_cdef'))).not.toBe(h);
    expect(await pageHash(page('Play sudoku today'))).not.toBe(h);
  });

  it('reads every URL of the sitemap, in order', () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>${SITE}/</loc><xhtml:link rel="alternate" href="${SITE}/nb/"/></url>\n<url><loc> ${SITE}/learn/x-wing/ </loc></url><url><loc>${SITE}/a?b=1&amp;c=2</loc></url></urlset>`;
    expect(sitemapUrls(xml)).toEqual([`${SITE}/`, `${SITE}/learn/x-wing/`, `${SITE}/a?b=1&c=2`]);
  });

  it('finds each URL’s page where the build writes it', () => {
    expect(filesOf(`${SITE}/`)).toEqual(['index.html']);
    expect(filesOf(`${SITE}/nb/learn/x-wing/`)).toEqual(['nb/learn/x-wing/index.html']);
    expect(filesOf(`${SITE}/privacy`)).toEqual(['privacy', 'privacy.html', 'privacy/index.html']);
    expect(() => filesOf('https://example.com/')).toThrow(/not on/);
  });

  it('maps every sitemap URL to its page’s hash, with the commit, and fails the build on a page that is missing', async () => {
    const files = new Map([
      ['sitemap.xml', `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/es/</loc></url><url><loc>${SITE}/learn/</loc></url></urlset>`],
      ['index.html', page('Home')],
      ['es/index.html', page('Inicio')],
      ['learn/index.html', page('Techniques')]
    ]);
    const read = (path: string) => files.get(path) ?? null;
    const m = await buildManifest(read, SHA);
    expect(m.commit).toBe(SHA);
    expect(Object.keys(m.pages)).toEqual([`${SITE}/`, `${SITE}/es/`, `${SITE}/learn/`]);
    expect(m.pages[`${SITE}/es/`]).toBe(await pageHash(page('Inicio')));
    // and the list reads back as itself
    expect(parseManifest(JSON.stringify(m))).toEqual(m);
    files.delete('learn/index.html');
    await expect(buildManifest(read, SHA)).rejects.toThrow(/learn\/, but the build wrote no page/);
    files.delete('sitemap.xml');
    await expect(buildManifest(read, null)).rejects.toThrow(/sitemap/);
  });

  it('is written by the build, after the sitemap', () => {
    const scripts = JSON.parse(text('package.json')).scripts as Record<string, string>;
    expect(scripts.build).toMatch(/scripts\/build-learn\.ts && vite-node scripts\/build-indexnow\.ts$/);
  });
});

/** a list over some pages, each hashed by a word */
const list = (pages: Record<string, string>, commit: string | null = SHA): Manifest => ({
  commit,
  pages: Object.fromEntries(Object.entries(pages).map(([path, hash]) => [`${SITE}${path}`, hash]))
});

describe('what the job sends', () => {
  it('reads back only a real list: not a 404 page, a cut-off file or nothing', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest('')).toBeNull();
    expect(parseManifest('<!doctype html><title>Page not found</title>')).toBeNull();
    expect(parseManifest('{"commit":"abc","pages":{"https://sudokui.app/":"12')).toBeNull();
    expect(parseManifest('{"commit":"abc","pages":{}}')).toBeNull();
    expect(parseManifest('{"commit":5,"pages":{"https://sudokui.app/":"1"}}')).toBeNull();
    expect(parseManifest('{"commit":null,"pages":{"https://example.com/":"1"}}')).toBeNull();
    expect(parseManifest('{"commit":null,"pages":{"https://sudokui.app/":"1"}}')).toEqual({ commit: null, pages: { [`${SITE}/`]: '1' } });
  });

  it('sends the new and the changed pages, in the sitemap’s order; not the unchanged, nor the ones gone', () => {
    const old = list({ '/': 'a', '/nb/': 'b', '/learn/': 'c', '/gone/': 'd' }, OLD_SHA);
    const next = list({ '/': 'a', '/nb/': 'B', '/new/': 'e', '/learn/': 'c' });
    expect(urlsToSubmit(old, next)).toEqual([`${SITE}/nb/`, `${SITE}/new/`]);
    expect(urlsToSubmit(next, next)).toEqual([]);
  });

  it('sends the home pages alone when there is no earlier list to compare with', () => {
    const next = list({ '/': 'a', '/nb/': 'b', '/es/': 'c', '/learn/': 'd', '/why/': 'e' });
    expect(urlsToSubmit(null, next)).toEqual(HOME_URLS);
    expect(HOME_URLS).toEqual([`${SITE}/`, `${SITE}/nb/`, `${SITE}/es/`]);
  });

  it('sends at most 10,000 URLs', () => {
    const pages: Record<string, string> = {};
    for (let i = 0; i < MAX_URLS + 5; i++) pages[`/p${i}/`] = 'x';
    const urls = urlsToSubmit(list({ '/': 'a' }), list(pages));
    expect(urls).toHaveLength(MAX_URLS);
    expect(urls[0]).toBe(`${SITE}/p0/`);
    expect(submission('k', [...urls, 'more']).urlList).toHaveLength(MAX_URLS);
  });

  it('sends the host, the key, where the key is, and the URLs', () => {
    const k = '0123456789abcdef0123456789abcdef';
    expect(submission(k, [`${SITE}/`])).toEqual({ host: 'sudokui.app', key: k, keyLocation: `${SITE}/${k}.txt`, urlList: [`${SITE}/`] });
  });

  it('knows its own deploy by the commit, full or short, and by changed pages when the build could not tell its commit', () => {
    const old = list({ '/': 'a' }, OLD_SHA);
    expect(sameCommit(SHA, SHA.slice(0, 7))).toBe(true);
    expect(sameCommit(SHA.slice(0, 6), SHA)).toBe(false);
    expect(sameCommit(null, SHA)).toBe(false);
    expect(isDeployed(null, SHA, old)).toBe(false);
    expect(isDeployed(old, SHA, old)).toBe(false);
    expect(isDeployed(list({ '/': 'b' }, OLD_SHA), SHA, old)).toBe(false);
    expect(isDeployed(list({ '/': 'a' }, SHA), SHA, old)).toBe(true);
    expect(isDeployed(list({ '/': 'a' }, SHA.slice(0, 7)), SHA, old)).toBe(true);
    expect(isDeployed(list({ '/': 'a' }, null), SHA, old)).toBe(false);
    expect(isDeployed(list({ '/': 'b' }, null), SHA, old)).toBe(true);
  });
});

describe('the job, one push', () => {
  const KEY = '0123456789abcdef0123456789abcdef';
  const before = list({ '/': 'a', '/nb/': 'b', '/es/': 'c', '/learn/': 'd' }, OLD_SHA);
  const after = list({ '/': 'a', '/nb/': 'b', '/es/': 'c', '/learn/': 'D', '/why/': 'e' }, SHA);

  /** a site whose list turns into `live` after `deployAfter` looks, an IndexNow that answers `status`, a clock that only the job's waits move */
  function run(over: Partial<SubmitOptions> & { deployAfter?: number; live?: Manifest; status?: number; postThrows?: boolean } = {}) {
    let clock = 0;
    let looks = 0;
    const posts: { url: string; body: any }[] = [];
    const lines: string[] = [];
    const fetch = async (url: string, init?: RequestInit) => {
      if (url.startsWith(`${SITE}/indexnow.json`)) {
        looks++;
        return looks > (over.deployAfter ?? 2) ? new Response(JSON.stringify(over.live ?? after)) : new Response(JSON.stringify(before));
      }
      if (url === keyLocation(KEY)) return new Response(KEY);
      if (url === ENDPOINT) {
        if (over.postThrows) throw new TypeError('fetch failed');
        posts.push({ url, body: JSON.parse(String(init?.body)) });
        return new Response('', { status: over.status ?? 200 });
      }
      return new Response('not found', { status: 404 });
    };
    const outcome = submitChanges({
      oldText: JSON.stringify(before),
      commit: SHA,
      key: KEY,
      fetch,
      sleep: async (ms) => void (clock += ms),
      now: () => clock,
      log: (line) => void lines.push(line),
      ...over
    });
    return { outcome, posts, lines, waited: () => clock, looks: () => looks };
  }

  it('waits for its deploy, then sends the new and changed pages', async () => {
    const r = run();
    const outcome = await r.outcome;
    expect(r.looks()).toBe(3);
    expect(r.posts).toEqual([
      { url: ENDPOINT, body: { host: 'sudokui.app', key: KEY, keyLocation: keyLocation(KEY), urlList: [`${SITE}/learn/`, `${SITE}/why/`] } }
    ]);
    expect(outcome).toMatchObject({ urls: [`${SITE}/learn/`, `${SITE}/why/`], status: 200 });
  });

  it('sends the home pages alone when the list from before could not be read', async () => {
    for (const oldText of [null, '', '<!doctype html>Page not found']) {
      const r = run({ oldText, deployAfter: 0 });
      await r.outcome;
      expect(r.posts.map((p) => p.body.urlList)).toEqual([HOME_URLS]);
    }
  });

  it('sends nothing when its deploy never shows, and gives up after about 15 minutes, quietly', async () => {
    const r = run({ deployAfter: Infinity });
    const outcome = await r.outcome;
    expect(r.posts).toEqual([]);
    expect(outcome.urls).toEqual([]);
    expect(outcome.reason).toMatch(/did not show within 15 minutes/);
    expect(r.waited()).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(r.waited()).toBeGreaterThan(14 * 60 * 1000);
  });

  it('sends nothing when no page changed, or the site was already this commit’s before the job looked', async () => {
    const same = run({ live: { ...before, commit: SHA } });
    expect((await same.outcome).reason).toMatch(/no page is new or changed/);
    expect(same.posts).toEqual([]);
    const early = run({ oldText: JSON.stringify(after) });
    expect((await early.outcome).reason).toMatch(/already served this commit/);
    expect(early.posts).toEqual([]);
  });

  it('never throws, whatever IndexNow or the network answer', async () => {
    for (const status of [202, 400, 403, 422, 429, 500]) {
      const r = run({ status });
      const outcome = await r.outcome;
      expect(outcome.status).toBe(status);
      expect(outcome.reason).toMatch(status === 202 ? /^sent/ : /^IndexNow refused/);
    }
    const down = run({ postThrows: true });
    expect((await down.outcome).reason).toMatch(/^stopped: fetch failed/);
    const broken = run({ fetch: async () => Promise.reject(new Error('offline')), deployAfter: 0 });
    expect((await broken.outcome).reason).toMatch(/did not show/);
  });

  it('sends nothing on a dry run, and says what it would have sent', async () => {
    const r = run({ dryRun: true });
    const outcome = await r.outcome;
    expect(r.posts).toEqual([]);
    expect(outcome.reason).toMatch(/^dry run: would send 2 URLs/);
  });
});

describe('the workflow', () => {
  const yml = text('.github/workflows/indexnow.yml');

  it('runs on a push to main only, reading the old list before anything else', () => {
    expect(yml).toMatch(/on:\s*\n\s+push:\s*\n\s+branches: \[main\]\s*\n/);
    expect(yml).not.toMatch(/pull_request|claude\/\*\*/);
    const steps = yml.split(/\n\s+- (?:name|uses): /).slice(1);
    expect(steps[0]).toMatch(/curl[^\n]*https:\/\/sudokui\.app\/indexnow\.json/);
  });

  it('can never fail the push’s checks: every step may fail, the job outlives the wait, and no secret is asked for', () => {
    const steps = yml.split(/\n {6}- /).slice(1);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const step of steps) expect(step, step.split('\n')[0]).toMatch(/continue-on-error: true/);
    const minutes = Number(/timeout-minutes: (\d+)/.exec(yml)?.[1]);
    expect(minutes).toBeGreaterThan(15);
    expect(yml).not.toMatch(/secrets\./);
    expect(yml).toMatch(/node --experimental-strip-types scripts\/indexnow-submit\.ts/);
  });
});
