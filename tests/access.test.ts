/**
 * The lock on the dashboard (worker/access.ts): a Cloudflare Access token
 * passes only with a good RS256 signature under one of the team's
 * published keys, the team as issuer, this application's AUD tag in its
 * audience, and time left before it expires. Key pairs are made here
 * (tests/accessToken.ts), so nothing reaches Cloudflare.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  accessIssuer,
  accessKeys,
  certsUrl,
  cameThroughAccess,
  verifyAccessToken,
  ACCESS_HEADER,
  KEYS_TTL_MS,
  REFETCH_MIN_MS,
  NBF_LEEWAY_S
} from '../worker/access';
import { ACCESS_SECRETS, AUD, ISSUER, TEAM_DOMAIN, base64url, certsEndpoint, claimsAt, keysOver, signer, type Signer } from './accessToken';

const NOW = new Date('2026-10-21T20:00:00Z');
const T = NOW.getTime() / 1000;
const CONFIG = { issuer: ISSUER, aud: AUD };

let team: Signer;
let next: Signer;
let stranger: Signer;
beforeAll(async () => {
  team = await signer('9338abe1baf2fe492f646a736f25afbf7b025e35c627be4f60c414d4c73069b8');
  next = await signer('c2f1d0e9b8a7968574635241302f1e0d9c8b7a69584736251403f2e1d0c9b8a7');
  // a key pair of someone else's, claiming the team's key id
  stranger = await signer(team.kid);
});

/** whether a token passes, against keys the team publishes now */
async function passes(token: string, published: () => Signer[] = () => [team]) {
  return verifyAccessToken(token, CONFIG, keysOver(certsEndpoint(published), () => NOW.getTime()), NOW);
}

describe('the team domain', () => {
  it('names the issuer however the owner pastes it', () => {
    for (const s of ['sudokui-test', 'sudokui-test.cloudflareaccess.com', 'https://sudokui-test.cloudflareaccess.com', 'https://sudokui-test.cloudflareaccess.com/', ' Sudokui-Test.cloudflareaccess.com \n']) {
      expect(accessIssuer(s)).toBe(ISSUER);
    }
    expect(certsUrl(ISSUER)).toBe('https://sudokui-test.cloudflareaccess.com/cdn-cgi/access/certs');
  });

  it('is never a host outside Access, so the keys come from nowhere else', () => {
    for (const s of [undefined, '', 'https://evil.example', 'evil.example', 'sudokui-test.cloudflareaccess.com.evil.example', 'a.b.cloudflareaccess.com', 'http://sudokui-test.cloudflareaccess.com', 'sudokui-test.cloudflareaccess.com/x', '-bad-', 'sudokui_test']) {
      expect(accessIssuer(s)).toBeNull();
    }
  });
});

describe('an Access token', () => {
  it('passes when Access signed it for this application and it has not expired', async () => {
    expect(await passes(await team.sign(claimsAt(NOW)))).toBe(true);
    // aud as a single string, as some JWTs carry it
    expect(await passes(await team.sign(claimsAt(NOW, { aud: AUD })))).toBe(true);
    // among other applications' tags
    expect(await passes(await team.sign(claimsAt(NOW, { aud: ['another-app', AUD] })))).toBe(true);
    // without nbf
    expect(await passes(await team.sign(claimsAt(NOW, { nbf: undefined })))).toBe(true);
  });

  it('fails with a signature that is not the team key’s', async () => {
    // signed by another key pair under the team's key id
    expect(await passes(await stranger.sign(claimsAt(NOW)))).toBe(false);
    // the team's signature over other claims: an altered payload
    const [h, , s] = (await team.sign(claimsAt(NOW))).split('.');
    const forged = base64url(JSON.stringify(claimsAt(NOW, { email: 'someone@example.com' })));
    expect(await passes(`${h}.${forged}.${s}`)).toBe(false);
    // one bit of the signature flipped
    const good = await team.sign(claimsAt(NOW));
    const sig = good.split('.')[2];
    const flipped = sig.slice(0, 10) + (sig[10] === 'A' ? 'B' : 'A') + sig.slice(11);
    expect(await passes(good.replace(sig, flipped))).toBe(false);
    // a key the team does not publish
    expect(await passes(await next.sign(claimsAt(NOW)))).toBe(false);
  });

  it('fails for another application, another team, or without an audience', async () => {
    expect(await passes(await team.sign(claimsAt(NOW, { aud: ['another-app'] })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { aud: AUD.slice(0, -1) })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { aud: [] })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { aud: undefined })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { aud: [[AUD]] })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { iss: 'https://other-team.cloudflareaccess.com' })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { iss: ISSUER + '/' })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { iss: undefined })))).toBe(false);
  });

  it('fails once expired, and before it is valid', async () => {
    expect(await passes(await team.sign(claimsAt(NOW, { exp: T - 1 })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { exp: T })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { exp: T + 1 })))).toBe(true);
    expect(await passes(await team.sign(claimsAt(NOW, { exp: undefined })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { exp: String(T + 600) })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { nbf: T + NBF_LEEWAY_S + 1 })))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW, { nbf: T + NBF_LEEWAY_S })))).toBe(true);
    expect(await passes(await team.sign(claimsAt(NOW, { nbf: 'soon' })))).toBe(false);
  });

  it('fails unless it is RS256 under a named key, in three parts of base64url JSON', async () => {
    const good = await team.sign(claimsAt(NOW));
    const [h, p, s] = good.split('.');
    // the header Access writes, with the algorithm changed or the key id gone
    const header = (over: Record<string, unknown>) => base64url(JSON.stringify({ alg: 'RS256', kid: team.kid, typ: 'JWT', ...over }));
    expect(await passes(`${header({ alg: 'none' })}.${p}.`)).toBe(false);
    expect(await passes(`${header({ alg: 'none' })}.${p}.${s}`)).toBe(false);
    expect(await passes(`${header({ alg: 'HS256' })}.${p}.${s}`)).toBe(false);
    expect(await passes(`${header({ alg: 'PS256' })}.${p}.${s}`)).toBe(false);
    // signed by the team's key, over a header naming another algorithm
    for (const alg of ['none', 'HS256', 'PS256', 'RS512', 'rs256', undefined]) {
      expect(await passes(await team.sign(claimsAt(NOW), { alg, kid: team.kid, typ: 'JWT' }))).toBe(false);
    }
    expect(await passes(await team.sign(claimsAt(NOW), { alg: 'RS256', typ: 'JWT' }))).toBe(false);
    expect(await passes(await team.sign(claimsAt(NOW), { alg: 'RS256', kid: '', typ: 'JWT' }))).toBe(false);
    for (const t of ['', 'eyJ.header.payload', `${h}.${p}`, `${h}.${p}.${s}.${s}`, `${h}..${s}`, `${h}.${p}.***`, `${h}.${p}=.${s}`, `${base64url('[1]')}.${p}.${s}`, `${h}.${base64url('"claims"')}.${s}`, `${h}.${base64url('{"aud":')}.${s}`]) {
      expect(await passes(t)).toBe(false);
    }
  });
});

describe('a request', () => {
  const env = ACCESS_SECRETS;
  const request = (token?: string) => new Request('https://sudokui.app/admin', { headers: token === undefined ? {} : { [ACCESS_HEADER]: token } });

  it('came through Access only with a valid token in the header Access adds', async () => {
    const keys = keysOver(certsEndpoint(() => [team]), () => NOW.getTime());
    const token = await team.sign(claimsAt(NOW));
    expect(await cameThroughAccess(request(token), env, keys, NOW)).toBe(true);
    expect(await cameThroughAccess(request(), env, keys, NOW)).toBe(false);
    expect(await cameThroughAccess(request(''), env, keys, NOW)).toBe(false);
    // the cookie Access also sets is not what is checked
    expect(await cameThroughAccess(new Request('https://sudokui.app/admin', { headers: { cookie: `CF_Authorization=${token}` } }), env, keys, NOW)).toBe(false);
  });

  it('did not, whatever its token, while either secret is missing or names no Access team', async () => {
    const keys = keysOver(certsEndpoint(() => [team]), () => NOW.getTime());
    const token = await team.sign(claimsAt(NOW));
    for (const e of [{}, { ACCESS_TEAM_DOMAIN: TEAM_DOMAIN }, { ACCESS_AUD: AUD }, { ...env, ACCESS_AUD: ' ' }, { ...env, ACCESS_TEAM_DOMAIN: 'https://evil.example' }]) {
      expect(await cameThroughAccess(request(token), e, keys, NOW)).toBe(false);
    }
    // pasted with a stray space or line end, the secrets still work
    expect(await cameThroughAccess(request(token), { ACCESS_TEAM_DOMAIN: ` ${TEAM_DOMAIN}\n`, ACCESS_AUD: `${AUD}\r\n` }, keys, NOW)).toBe(true);
  });
});

describe('the team’s keys', () => {
  it('are fetched once and kept for an hour', async () => {
    let clock = NOW.getTime();
    const endpoint = certsEndpoint(() => [team]);
    const keys = keysOver(endpoint, () => clock);
    const token = await team.sign(claimsAt(NOW));
    for (let i = 0; i < 5; i++) expect(await verifyAccessToken(token, CONFIG, keys, NOW)).toBe(true);
    expect(endpoint.calls).toEqual([certsUrl(ISSUER)]);
    clock += KEYS_TTL_MS - 1;
    expect(await verifyAccessToken(token, CONFIG, keys, NOW)).toBe(true);
    expect(endpoint.calls).toHaveLength(1);
    clock += 1;
    expect(await verifyAccessToken(token, CONFIG, keys, NOW)).toBe(true);
    expect(endpoint.calls).toHaveLength(2);
  });

  it('are fetched again for a key id not among them, at most once a minute', async () => {
    let clock = NOW.getTime();
    let published = [team];
    const endpoint = certsEndpoint(() => published);
    const keys = keysOver(endpoint, () => clock);
    expect(await verifyAccessToken(await team.sign(claimsAt(NOW)), CONFIG, keys, NOW)).toBe(true);
    // Access rotates: the new key is published, and a token signed with it arrives
    published = [next, team];
    const rotated = await next.sign(claimsAt(NOW));
    expect(await verifyAccessToken(rotated, CONFIG, keys, NOW)).toBe(true);
    expect(endpoint.calls).toHaveLength(2);
    // made-up key ids, one after another, fetch nothing more within the minute
    const madeUp = (i: number) => stranger.sign(claimsAt(NOW), { alg: 'RS256', kid: `made-up-${i}`, typ: 'JWT' });
    for (let i = 0; i < 5; i++) expect(await verifyAccessToken(await madeUp(i), CONFIG, keys, NOW)).toBe(false);
    expect(endpoint.calls).toHaveLength(2);
    clock += REFETCH_MIN_MS - 1;
    expect(await verifyAccessToken(await madeUp(5), CONFIG, keys, NOW)).toBe(false);
    expect(endpoint.calls).toHaveLength(2);
    clock += 1;
    expect(await verifyAccessToken(await madeUp(6), CONFIG, keys, NOW)).toBe(false);
    expect(endpoint.calls).toHaveLength(3);
    expect(await verifyAccessToken(await madeUp(7), CONFIG, keys, NOW)).toBe(false);
    expect(endpoint.calls).toHaveLength(3);
    // the published keys still pass throughout, without a fetch
    expect(await verifyAccessToken(rotated, CONFIG, keys, NOW)).toBe(true);
    expect(await verifyAccessToken(await team.sign(claimsAt(NOW)), CONFIG, keys, NOW)).toBe(true);
    expect(endpoint.calls).toHaveLength(3);
  });

  it('are not fetched for a token that fails before its signature is looked at', async () => {
    const endpoint = certsEndpoint(() => [team]);
    const keys = keysOver(endpoint, () => NOW.getTime());
    expect(await verifyAccessToken(await team.sign(claimsAt(NOW, { aud: ['another-app'] })), CONFIG, keys, NOW)).toBe(false);
    expect(await verifyAccessToken(await team.sign(claimsAt(NOW, { exp: T - 1 })), CONFIG, keys, NOW)).toBe(false);
    expect(endpoint.calls).toHaveLength(0);
  });

  it('fail closed when the endpoint is down, and an hour-old set is never used', async () => {
    let clock = NOW.getTime();
    const endpoint = certsEndpoint(() => [team]);
    const keys = keysOver(endpoint, () => clock);
    const token = await team.sign(claimsAt(NOW));
    endpoint.state.down = true;
    expect(await verifyAccessToken(token, CONFIG, keys, NOW)).toBe(false);
    endpoint.state.down = false;
    expect(await verifyAccessToken(token, CONFIG, keys, NOW)).toBe(true);
    clock += KEYS_TTL_MS;
    endpoint.state.down = true;
    expect(await verifyAccessToken(token, CONFIG, keys, NOW)).toBe(false);
    endpoint.state.down = false;
    expect(await verifyAccessToken(token, CONFIG, keys, NOW)).toBe(true);
  });

  it('are read from the certs answer only where they are RS256 signing keys', async () => {
    const answer = (body: unknown) =>
      accessKeys({ fetch: (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch, now: () => NOW.getTime() });
    const token = await team.sign(claimsAt(NOW));
    const ok = async (body: unknown) => verifyAccessToken(token, CONFIG, answer(body), NOW);
    expect(await ok({ keys: [team.jwk] })).toBe(true);
    expect(await ok({ keys: [{ ...team.jwk, alg: undefined, use: undefined }] })).toBe(true);
    expect(await ok({ keys: [{ ...team.jwk, alg: 'RS512' }] })).toBe(false);
    expect(await ok({ keys: [{ ...team.jwk, use: 'enc' }] })).toBe(false);
    expect(await ok({ keys: [{ ...team.jwk, kty: 'EC' }] })).toBe(false);
    expect(await ok({ keys: [{ ...team.jwk, n: 'not-a-modulus' }] })).toBe(false);
    expect(await ok({ keys: [null, 4, { kid: team.kid }, team.jwk] })).toBe(true);
    expect(await ok({ public_cert: { kid: team.kid, cert: '-----BEGIN CERTIFICATE-----' } })).toBe(false);
    expect(await ok('garbage')).toBe(false);
    const html = accessKeys({ fetch: (async () => new Response('<html>', { status: 200 })) as typeof fetch, now: () => NOW.getTime() });
    expect(await verifyAccessToken(token, CONFIG, html, NOW)).toBe(false);
    const refused = accessKeys({ fetch: (async () => new Response(JSON.stringify({ keys: [team.jwk] }), { status: 500 })) as typeof fetch, now: () => NOW.getTime() });
    expect(await verifyAccessToken(token, CONFIG, refused, NOW)).toBe(false);
  });
});
