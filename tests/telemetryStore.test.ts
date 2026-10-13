/**
 * Counting plays on the device (src/state/telemetry.ts): the live lines
 * sent while online with nothing kept, an offline line dropped unless the
 * switch is on, the opted-in queue kept on the device, marked, sent in
 * batches on the next flush and forgotten the moment the switch goes off,
 * and the two ways a batch travels.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useTelemetry, STORAGE_KEY, BATCH_MAX, BATCH_DELAY, TELEMETRY_API, deliver } = await import('../src/state/telemetry');
const { useSettings } = await import('../src/state/settings');
const { localDateKey } = await import('../src/content/dailies');

/** the next answers fetch gives, in order; a function throws as a network error */
let answers: (Response | (() => never))[] = [];
let calls: { url: string; init?: RequestInit }[] = [];
const originalFetch = globalThis.fetch;
const originalNavigator = globalThis.navigator;
const ok = () => new Response(null, { status: 204 });
const sent = (i: number) => JSON.parse(String(calls[i].init?.body));

/** the browser as the store sees it; the language is what settings.ts reads at start */
const setNavigator = (value: object) =>
  Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-GB', ...value }, configurable: true });

beforeEach(() => {
  answers = [];
  calls = [];
  storage.clear();
  useSettings.setState({ countPlays: false, countPlaysAsked: false });
  useTelemetry.setState({ queue: [], firstSeen: null, pending: [] });
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = answers.shift();
    if (!next) throw new Error('no answer prepared');
    if (typeof next === 'function') next();
    return next;
  }) as typeof fetch;
  // a browser without a beacon and with a connection: the fetch path
  setNavigator({ onLine: true });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  setNavigator(originalNavigator);
  vi.useRealTimers();
});

describe('the plays counted, by default', () => {
  it('sends a start and a solve while online, in one batch, with nothing kept on the device', async () => {
    const s = useTelemetry.getState();
    s.track('started', 'Hard', 0);
    s.track('completed', 'Hard', 552);
    expect(useTelemetry.getState().pending).toHaveLength(2);
    expect(calls).toHaveLength(0);
    answers = [ok()];
    await useTelemetry.getState().flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(TELEMETRY_API);
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.keepalive).toBe(true);
    expect(sent(0)).toEqual([
      { event: 'started', band: 'Hard', bucket: 0, standalone: false, version: expect.any(String), source: 'tab' },
      { event: 'completed', band: 'Hard', bucket: 36, standalone: false, version: expect.any(String), source: 'tab' }
    ]);
    expect(useTelemetry.getState().pending).toEqual([]);
    expect(useTelemetry.getState().queue).toEqual([]);
    expect(storage.has(STORAGE_KEY)).toBe(false);
    // a live line is sent once, whatever comes of it
    answers = [new Response('', { status: 503 })];
    useTelemetry.getState().track('completed', 'Easy', 10);
    await useTelemetry.getState().flush();
    expect(calls).toHaveLength(2);
    expect(useTelemetry.getState().queue).toEqual([]);
    expect(storage.has(STORAGE_KEY)).toBe(false);
  });

  it('waits a moment for company, then sends on its own', async () => {
    vi.useFakeTimers();
    answers = [ok()];
    useTelemetry.getState().track('started', 'Medium', 0);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(BATCH_DELAY);
    expect(calls).toHaveLength(1);
    expect(sent(0)).toHaveLength(1);
  });

  it('drops a line while offline with the switch off, and keeps nothing', async () => {
    setNavigator({ onLine: false });
    useTelemetry.getState().track('completed', 'Hard', 552);
    expect(useTelemetry.getState().pending).toEqual([]);
    expect(useTelemetry.getState().queue).toEqual([]);
    await useTelemetry.getState().flush();
    expect(calls).toHaveLength(0);
    expect(storage.has(STORAGE_KEY)).toBe(false);
  });
});

describe('the plays counted, with the switch on', () => {
  const today = localDateKey();

  it('keeps offline lines on the device, marked, and sends them on the next flush online', async () => {
    useSettings.setState({ countPlays: true });
    setNavigator({ onLine: false });
    const s = useTelemetry.getState();
    s.track('started', 'Tricky', 0);
    s.track('completed', 'Tricky', 700);
    const queue = useTelemetry.getState().queue;
    expect(queue).toHaveLength(2);
    expect(queue[1]).toEqual({ event: 'completed', band: 'Tricky', bucket: 46, standalone: false, version: expect.any(String), source: 'tab', offline: true, optin: true, returning: false });
    expect(useTelemetry.getState().firstSeen).toBe(today);
    expect(JSON.parse(storage.get(STORAGE_KEY)!)).toEqual({ queue, firstSeen: today });
    // still offline: nothing goes
    await useTelemetry.getState().flush();
    expect(calls).toHaveLength(0);
    // the connection is back
    setNavigator({ onLine: true });
    answers = [ok()];
    await useTelemetry.getState().flush();
    expect(calls).toHaveLength(1);
    expect(sent(0)).toEqual(queue);
    expect(useTelemetry.getState().queue).toEqual([]);
    expect(JSON.parse(storage.get(STORAGE_KEY)!)).toEqual({ queue: [], firstSeen: today });
  });

  it('marks a live line as opted in, and as a return once a day has passed since the switch went on', async () => {
    useSettings.setState({ countPlays: true });
    useTelemetry.getState().track('started', 'Hard', 0);
    expect(useTelemetry.getState().pending[0]).toMatchObject({ optin: true, returning: false });
    expect(useTelemetry.getState().pending[0].offline).toBeUndefined();
    expect(useTelemetry.getState().firstSeen).toBe(today);
    useTelemetry.setState({ pending: [], firstSeen: '2026-01-01' });
    useTelemetry.getState().track('started', 'Hard', 0);
    expect(useTelemetry.getState().pending[0]).toMatchObject({ optin: true, returning: true });
  });

  it('keeps the queue when the server cannot take it, and sends it in batches', async () => {
    useSettings.setState({ countPlays: true });
    setNavigator({ onLine: false });
    for (let i = 0; i < BATCH_MAX + 5; i++) useTelemetry.getState().track('started', 'Easy', 0);
    expect(useTelemetry.getState().queue).toHaveLength(BATCH_MAX + 5);
    setNavigator({ onLine: true });
    answers = [new Response('', { status: 503 })];
    await useTelemetry.getState().flush();
    expect(calls).toHaveLength(1);
    expect(useTelemetry.getState().queue).toHaveLength(BATCH_MAX + 5);
    answers = [
      () => {
        throw new Error('offline again');
      }
    ];
    await useTelemetry.getState().flush();
    expect(useTelemetry.getState().queue).toHaveLength(BATCH_MAX + 5);
    answers = [ok(), ok()];
    await useTelemetry.getState().flush();
    expect(calls).toHaveLength(4);
    expect(sent(2)).toHaveLength(BATCH_MAX);
    expect(sent(3)).toHaveLength(5);
    expect(useTelemetry.getState().queue).toEqual([]);
  });

  it('forgets the queue and the date the moment the switch goes off', () => {
    useSettings.setState({ countPlays: true });
    setNavigator({ onLine: false });
    useTelemetry.getState().track('completed', 'Hard', 100);
    expect(storage.has(STORAGE_KEY)).toBe(true);
    useSettings.getState().set({ countPlays: false });
    expect(useTelemetry.getState().queue).toEqual([]);
    expect(useTelemetry.getState().firstSeen).toBeNull();
    expect(storage.has(STORAGE_KEY)).toBe(false);
    // and off, an offline line is dropped again
    useTelemetry.getState().track('completed', 'Hard', 100);
    expect(useTelemetry.getState().queue).toEqual([]);
    expect(storage.has(STORAGE_KEY)).toBe(false);
  });

  it('reads what the device kept when the app opens with the switch on', async () => {
    const line = { event: 'completed', band: 'Hard', bucket: 4, standalone: true, version: '1.0.0', source: 'pwa', offline: true, optin: true, returning: true };
    storage.set(STORAGE_KEY, JSON.stringify({ queue: [line], firstSeen: '2026-10-01' }));
    storage.set('sudokui-settings-v1', JSON.stringify({ state: { countPlays: true }, version: 0 }));
    vi.resetModules();
    const fresh = await import('../src/state/telemetry');
    expect(fresh.useTelemetry.getState().queue).toEqual([line]);
    expect(fresh.useTelemetry.getState().firstSeen).toBe('2026-10-01');
    // with the switch off, what is there is not even read
    storage.set('sudokui-settings-v1', JSON.stringify({ state: { countPlays: false }, version: 0 }));
    vi.resetModules();
    const off = await import('../src/state/telemetry');
    expect(off.useTelemetry.getState().queue).toEqual([]);
    expect(off.useTelemetry.getState().firstSeen).toBeNull();
    vi.resetModules();
  });
});

describe('the transport', () => {
  const line = { event: 'started' as const, band: 'Hard' as const, bucket: 0, standalone: false, version: '1.0.0', source: 'tab' as const };

  it('is a beacon when the browser takes one, else a fetch with keepalive', async () => {
    const beacons: { url: string; body: Blob }[] = [];
    setNavigator({ onLine: true, sendBeacon: (url: string, body: Blob) => (beacons.push({ url, body }), true) });
    expect(await deliver([line])).toBe(true);
    expect(calls).toHaveLength(0);
    expect(beacons).toHaveLength(1);
    expect(beacons[0].url).toBe(TELEMETRY_API);
    expect(beacons[0].body.type).toBe('application/json');
    expect(JSON.parse(await beacons[0].body.text())).toEqual([line]);
    // the browser refuses the beacon (its queue is full): fetch instead
    setNavigator({ onLine: true, sendBeacon: () => false });
    answers = [ok()];
    expect(await deliver([line])).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.keepalive).toBe(true);
    // the server refuses, or there is no server
    answers = [new Response('', { status: 400 })];
    expect(await deliver([line])).toBe(false);
    answers = [
      () => {
        throw new Error('offline');
      }
    ];
    expect(await deliver([line])).toBe(false);
  });
});
