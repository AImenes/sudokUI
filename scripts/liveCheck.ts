// The live-site check (.github/workflows/live-check.yml; docs/deployment.md,
// "The live-site check"): each morning, and a few minutes after every push
// to main once Cloudflare has deployed it, the pages a player or a chat
// app reaches first are asked for, with GET requests only, and each must
// answer 200, carry the og:image it should, and carry noindex where the
// site sets it and nowhere else:
//
//   - the home pages in en, nb and es;
//   - the advent calendar's three public pages;
//   - today's daily's address (the UTC date);
//   - one /p/ share link (the first published daily's puzzle, as a plain
//     puzzle with its band and rating);
//   - from 1 to 24 December, today's door in the three languages, each with
//     the door's own picture.
//
// The og:image each must carry is worked out from the same modules the
// Worker and the build render the pages with (src/content/share.ts,
// home.ts, adventPage.ts), at the commit being checked, and each picture
// named is asked for too: it must be a PNG.
//
// Its requests are never counted as landings: they carry LIVE_CHECK_AGENT,
// a User-Agent that does not start with Mozilla/, which the Worker counts
// as no person (worker/telemetry.ts, isPersonAgent), so no landing is
// written for them (tests/liveCheck.test.ts holds that against the Worker
// itself). They ask for pages and pictures only: never /api/, never a POST.
import { SITE, homePath, ogCard } from '../src/content/home';
import type { Lang } from '../src/state/settings';
import { shareParamsOf, shareCopy, sharePath, ogDoorPicture } from '../src/content/share';
import { dailyPath, EARLY_DAYS } from '../src/content/dailies';
import type { Daily } from '../src/content/dailies';
import { adventPath, calendarYears } from '../src/content/advent';
import type { AdventDoor } from '../src/content/advent';
import { ADVENT_URLS } from '../src/content/staticRoutes';
import { adventCardPath } from '../src/content/adventPage';
import { doorOf, seasonYear } from '../src/content/season';
import { MANIFEST_FILE, parseManifest, sameCommit } from './indexnow';
import dailiesJson from '../src/content/dailies.json';
import adventJson from '../src/content/advent.json';

/** the User-Agent of every request the check sends: no browser's (no Mozilla/), so the Worker counts none of them as a landing */
export const LIVE_CHECK_AGENT = 'sudokui-live-check/1.0 (+https://github.com; GET only; not a person)';

const LANGS: Lang[] = ['en', 'nb', 'es'];
const dailies = dailiesJson as Daily[];
const doors = adventJson as AdventDoor[];

/** one page to ask for, and what it must carry */
export interface LivePage {
  /** what it is, for the log: "home (nb)", "door 5 (es)" */
  name: string;
  path: string;
  /** the og:image it must carry, in full */
  ogImage: string;
  /** whether it must say noindex (a share page does; a home page or the calendar's page must not) */
  noindex: boolean;
}

/** the day after a date key: the Worker opens a daily or a door a day ahead of UTC (EARLY_DAYS), for the player furthest ahead */
const dayAfter = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** a share address's page as the Worker renders it (worker/index.ts): its og:image, from the same module */
function sharePage(name: string, path: string, today: string): LivePage {
  const url = new URL(path, SITE);
  const params = shareParamsOf({ pathname: url.pathname, search: url.search }, dailies, doors, dayAfter(today, EARLY_DAYS));
  if (!params) throw new Error(`${path} is no share address`);
  return { name, path, ogImage: shareCopy(params).ogImage, noindex: true };
}

/** the pages the check asks for on a day (a UTC date key, 2026-12-05) */
export function livePages(today: string): LivePage[] {
  const pages: LivePage[] = LANGS.map((lang) => ({ name: `home (${lang})`, path: homePath(lang), ogImage: ogCard(lang), noindex: false }));
  // the calendar's public page shows the latest calendar the build has
  const year = calendarYears(doors).at(-1);
  if (year)
    for (const lang of LANGS) pages.push({ name: `advent calendar page (${lang})`, path: ADVENT_URLS[lang], ogImage: SITE + adventCardPath(lang, year), noindex: false });
  pages.push(sharePage(`today's daily (${today})`, dailyPath('en', today), today));
  const first = dailies[0];
  pages.push(sharePage('a /p/ share link', sharePath({ lang: 'en', puzzle: first.puzzle, level: first.level, score: first.score }), today));
  const door = doorOf(today);
  const season = seasonYear(today);
  if (door && season && calendarYears(doors).includes(season))
    for (const lang of LANGS) {
      const page = sharePage(`door ${door} (${lang})`, adventPath(lang, season, door), today);
      // a door shows the picture behind it, its own
      if (page.ogImage !== ogDoorPicture(door)) throw new Error(`door ${door}'s page would not show its own picture: ${page.ogImage}`);
      pages.push(page);
    }
  return pages;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** the content of a <meta> by its property or name, or null */
export function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const named = new RegExp(`\\b(?:property|name)\\s*=\\s*"${key.replace(/[.:]/g, '\\$&')}"`, 'i').test(tag);
    if (!named) continue;
    const content = /\bcontent\s*=\s*"([^"]*)"/i.exec(tag);
    return content ? content[1].replace(/&amp;/g, '&') : '';
  }
  return null;
}

/** a page says noindex: in its robots meta, or in the X-Robots-Tag header */
export const saysNoindex = (html: string, headers: Headers) =>
  /noindex/i.test(metaContent(html, 'robots') ?? '') || /noindex/i.test(headers.get('x-robots-tag') ?? '');

/**
 * A GET with the check's own User-Agent, past every cache, following no
 * redirect: the page must answer itself. A page is asked for as a click
 * asks for it, a navigation (Sec-Fetch-Mode: navigate): the asset hosting
 * answers a navigation to a path that is no file with its 404 page before
 * the Worker runs, unless wrangler.jsonc's run_worker_first lists the path
 * (docs/deployment.md, "Checking a deploy"), and a plain request would not
 * see that. The User-Agent alone keeps it from being a landing.
 */
const get = (fetch: Fetch, url: string, page = false) =>
  fetch(url, {
    method: 'GET',
    redirect: 'manual',
    cache: 'no-store',
    headers: {
      'user-agent': LIVE_CHECK_AGENT,
      'cache-control': 'no-cache',
      ...(page ? { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } : {})
    }
  });

/** what is wrong with one page, in lines; empty when nothing is */
export async function checkPage(fetch: Fetch, base: string, page: LivePage): Promise<string[]> {
  const where = `${page.name}, ${page.path}`;
  let res: Response;
  try {
    res = await get(fetch, base + page.path, true);
  } catch (err) {
    return [`${where}: no answer (${err instanceof Error ? err.message : String(err)})`];
  }
  if (res.status !== 200) return [`${where}: answered ${res.status}, not 200`];
  const html = await res.text();
  const problems: string[] = [];
  const image = metaContent(html, 'og:image');
  if (image !== page.ogImage) problems.push(`${where}: og:image is ${image === null ? 'missing' : `"${image}"`}, not "${page.ogImage}"`);
  const noindex = saysNoindex(html, res.headers);
  if (noindex !== page.noindex) problems.push(`${where}: ${page.noindex ? 'does not say noindex' : 'says noindex, and should not'}`);
  return problems;
}

/** what is wrong with a picture: it must answer 200 as a PNG */
export async function checkImage(fetch: Fetch, base: string, image: string): Promise<string[]> {
  // a picture is named on the site's own address; a check of another base asks that base for it
  const url = image.startsWith(SITE) ? base + image.slice(SITE.length) : image;
  try {
    const res = await get(fetch, url);
    const type = res.headers.get('content-type') ?? '';
    if (res.status !== 200) return [`the picture ${image}: answered ${res.status}, not 200`];
    if (!type.startsWith('image/png')) return [`the picture ${image}: served as "${type}", not image/png`];
    return [];
  } catch (err) {
    return [`the picture ${image}: no answer (${err instanceof Error ? err.message : String(err)})`];
  }
}

export interface LiveCheckOptions {
  fetch: Fetch;
  /** the UTC date key the check is for */
  today: string;
  /** the site's address: https://sudokui.app, or a local server's in a test */
  base?: string;
  log?: (line: string) => void;
}

/** every page and every picture they name; the problems found, empty when the site is as it should be */
export async function runLiveCheck(o: LiveCheckOptions): Promise<string[]> {
  const base = o.base ?? SITE;
  const log = o.log ?? (() => {});
  const pages = livePages(o.today);
  const problems: string[] = [];
  for (const page of pages) {
    const found = await checkPage(o.fetch, base, page);
    log(`${found.length ? 'FAIL' : 'ok  '} ${page.name}: ${page.path}`);
    problems.push(...found);
  }
  for (const image of [...new Set(pages.map((p) => p.ogImage))]) {
    const found = await checkImage(o.fetch, base, image);
    log(`${found.length ? 'FAIL' : 'ok  '} picture ${image}`);
    problems.push(...found);
  }
  return problems;
}

/** how long a push's check waits for Cloudflare's deploy to show, and how often it looks */
export const DEPLOY_WAIT_MS = 20 * 60 * 1000;
export const DEPLOY_POLL_MS = 30 * 1000;

export interface DeployWait {
  fetch: Fetch;
  /** the pushed commit (GITHUB_SHA) */
  commit: string;
  base?: string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  log?: (line: string) => void;
  waitMs?: number;
  pollMs?: number;
}

/**
 * After a push: wait until the site serves the pushed commit's build, read
 * from the commit its indexnow.json names (scripts/indexnow.ts; a file of
 * the assets, which the Worker never sees, so no landing either). True
 * once it does, or once a newer build than the one first seen is live (a
 * later push deployed over it, and that one is checked); false when
 * nothing changed in the time allowed, which fails the job: a push that
 * never went live is worth a mail.
 */
export async function waitForDeploy(o: DeployWait): Promise<boolean> {
  const base = o.base ?? SITE;
  const log = o.log ?? (() => {});
  const waitMs = o.waitMs ?? DEPLOY_WAIT_MS;
  const pollMs = o.pollMs ?? DEPLOY_POLL_MS;
  const start = o.now();
  let first: string | null | undefined;
  for (;;) {
    let live: string | null = null;
    try {
      const res = await get(o.fetch, `${base}/${MANIFEST_FILE}?commit=${encodeURIComponent(o.commit)}&t=${o.now()}`);
      live = res.ok ? (parseManifest(await res.text())?.commit ?? null) : null;
    } catch {
      live = null;
    }
    if (sameCommit(live, o.commit)) {
      log(`the site serves ${o.commit.slice(0, 7)}`);
      return true;
    }
    if (first === undefined) first = live;
    else if (live && live !== first) {
      log(`the site moved on to ${live.slice(0, 7)}, a later push: checking that`);
      return true;
    }
    if (o.now() - start >= waitMs) {
      log(`the site still serves ${live?.slice(0, 7) ?? 'no readable build'} after ${Math.round(waitMs / 60_000)} minutes, not ${o.commit.slice(0, 7)}`);
      return false;
    }
    await o.sleep(pollMs);
  }
}
