// IndexNow (https://www.indexnow.org): on every deploy, tell the search
// engines that take part, Bing first among them, which pages are new or
// changed, so they fetch those within hours instead of whenever their
// crawler next comes by. AI assistants that search the web through Bing
// see the change as soon as Bing does. docs/deployment.md, "IndexNow".
//
// Two halves, both here so they cannot drift apart:
// - the build (scripts/build-indexnow.ts, the last step of `npm run
//   build`) writes dist/indexnow.json: every URL in the sitemap, with a
//   hash of the page the build wrote for it, and the commit it was built
//   from;
// - a GitHub Actions job on every push to main
//   (.github/workflows/indexnow.yml, scripts/indexnow-submit.ts) reads the
//   live indexnow.json before the deploy, waits until the site serves the
//   pushed commit's, and sends IndexNow the URLs whose hash is new or
//   changed. It never fails the push: whatever goes wrong, it says so in
//   its log and stops.
//
// The key is public by design: IndexNow checks that a file named after it,
// holding it, is served from the site's root (public/<key>.txt), which
// proves the site asked. No secret is involved, and nothing about players.
//
// No imports at all, so the job runs it with plain `node` (type stripping,
// Node 22) and needs no `npm ci`, and nothing but erasable type syntax for
// the same reason; the files come in through a reader (ReadFile), which
// the build gives node:fs and a test a Map, so the app's tsconfig, which
// has no Node types on purpose (tests/node.d.ts), checks all of it.
export const SITE = 'https://sudokui.app';
export const HOST = 'sudokui.app';
/** the shared endpoint: one submission reaches every engine that takes part */
export const ENDPOINT = 'https://api.indexnow.org/indexnow';
/** where the build writes the list, and the site serves it */
export const MANIFEST_FILE = 'indexnow.json';
/** IndexNow takes at most this many URLs in one submission */
export const MAX_URLS = 10_000;
/** the home pages: all that is sent when there is no earlier list to compare with */
export const HOME_URLS = [`${SITE}/`, `${SITE}/nb/`, `${SITE}/es/`];
/** the key file's name: 32 hex digits and .txt, in public/ */
export const KEY_FILE = /^([0-9a-f]{32})\.txt$/;
/** how long the job waits for the deploy to show, and how often it looks */
export const WAIT_MS = 15 * 60 * 1000;
export const POLL_MS = 20 * 1000;

/** what dist/indexnow.json holds */
export interface Manifest {
  /** the commit the build was made from, so the job knows its own deploy; null when the build could not tell */
  commit: string | null;
  /** every sitemap URL, with the hash of its page */
  pages: Record<string, string>;
}

// ---- the build --------------------------------------------------------------

/** a file's text by its path inside a folder (public/, dist/), or null when there is no such file */
export type ReadFile = (path: string) => string | null;

/** the IndexNow key, out of a folder's file names: the one key file's name, which must hold the key and nothing else */
export function keyFrom(names: string[], read: ReadFile): string {
  const found = names.flatMap((name) => {
    const m = KEY_FILE.exec(name);
    return m ? [m[1]] : [];
  });
  if (found.length !== 1) throw new Error(`expected one IndexNow key file (<32 hex digits>.txt), found ${found.length}`);
  const key = found[0];
  if (read(`${key}.txt`) !== key) throw new Error(`${key}.txt must hold its key and nothing else`);
  return key;
}

/** where IndexNow fetches the key to check it */
export const keyLocation = (key: string) => `${SITE}/${key}.txt`;

/**
 * The hash of a built page: SHA-256 of its HTML, the first 16 hex digits.
 * The fingerprints Vite puts in the names of the scripts and styles under
 * /assets/ (index-CCtYCYTJ.js) are left out first: they change with any
 * change to the app's code, which changes nothing a search engine reads on
 * the home pages, and would send them on every deploy.
 */
export async function pageHash(html: string): Promise<string> {
  const steady = html.replace(/(\/assets\/[^"'\s?#]*?)-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)/g, '$1$2');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(steady)));
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** the URLs a sitemap lists, in its order */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) =>
    m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  );
}

/** the built files that may answer a URL of the site, inside dist/: /learn/x-wing/ is learn/x-wing/index.html */
export function filesOf(url: string): string[] {
  if (!url.startsWith(`${SITE}/`)) throw new Error(`${url} is not on ${SITE}`);
  const path = decodeURIComponent(new URL(url).pathname).slice(1);
  return path === '' || path.endsWith('/') ? [`${path}index.html`] : [path, `${path}.html`, `${path}/index.html`];
}

/** the list for a built site, read from dist/: every sitemap URL and the hash of its page */
export async function buildManifest(read: ReadFile, commit: string | null): Promise<Manifest> {
  const sitemap = read('sitemap.xml');
  if (sitemap === null) throw new Error('dist/sitemap.xml not found');
  const urls = sitemapUrls(sitemap);
  if (urls.length === 0) throw new Error('dist/sitemap.xml lists no URL');
  const pages: Record<string, string> = {};
  for (const url of urls) {
    const html = filesOf(url).map(read).find((text) => text !== null);
    if (html === undefined || html === null) throw new Error(`the sitemap lists ${url}, but the build wrote no page for it`);
    pages[url] = await pageHash(html);
  }
  return { commit, pages };
}

// ---- the job ----------------------------------------------------------------

/** a list read back, or null for anything that is not one (a 404 page, a cut-off file, nothing) */
export function parseManifest(text: string | null | undefined): Manifest | null {
  if (!text) return null;
  try {
    const m = JSON.parse(text) as unknown;
    if (!m || typeof m !== 'object') return null;
    const { commit, pages } = m as { commit?: unknown; pages?: unknown };
    if (commit !== null && typeof commit !== 'string') return null;
    if (!pages || typeof pages !== 'object' || Array.isArray(pages)) return null;
    const entries = Object.entries(pages as Record<string, unknown>);
    if (entries.length === 0 || entries.some(([url, hash]) => !url.startsWith(`${SITE}/`) || typeof hash !== 'string')) return null;
    return { commit, pages: Object.fromEntries(entries) as Record<string, string> };
  } catch {
    return null;
  }
}

/** two commits are the same one, either written in full or short (seven digits or more) */
export function sameCommit(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length < 7 || b.length < 7) return false;
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * Whether the live list is the pushed commit's: it names that commit. A
 * build that could not tell its commit (null) is taken as the deploy once
 * its pages differ from the list before it; one that changed no page has
 * nothing to send anyway.
 */
export function isDeployed(live: Manifest | null, commit: string, old: Manifest | null): boolean {
  if (!live) return false;
  if (live.commit) return sameCommit(live.commit, commit);
  return !old || JSON.stringify(live.pages) !== JSON.stringify(old.pages);
}

/**
 * The URLs to send: those of the new list that the old one lacks or hashed
 * differently, in the new list's (the sitemap's) order, at most MAX_URLS.
 * A page that left the sitemap is not sent: its address answers 404 and
 * the crawlers find that out by themselves. With no old list to compare
 * with (the first deploy with one, or a read that failed), only the home
 * pages go, rather than every page at once.
 */
export function urlsToSubmit(old: Manifest | null, next: Manifest): string[] {
  const urls = old ? Object.keys(next.pages).filter((url) => old.pages[url] !== next.pages[url]) : HOME_URLS.filter((url) => url in next.pages);
  return urls.slice(0, MAX_URLS);
}

/** the body IndexNow takes */
export function submission(key: string, urls: string[]) {
  return { host: HOST, key, keyLocation: keyLocation(key), urlList: urls.slice(0, MAX_URLS) };
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface SubmitOptions {
  /** the live indexnow.json as the job read it before the deploy, or null if it could not */
  oldText: string | null;
  /** the pushed commit (GITHUB_SHA) */
  commit: string;
  key: string;
  fetch: Fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  log: (line: string) => void;
  /** do everything but send */
  dryRun?: boolean;
  waitMs?: number;
  pollMs?: number;
}

/** what a run did, for its log and its tests */
export interface SubmitOutcome {
  /** the URLs sent, or that would have been on a dry run; empty when nothing went */
  urls: string[];
  /** IndexNow's answer, when something was sent */
  status?: number;
  /** why it stopped where it did, in a line */
  reason: string;
}

/** the live list, read past every cache; null when it cannot be read */
async function readLive(fetch: Fetch, commit: string): Promise<Manifest | null> {
  try {
    const res = await fetch(`${SITE}/${MANIFEST_FILE}?commit=${encodeURIComponent(commit)}&t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' }
    });
    return res.ok ? parseManifest(await res.text()) : null;
  } catch {
    return null;
  }
}

/**
 * One push's submission: waits until the site serves the pushed commit's
 * list (up to waitMs, looking every pollMs), compares it with the list from
 * before the deploy, and sends the new and changed URLs. Never throws:
 * every way it can end is an outcome with a reason.
 */
export async function submitChanges(o: SubmitOptions): Promise<SubmitOutcome> {
  const waitMs = o.waitMs ?? WAIT_MS;
  const pollMs = o.pollMs ?? POLL_MS;
  const done = (outcome: SubmitOutcome) => (o.log(outcome.reason), outcome);
  try {
    const old = parseManifest(o.oldText);
    o.log(old ? `before the deploy: ${Object.keys(old.pages).length} pages, commit ${old.commit ?? 'unknown'}` : 'before the deploy: no list could be read; only the home pages will go');
    if (old && sameCommit(old.commit, o.commit)) return done({ urls: [], reason: 'the site already served this commit before the job looked: nothing to compare with, nothing sent' });
    const until = o.now() + waitMs;
    let live = await readLive(o.fetch, o.commit);
    while (!isDeployed(live, o.commit, old)) {
      if (o.now() + pollMs > until) return done({ urls: [], reason: `the deploy of ${o.commit.slice(0, 7)} did not show within ${Math.round(waitMs / 60000)} minutes: nothing sent` });
      await o.sleep(pollMs);
      live = await readLive(o.fetch, o.commit);
    }
    const urls = urlsToSubmit(old, live!);
    if (urls.length === 0) return done({ urls, reason: 'deployed; no page is new or changed: nothing sent' });
    o.log(`deployed; ${urls.length} new or changed:\n  ${urls.join('\n  ')}`);
    // the key file must be live for IndexNow to accept the key; say so if it is not
    try {
      const res = await o.fetch(keyLocation(o.key), { cache: 'no-store' });
      const text = res.ok ? (await res.text()).trim() : '';
      if (text !== o.key) o.log(`warning: ${keyLocation(o.key)} does not answer with the key (HTTP ${res.status}); IndexNow will refuse it`);
    } catch {
      o.log(`warning: ${keyLocation(o.key)} could not be read`);
    }
    const body = submission(o.key, urls);
    if (o.dryRun) return done({ urls, reason: `dry run: would send ${urls.length} URLs to ${ENDPOINT}\n${JSON.stringify(body, null, 2)}` });
    const res = await o.fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body)
    });
    const answer = (await res.text().catch(() => '')).trim().slice(0, 500);
    // 200: received; 202: received, the key still being checked
    const ok = res.status === 200 || res.status === 202;
    return done({
      urls,
      status: res.status,
      reason: `${ok ? 'sent' : 'IndexNow refused'} ${urls.length} URLs: HTTP ${res.status}${answer ? ` ${answer}` : ''}`
    });
  } catch (err) {
    return done({ urls: [], reason: `stopped: ${err instanceof Error ? err.message : String(err)}; nothing more sent` });
  }
}
