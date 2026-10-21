/**
 * The Worker in front of sudokui.app (wrangler.jsonc, "main"). The site is
 * still static: a request that matches a file in dist/ is answered by
 * Cloudflare's asset hosting before this code runs, free and uncounted.
 * This runs only for the paths that are not files, and it knows three
 * kinds:
 *
 * - the share address of a puzzle, /p/<81 cells> under any language root
 *   (src/content/share.ts), and the address of a published daily,
 *   /daily/<date> (src/content/dailies.ts): answered with the app's own
 *   shell, whose head describes the puzzle so a chat app or a crawler
 *   unfurls a proper preview; the app then boots from the path as it does
 *   from the home page;
 * - the daily's API, /api/daily/<n>/stats and /api/daily/<n>/result
 *   (worker/daily.ts), over D1 when it is bound and its tables exist, and
 *   answering 503 otherwise, so play is never affected;
 * - the telemetry route, POST /api/t (worker/telemetry.ts): the app's
 *   counts of games started and solved, written to Workers Analytics
 *   Engine; a share address counts a landing there too when a person
 *   arrives from outside the site;
 * - the private dashboard, /admin (worker/admin.ts), behind Cloudflare
 *   Access, reading those counts back; a 404 until its secrets are set,
 *   and for any request without a valid Access token (worker/access.ts).
 *
 * Everything else goes back to the assets, which answer with the 404
 * page of the nearest language.
 *
 * Budget (docs/online-goals.md): one invocation per share landing, one
 * asset fetch and a string fill; one invocation and one bounded D1 read
 * per statistics request (edge-cached a minute), two writes and one read
 * per submitted result; one invocation and at most 25 data points per
 * telemetry batch. No identifier, no cookie, nothing stored that names a
 * player.
 */
import { shareParamsOf, renderSharePage } from '../src/content/share';
import dailies from '../src/content/dailies.json';
import type { Daily } from '../src/content/dailies';
import { handleDailyApi, d1Store, D1Like } from './daily';
import { handleTelemetry, countLanding, AnalyticsEngineLike } from './telemetry';
import { handleAdmin, ADMIN_PATH, AdminOptions } from './admin';

/**
 * What wrangler.jsonc binds: the static assets in dist/, the database, the
 * analytics dataset; and the dashboard's four secrets, set by hand
 * (docs/connect-the-analytics.md): the SQL API's account id and token, and
 * the Access team domain and application AUD tag that its visitors'
 * tokens are checked against
 */
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1Like;
  EVENTS?: AnalyticsEngineLike;
  ADMIN_ACCOUNT_ID?: string;
  ADMIN_TOKEN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

/** what the runtime hands a fetch handler besides the request and the bindings */
export interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

/** the built app shell with its placeholders intact (vite.config.ts, homePages) */
export const SHARE_TEMPLATE = '/share.tpl';

/**
 * A share page names the current build's hashed scripts, which a deploy
 * replaces, so a browser must ask again each time, as it does for the
 * app's own index.html; chat apps keep their previews on their own terms
 */
const CACHE_CONTROL = 'public, max-age=0, must-revalidate';

/** the edge cache, where the runtime has one (a custom domain); none on workers.dev or under test */
function edgeCache(): Cache | null {
  const c = (globalThis as { caches?: { default?: Cache } }).caches;
  return c && c.default ? c.default : null;
}

/** `admin` stands in for the dashboard's API and Access keys under test */
export async function handleRequest(request: Request, env: Env, ctx?: Context, admin?: AdminOptions): Promise<Response> {
  const api = await handleDailyApi(request, env.DB ? d1Store(env.DB) : null, {
    cache: edgeCache(),
    waitUntil: ctx ? (p) => ctx.waitUntil(p) : undefined
  });
  if (api) return api;
  const telemetry = await handleTelemetry(request, env.EVENTS ?? null);
  if (telemetry) return telemetry;

  const url = new URL(request.url);
  if (url.pathname === ADMIN_PATH || url.pathname === ADMIN_PATH + '/') {
    // without its secrets, or without a valid Access token, the dashboard is an unknown path
    return (await handleAdmin(request, env, admin)) ?? env.ASSETS.fetch(request);
  }
  const share = request.method === 'GET' || request.method === 'HEAD' ? shareParamsOf(url, dailies as Daily[]) : null;
  if (!share) return env.ASSETS.fetch(request);

  const template = await env.ASSETS.fetch(new Request(new URL(SHARE_TEMPLATE, url).toString(), { method: 'GET' }));
  // without the template there is no page to render; the assets' answer
  // (a 404) is still honest, and the app's hash links keep working
  if (!template.ok) return env.ASSETS.fetch(request);

  // a person arriving from outside the site is a landing, counted once
  countLanding(env.EVENTS, request, share);
  const html = renderSharePage(await template.text(), share);
  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': CACHE_CONTROL,
      // the <meta> says so too; this covers clients that read headers only
      'x-robots-tag': 'noindex'
    }
  });
}

export default {
  fetch: (request: Request, env: Env, ctx: Context) => handleRequest(request, env, ctx)
};
