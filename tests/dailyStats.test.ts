/**
 * The daily's statistics on the device (src/state/dailyStats.ts): what the
 * store does with every answer the server can give, with a stand-in for
 * fetch, and the result that waits for the next open.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDailyStats, DailyResult } from '../src/state/dailyStats';
import type { DailyStats } from '../src/content/dailies';

const result: DailyResult = { no: 7, grid: '1'.repeat(81), seconds: 552, hints: 0, unassisted: true, source: 'tab' };
const stats = (count: number): DailyStats => ({ no: 7, count, unassisted: count, median: count ? 552 : null, histogram: count ? [[36, count]] : [] });

/** the next answers fetch gives, in order; a function throws as a network error */
let answers: (Response | (() => never))[] = [];
let calls: { url: string; init?: RequestInit }[] = [];
const originalFetch = globalThis.fetch;
const reset = () => useDailyStats.setState({ tokens: {}, submitted: {}, pending: {}, stats: {} });

beforeEach(() => {
  answers = [];
  calls = [];
  reset();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = answers.shift();
    if (!next) throw new Error('no answer prepared');
    if (typeof next === 'function') next();
    return next;
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const offline = () => {
  throw new Error('offline');
};

describe('the daily statistics store', () => {
  it('fetches a day’s statistics, and never lets a cached answer shrink them', async () => {
    answers = [json(stats(3))];
    expect(await useDailyStats.getState().fetchStats(7)).toEqual(stats(3));
    expect(calls[0].url).toBe('/api/daily/7/stats');
    // a minute-old answer from a cache, after the player's own result went in
    answers = [json(stats(2))];
    expect(await useDailyStats.getState().fetchStats(7)).toEqual(stats(3));
    answers = [json({ error: 'unavailable' }, 503)];
    expect(await useDailyStats.getState().fetchStats(7)).toBeNull();
    answers = [offline];
    expect(await useDailyStats.getState().fetchStats(7)).toBeNull();
    expect(useDailyStats.getState().stats[7]).toEqual(stats(3));
  });

  it('sends a result with a token it keeps, and records what the server took', async () => {
    answers = [json({ ok: true, accepted: true, stats: stats(1) })];
    expect(await useDailyStats.getState().submit(result)).toBe('accepted');
    const sent = JSON.parse(String(calls[0].init?.body));
    expect(calls[0].url).toBe('/api/daily/7/result');
    expect(calls[0].init?.method).toBe('POST');
    expect(sent.token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(sent).toMatchObject({ no: 7, seconds: 552, hints: 0, unassisted: true, source: 'tab' });
    const s = useDailyStats.getState();
    expect(s.submitted[7]).toBe(552);
    expect(s.stats[7]).toEqual(stats(1));
    expect(s.tokens[7]).toBe(sent.token);
    // the same day again, a different time: the same token, and the first time stays the one on record
    answers = [json({ ok: true, accepted: false, stats: stats(1) })];
    expect(await useDailyStats.getState().submit({ ...result, seconds: 600 })).toBe('repeat');
    expect(JSON.parse(String(calls[1].init?.body)).token).toBe(sent.token);
    expect(useDailyStats.getState().submitted[7]).toBe(552);
  });

  it('keeps a result the server could not take for the next open, and drops one it refused', async () => {
    answers = [offline];
    expect(await useDailyStats.getState().submit(result)).toBe('unavailable');
    expect(useDailyStats.getState().pending[7]).toEqual(result);
    answers = [json({ error: 'unavailable' }, 503)];
    expect(await useDailyStats.getState().submit(result)).toBe('unavailable');
    answers = [new Response('<html>', { status: 200 })];
    expect(await useDailyStats.getState().submit(result)).toBe('unavailable');
    expect(useDailyStats.getState().pending[7]).toEqual(result);
    // another day waits beside it
    answers = [json({ error: 'unavailable' }, 503)];
    await useDailyStats.getState().submit({ ...result, no: 8 });
    expect(Object.keys(useDailyStats.getState().pending).sort()).toEqual(['7', '8']);
    // the next open sends them both
    answers = [json({ ok: true, accepted: true, stats: stats(1) }), json({ ok: true, accepted: true, stats: { ...stats(1), no: 8 } })];
    await useDailyStats.getState().flushPending();
    expect(useDailyStats.getState().pending).toEqual({});
    expect(useDailyStats.getState().submitted).toEqual({ 7: 552, 8: 552 });
    // a refusal is final
    answers = [json({ error: 'too fast' }, 400)];
    expect(await useDailyStats.getState().submit({ ...result, no: 9 })).toBe('refused');
    expect(useDailyStats.getState().pending[9]).toBeUndefined();
    expect(useDailyStats.getState().submitted[9]).toBeUndefined();
  });

  it('does not send while offline, and waits for the next open instead', async () => {
    const nav = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
    try {
      expect(await useDailyStats.getState().submit(result)).toBe('offline');
      expect(calls).toHaveLength(0);
      expect(useDailyStats.getState().pending[7]).toEqual(result);
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    }
  });
});
