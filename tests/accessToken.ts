/**
 * A stand-in for Cloudflare Access in the tests: RSA key pairs made here,
 * tokens signed RS256 the way Access signs them (the header names the key
 * by its kid; the payload has the team as issuer and the application's
 * AUD tag in an array), and the team's certs endpoint answering with the
 * public halves. Not a test file itself: tests/access.test.ts and the
 * dashboard's tests in tests/telemetry.test.ts use it.
 */
import { certsUrl, type AccessKeys, accessKeys } from '../worker/access';

export const TEAM_DOMAIN = 'sudokui-test.cloudflareaccess.com';
export const ISSUER = 'https://sudokui-test.cloudflareaccess.com';
export const AUD = '32eafc7626e974616deaf0dc3ce63d7bcbed58a2731e84d06bc3cdf1b53c4228';
/** the two secrets the dashboard checks tokens against */
export const ACCESS_SECRETS = { ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, ACCESS_AUD: AUD };

const RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

/** bytes or text as base64url, without padding */
export function base64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface Signer {
  kid: string;
  /** the public key as the certs endpoint lists it */
  jwk: JsonWebKey & { kid: string };
  /** a token over these claims; the header defaults to Access's own */
  sign(claims: Record<string, unknown>, header?: Record<string, unknown>): Promise<string>;
}

/** a fresh RSA key pair, named kid */
export async function signer(kid: string): Promise<Signer> {
  const pair = (await crypto.subtle.generateKey({ ...RS256, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return {
    kid,
    jwk: { kty: 'RSA', n: pub.n, e: pub.e, kid, alg: 'RS256', use: 'sig' },
    async sign(claims, header = { alg: 'RS256', kid, typ: 'JWT' }) {
      const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
      const sig = new Uint8Array(await crypto.subtle.sign(RS256, pair.privateKey, new TextEncoder().encode(input)));
      return `${input}.${base64url(sig)}`;
    }
  };
}

/** the claims Access puts in a token for this application, issued a minute before `now` and valid ten more */
export function claimsAt(now: Date, over: Record<string, unknown> = {}): Record<string, unknown> {
  const t = Math.floor(now.getTime() / 1000);
  return {
    aud: [AUD],
    email: 'owner@example.com',
    exp: t + 600,
    iat: t - 60,
    nbf: t - 60,
    iss: ISSUER,
    type: 'app',
    identity_nonce: '6ei69kawdKzMIAPF',
    sub: '7335d417-61da-459d-899c-0a01c76a2f94',
    country: 'NO',
    ...over
  };
}

/**
 * The team's certs endpoint, answering with the public keys of whichever
 * signers `published()` names at the time (so a test can rotate them),
 * and counting the fetches; `down` makes it fail.
 */
export function certsEndpoint(published: () => Signer[]) {
  const calls: string[] = [];
  const state = { down: false };
  const answer = (async (url: string | URL | Request) => {
    calls.push(String(url));
    if (state.down) throw new Error('fetch failed');
    if (String(url) !== certsUrl(ISSUER)) return new Response('not found', { status: 404 });
    const keys = published().map((s) => s.jwk);
    return new Response(JSON.stringify({ keys, public_cert: { kid: keys[0]?.kid, cert: '-----BEGIN CERTIFICATE-----' }, public_certs: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }) as typeof fetch;
  return { calls, state, fetch: answer };
}

/** a key cache over the stand-in endpoint, with a clock of the test's */
export function keysOver(endpoint: { fetch: typeof fetch }, now: () => number = () => Date.now()): AccessKeys {
  return accessKeys({ fetch: endpoint.fetch, now });
}
