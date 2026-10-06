/**
 * The Worker in front of sudokui.app (wrangler.jsonc, "main"). The site is
 * still static: a request that matches a file in dist/ is answered by
 * Cloudflare's asset hosting before this code runs, free and uncounted.
 * This runs only for the paths that are not files, and today it knows one
 * kind: the share address of a puzzle, /p/<81 cells> under any language
 * root (src/content/share.ts). It answers it with the app's own shell,
 * whose head describes the puzzle so a chat app or a crawler unfurls a
 * proper preview; the app then boots from the path as it does from the
 * home page. Everything else goes back to the assets, which answer with
 * the 404 page of the nearest language.
 *
 * Budget (docs/online-goals.md): one invocation per share landing, one
 * asset fetch and a string fill, well under the free plan's 10 ms of CPU.
 * No database, no identifier, nothing stored.
 */
import { parseShareUrl, renderSharePage } from '../src/content/share';

/** what wrangler.jsonc binds: the static assets in dist/ */
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

/** the built app shell with its placeholders intact (vite.config.ts, homePages) */
export const SHARE_TEMPLATE = '/share.tpl';

/** how long a chat app or a browser may keep a share page */
const CACHE_CONTROL = 'public, max-age=3600';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const share = request.method === 'GET' || request.method === 'HEAD' ? parseShareUrl(url) : null;
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
  fetch: handleRequest
};
