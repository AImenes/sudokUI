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
 *   answering 503 otherwise, so play is never affected.
 *
 * Everything else goes back to the assets, which answer with the 404
 * page of the nearest language.
 *
 * Budget (docs/online-goals.md): one invocation per share landing, one
 * asset fetch and a string fill; one invocation and one bounded D1 read
 * per statistics request (edge-cached a minute), two writes and one read
 * per submitted result. No identifier, no cookie, nothing stored that
 * names a player.
 */
import { shareParamsOf, renderSharePage } from '../src/content/share';
import dailies from '../src/content/dailies.json';
import type { Daily } from '../src/content/dailies';
import { handleDailyApi, d1Store, D1Like } from './daily';

/** what wrangler.jsonc binds: the static assets in dist/, and the database once it is bound */
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1Like;
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

export async function handleRequest(request: Request, env: Env, ctx?: Context): Promise<Response> {
  const api = await handleDailyApi(request, env.DB ? d1Store(env.DB) : null, {
    cache: edgeCache(),
    waitUntil: ctx ? (p) => ctx.waitUntil(p) : undefined
  });
  if (api) return api;

  const url = new URL(request.url);
  const share = request.method === 'GET' || request.method === 'HEAD' ? shareParamsOf(url, dailies as Daily[]) : null;
  if (!share) return env.ASSETS.fetch(request);

  const template = await env.ASSETS.fetch(new Request(new URL(SHARE_TEMPLATE, url).toString(), { method: 'GET' }));
  // without the template there is no page to render; the assets' answer
  // (a 404) is still honest, and the app's hash links keep working
  if (!template.ok) return env.ASSETS.fetch(request);

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
