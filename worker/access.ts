/**
 * The lock on the private dashboard (admin.ts): a request reaches /admin
 * only if it carries a Cloudflare Access token for this one application,
 * and here the Worker checks that token itself rather than trusting the
 * header's presence. Access protects https://sudokui.app/admin, but the
 * same Worker could be reached on another address (a workers.dev
 * subdomain, a version's preview URL) where nothing stands in front of
 * it, and anyone can write a header.
 *
 * The token (the Cf-Access-Jwt-Assertion header, which Cloudflare's
 * documentation names over the CF_Authorization cookie) is a JWT signed
 * RS256 with one of the team's keys, published at
 * https://<team>.cloudflareaccess.com/cdn-cgi/access/certs. It passes when
 * its signature checks out under the key its header names, its issuer is
 * the team's domain, its audience holds the application's AUD tag, and it
 * has not expired. The team domain and the AUD tag are two Worker secrets,
 * ACCESS_TEAM_DOMAIN and ACCESS_AUD (docs/connect-the-analytics.md).
 *
 * WebCrypto only, no library. The keys are fetched once and kept for an
 * hour in the isolate, and never used older; a token naming a key not
 * among them (Access rotates its key every six weeks) fetches them again,
 * at most once a minute, so made-up key ids cannot turn every request
 * into a fetch. Nothing in the token is kept or shown: the answer is yes
 * or no.
 */

/** the header Access adds to every request it lets through */
export const ACCESS_HEADER = 'cf-access-jwt-assertion';

/** how long a fetched set of keys is used before it is fetched again */
export const KEYS_TTL_MS = 60 * 60 * 1000;
/** the shortest time between two fetches, whatever tokens arrive */
export const REFETCH_MIN_MS = 60 * 1000;
/** how far ahead of the Worker's clock a token's nbf may be (clock skew) */
export const NBF_LEEWAY_S = 60;

const TEAM = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The issuer for a team domain as the owner pastes it: `myteam`,
 * `myteam.cloudflareaccess.com` or `https://myteam.cloudflareaccess.com/`
 * all name https://myteam.cloudflareaccess.com. Anything else is null, so
 * the keys are never fetched from a host that is not Access's.
 */
export function accessIssuer(teamDomain: string | undefined): string | null {
  if (!teamDomain) return null;
  let s = teamDomain.trim().toLowerCase();
  if (s.startsWith('https://')) s = s.slice('https://'.length);
  if (s.endsWith('/')) s = s.slice(0, -1);
  if (s.endsWith('.cloudflareaccess.com')) s = s.slice(0, -'.cloudflareaccess.com'.length);
  return TEAM.test(s) ? `https://${s}.cloudflareaccess.com` : null;
}

/** where a team publishes its signing keys */
export const certsUrl = (issuer: string) => `${issuer}/cdn-cgi/access/certs`;

/** the keys a team signs with, looked up by the id a token's header gives */
export interface AccessKeys {
  key(issuer: string, kid: string): Promise<CryptoKey | null>;
}

const RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

/** the RSA signing keys of a certs answer ({ keys: [JWK, ...] }), by id; anything else is left out */
async function importKeys(answer: unknown): Promise<Map<string, CryptoKey>> {
  const keys = new Map<string, CryptoKey>();
  const list = (answer as { keys?: unknown })?.keys;
  if (!Array.isArray(list)) return keys;
  for (const k of list) {
    if (!k || typeof k !== 'object') continue;
    const { kid, kty, alg, use, n, e } = k as Record<string, unknown>;
    if (typeof kid !== 'string' || kty !== 'RSA' || typeof n !== 'string' || typeof e !== 'string') continue;
    if (alg !== undefined && alg !== 'RS256') continue;
    if (use !== undefined && use !== 'sig') continue;
    try {
      keys.set(kid, await crypto.subtle.importKey('jwk', { kty: 'RSA', n, e, alg: 'RS256', ext: true }, RS256, false, ['verify']));
    } catch {
      // a key WebCrypto cannot read verifies nothing
    }
  }
  return keys;
}

export interface AccessKeysOptions {
  /** how the certs are fetched, for tests */
  fetch?: typeof fetch;
  /** the clock in milliseconds, for tests */
  now?: () => number;
}

/**
 * A cache of the teams' keys. The Worker keeps one per isolate
 * (admin.ts); the tests make their own with a fetch of their own.
 */
export function accessKeys(options: AccessKeysOptions = {}): AccessKeys {
  // called bare, never as a method: the runtime's fetch refuses another `this`
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const now = options.now ?? Date.now;
  // per team: the keys, when they were fetched, and when a fetch was last
  // tried for a key id they lack
  const teams = new Map<string, { keys: Map<string, CryptoKey>; at: number; tried: number }>();
  const fresh = (team: { at: number }) => now() - team.at < KEYS_TTL_MS;

  // Each request that needs the keys fetches them itself: a fetch begun by
  // one request and awaited by another can hang in the Workers runtime
  async function load(issuer: string, team: { keys: Map<string, CryptoKey>; at: number }) {
    try {
      const res = await doFetch(certsUrl(issuer), { headers: { accept: 'application/json' } });
      if (!res.ok) return;
      const keys = await importKeys(await res.json());
      if (keys.size === 0) return;
      team.keys = keys;
      team.at = now();
    } catch {
      // unreachable or unreadable: the keys held so far stay, until they expire
    }
  }

  return {
    async key(issuer, kid) {
      let team = teams.get(issuer);
      if (!team) {
        team = { keys: new Map(), at: -Infinity, tried: -Infinity };
        teams.set(issuer, team);
      }
      if (!fresh(team)) {
        // none yet, or an hour old: fetch, and use nothing older
        await load(issuer, team);
      } else if (!team.keys.has(kid) && now() - team.tried >= REFETCH_MIN_MS) {
        // perhaps a key newer than the ones held
        team.tried = now();
        await load(issuer, team);
      }
      return fresh(team) ? team.keys.get(kid) ?? null : null;
    }
  };
}

const bytes = (s: string) => new TextEncoder().encode(s);

/** base64url to bytes, or null if it is not base64url */
function unbase64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** a JSON object from a base64url segment, or null */
function segment(s: string): Record<string, unknown> | null {
  const b = unbase64url(s);
  if (!b) return null;
  try {
    const v: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface AccessConfig {
  /** https://<team>.cloudflareaccess.com (accessIssuer) */
  issuer: string;
  /** the Access application's AUD tag */
  aud: string;
}

/**
 * Whether a token is one Access issued for this application and still
 * valid: RS256 under the team key its header names, the issuer, the
 * audience, the expiry (and the not-before time if it has one). Any
 * doubt is a no.
 */
export async function verifyAccessToken(token: string, config: AccessConfig, keys: AccessKeys, now: Date): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => p === '')) return false;
  const [h, p, s] = parts;
  const header = segment(h);
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid === '') return false;
  const claims = segment(p);
  const signature = unbase64url(s);
  if (!claims || !signature) return false;

  const t = now.getTime() / 1000;
  if (claims.iss !== config.issuer) return false;
  const aud = claims.aud;
  if (!(aud === config.aud || (Array.isArray(aud) && aud.includes(config.aud)))) return false;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || t >= claims.exp) return false;
  if (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || t + NBF_LEEWAY_S < claims.nbf)) return false;

  const key = await keys.key(config.issuer, header.kid);
  if (!key) return false;
  try {
    return await crypto.subtle.verify(RS256, key, signature, bytes(`${h}.${p}`));
  } catch {
    return false;
  }
}

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

/**
 * Whether the request came through Access for this application. False
 * when either secret is missing or malformed, when there is no token, or
 * when the token fails any check.
 */
export async function cameThroughAccess(request: Request, env: AccessEnv, keys: AccessKeys, now: Date): Promise<boolean> {
  const issuer = accessIssuer(env.ACCESS_TEAM_DOMAIN);
  const aud = env.ACCESS_AUD?.trim();
  if (!issuer || !aud) return false;
  const token = request.headers.get(ACCESS_HEADER);
  if (!token) return false;
  return verifyAccessToken(token.trim(), { issuer, aud }, keys, now);
}
