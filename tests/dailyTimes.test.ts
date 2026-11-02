/**
 * The daily's times, as the owner decided on 2 November 2026
 * (docs/online-goals.md, "Norwegian law"): where a time stands is its
 * place while few have played and the percentile from twenty up
 * (src/content/dailies.ts, standingOf; the words in
 * src/content/dailyLine.ts), in three languages; the share line is built
 * from the solve the device keeps, so it can be sent again after the win
 * screen has closed; and a time goes in by itself only once the player
 * has switched that on, only for an unassisted solve, and only as the
 * request the button makes (src/state/gameStore.ts, recordDaily).
 */
import { describe, it, expect, beforeEach } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

/** every request the app makes, and what the server answers a result with */
let requests: { url: string; method: string; body: any }[] = [];
let answerCount = 5;
(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  requests.push({ url, method: init?.method ?? 'GET', body });
  const stats = { no: body?.no ?? 0, count: answerCount, median: 600, histogram: [[30, 1], [40, answerCount - 1]] };
  return new Response(JSON.stringify({ ok: true, accepted: true, stats }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const { useGame, dailyResultOf } = await import('../src/state/gameStore');
const { useDailyStats } = await import('../src/state/dailyStats');
const { useSettings } = await import('../src/state/settings');
const { useTelemetry } = await import('../src/state/telemetry');
const { standingOf, statsFromHistogram, dailyNumber, dailyDate, localDateKey, PLACE_BELOW, LATE_DAYS } = await import('../src/content/dailies');
const { standingPhrase, asLine, dailyLine, placeOrdinal } = await import('../src/content/dailyLine');
const { makeTranslator } = await import('../src/content/i18n');
const nb = (await import('../src/content/locales/app.nb')).default;
const es = (await import('../src/content/locales/app.es')).default;

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const EMPTY = [...EASY].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
const T = { en: makeTranslator('en'), nb: makeTranslator('nb', nb), es: makeTranslator('es', es) };

/** a day's statistics: the player's own time in bucket 40, the others where given */
const day = (others: number[]) =>
  statsFromHistogram(9, [...others, 40].reduce<{ bucket: number; n: number; n_unassisted: number }[]>((rows, bucket) => {
    const row = rows.find((r) => r.bucket === bucket);
    if (row) {
      row.n++;
      row.n_unassisted++;
    } else rows.push({ bucket, n: 1, n_unassisted: 1 });
    return rows;
  }, []));
const MINE = 40 * 15 + 5;
/** n times in all, the player's second fastest: one faster, the rest slower */
const secondOf = (n: number) => day([30, ...Array(n - 2).fill(50)]);

describe('where a daily time stands', () => {
  it('is its place below twenty times, and the percentile from twenty up', () => {
    expect(PLACE_BELOW).toBe(20);
    expect(standingOf(day([]), MINE)).toEqual({ kind: 'only' });
    expect(standingOf(secondOf(2), MINE)).toEqual({ kind: 'place', place: 2, of: 2, tied: false });
    expect(standingOf(secondOf(3), MINE)).toEqual({ kind: 'place', place: 2, of: 3, tied: false });
    expect(standingOf(secondOf(19), MINE)).toEqual({ kind: 'place', place: 2, of: 19, tied: false });
    // twenty: the share of the other nineteen it beat, as before (18 of 19)
    expect(standingOf(secondOf(20), MINE)).toEqual({ kind: 'percentile', pct: 95 });
    expect(standingOf(day([50, 60]), MINE)).toEqual({ kind: 'place', place: 1, of: 3, tied: false });
    // the server keeps no finer time than the 15-second step: a time in the player's step is a tie, on the better place
    expect(standingOf(day([40, 50]), MINE)).toEqual({ kind: 'place', place: 1, of: 3, tied: true });
    expect(standingOf(day([30, 40]), MINE)).toEqual({ kind: 'place', place: 2, of: 3, tied: true });
    expect(standingOf(statsFromHistogram(9, []), MINE)).toBeNull();
  });

  it('says it in English, Norwegian and Spanish, at one, two, three, nineteen and twenty times', () => {
    const say = (lang: 'en' | 'nb' | 'es', n: number, today = true) => standingPhrase(T[lang], standingOf(secondOf(n), MINE)!, today);
    const only = (lang: 'en' | 'nb' | 'es', today = true) => standingPhrase(T[lang], standingOf(day([]), MINE)!, today);
    expect([only('en'), say('en', 2), say('en', 3), say('en', 19), say('en', 20)]).toEqual([
      'the only time sent today',
      '2nd fastest of 2 today',
      '2nd fastest of 3 today',
      '2nd fastest of 19 today',
      'faster than 95% today'
    ]);
    expect([only('nb'), say('nb', 2), say('nb', 3), say('nb', 19), say('nb', 20)]).toEqual([
      'den eneste tiden sendt inn i dag',
      '2. plass av 2 i dag',
      '2. plass av 3 i dag',
      '2. plass av 19 i dag',
      'raskere enn 95 % i dag'
    ]);
    expect([only('es'), say('es', 2), say('es', 3), say('es', 19), say('es', 20)]).toEqual([
      'el único tiempo enviado hoy',
      '2.º puesto de 2 hoy',
      '2.º puesto de 3 hoy',
      '2.º puesto de 19 hoy',
      'más rápido que el 95% hoy'
    ]);
    // first, and the ties
    const first = day([50, 60]);
    const tiedFirst = day([40, 50]);
    const tiedSecond = day([30, 40]);
    const phrases = (lang: 'en' | 'nb' | 'es') => [first, tiedFirst, tiedSecond].map((s) => standingPhrase(T[lang], standingOf(s, MINE)!, true));
    expect(phrases('en')).toEqual(['fastest of 3 today', 'tied for fastest of 3 today', 'tied for 2nd fastest of 3 today']);
    expect(phrases('nb')).toEqual(['raskest av 3 i dag', 'delt førsteplass av 3 i dag', 'delt 2. plass av 3 i dag']);
    expect(phrases('es')).toEqual(['el mejor tiempo de 3 hoy', 'empate en el primer puesto de 3 hoy', 'empate en el 2.º puesto de 3 hoy']);
    // another day's daily counts every time sent for it so far, not today's
    expect(say('en', 3, false)).toBe('2nd fastest of 3 so far');
    expect(say('nb', 3, false)).toBe('2. plass av 3 så langt');
    expect(say('es', 3, false)).toBe('2.º puesto de 3 hasta ahora');
    // on the win screen, a line of its own
    expect(asLine(say('en', 3))).toBe('2nd fastest of 3 today');
    expect(asLine(phrases('en')[0])).toBe('Fastest of 3 today');
    expect(asLine(only('es'))).toBe('El único tiempo enviado hoy');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map((n) => placeOrdinal(n, 'en'))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});

describe('the daily’s share line', () => {
  const today = localDateKey();
  const no = dailyNumber(today)!;
  const played = { date: today, level: 'Hard' as const, score: 1100, seconds: MINE, assisted: false };

  it('says where the time stands once that very time is in, and nothing otherwise', () => {
    const stats = secondOf(5);
    const link = `https://sudokui.app/daily/${today}?vs=${MINE}`;
    expect(dailyLine(T.en, no, played, stats, MINE)).toBe(`sudokUI Daily #${no} · Hard (1100) · 10:05 · unassisted · 2nd fastest of 5 today · ${link}`);
    expect(dailyLine(T.nb, no, played, stats, MINE)).toBe(
      `Dagens sudokUI #${no} · ${T.nb.level('Hard')} (1100) · 10:05 · uten hjelp · 2. plass av 5 i dag · https://sudokui.app/nb/daily/${today}?vs=${MINE}`
    );
    expect(dailyLine(T.es, no, played, stats, MINE)).toContain(' · sin ayuda · 2.º puesto de 5 hoy · ');
    // not sent: no standing
    expect(dailyLine(T.en, no, played, stats, undefined)).toBe(`sudokUI Daily #${no} · Hard (1100) · 10:05 · unassisted · ${link}`);
    // a later solve of the same day is not the time the server holds
    expect(dailyLine(T.en, no, { ...played, seconds: MINE - 100 }, stats, MINE)).not.toContain('fastest');
    // an assisted solve is in nobody's statistics
    expect(dailyLine(T.en, no, { ...played, assisted: true }, stats, MINE)).toBe(`sudokUI Daily #${no} · Hard (1100) · 10:05 · ${link}`);
    // the only time in
    expect(dailyLine(T.en, no, played, day([]), MINE)).toContain(' · unassisted · the only time sent today · ');
    // the percentile from twenty up, as before
    expect(dailyLine(T.en, no, played, secondOf(20), MINE)).toContain(' · unassisted · faster than 95% today · ');
  });
});

describe('sending a daily time', () => {
  const today = localDateKey();
  const todayNo = dailyNumber(today)!;
  const play = (cell: number, digit: number) => {
    useGame.getState().select([cell], false);
    useGame.getState().input(digit);
  };
  /** today's daily (on the EASY board), solved; help taken first if asked */
  const solveDaily = (opts: { no?: number; assisted?: boolean } = {}) => {
    const no = opts.no ?? todayNo;
    useGame.getState().startGame(EASY, 196, 'Easy', null, dailyDate(no));
    useGame.setState((s) => ({ info: s.info && { ...s.info, dailyNo: no } }));
    if (opts.assisted) useGame.getState().markAssisted();
    const solution = useGame.getState().info!.solution;
    for (const cell of EMPTY) play(cell, Number(solution[cell]));
    expect(useGame.getState().won).toBe(true);
  };
  const posts = () => requests.filter((r) => r.method === 'POST');
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    storage.clear();
    requests = [];
    answerCount = 5;
    useSettings.setState({ autoSendDaily: false, dontCount: true });
    useTelemetry.setState({ track: () => {} } as never);
    useDailyStats.setState({ tokens: {}, submitted: {}, pending: {}, stats: {}, played: {}, inFlight: {} });
    useGame.setState({ info: null, counted: false, solved: false, won: false, history: [], future: [] });
  });

  it('is off until the player turns it on: a solve sends nothing, and is kept on the device for its share line', async () => {
    expect(useSettings.getInitialState().autoSendDaily).toBe(false);
    solveDaily();
    await settle();
    expect(requests).toEqual([]);
    const kept = useDailyStats.getState().played[todayNo];
    expect(kept).toEqual({ date: today, level: 'Easy', score: 196, seconds: Math.floor(useGame.getState().elapsedMs() / 1000), assisted: false });
    // only the solve, never anything sent: the store keeps it under its own key, next to the tokens
    expect(JSON.parse(storage.get('sudokui-daily-v1')!).state.played[todayNo]).toEqual(kept);
  });

  it('on, sends an unassisted solve by itself: the same request the button makes, once', async () => {
    useSettings.setState({ autoSendDaily: true });
    solveDaily();
    expect(useDailyStats.getState().inFlight[todayNo]).toBe(true);
    await settle();
    expect(posts()).toHaveLength(1);
    const [post] = posts();
    expect(post.url).toBe(`/api/daily/${todayNo}/result`);
    const { token, ...sent } = post.body;
    expect(sent).toEqual(dailyResultOf(useGame.getState()));
    expect(Object.keys(post.body).sort()).toEqual(['grid', 'hints', 'no', 'seconds', 'token', 'unassisted']);
    expect(post.body.unassisted).toBe(true);
    expect(token).toBe(useDailyStats.getState().tokens[todayNo]);
    expect(useDailyStats.getState().submitted[todayNo]).toBe(sent.seconds);
    expect(useDailyStats.getState().inFlight[todayNo]).toBeUndefined();
    // the solve undone and made again is the same solve: nothing more goes
    useGame.getState().undo();
    useGame.getState().redo();
    await settle();
    expect(posts()).toHaveLength(1);
  });

  it('never sends an assisted solve, a day the server has closed, or a day already sent', async () => {
    useSettings.setState({ autoSendDaily: true });
    solveDaily({ assisted: true });
    await settle();
    expect(requests).toEqual([]);
    expect(useDailyStats.getState().played[todayNo].assisted).toBe(true);
    solveDaily({ no: todayNo - LATE_DAYS - 1 });
    await settle();
    expect(requests).toEqual([]);
    useDailyStats.setState({ submitted: { [todayNo]: 300 } });
    solveDaily();
    await settle();
    expect(requests).toEqual([]);
  });

  it('keeps at most 31 days of solves on the device, whatever order they were solved in (the review of the reach batch)', () => {
    const played = (no: number) => ({ date: dailyDate(no), level: 'Easy' as const, score: 196, seconds: 600, assisted: false });
    // newest first, as a player opening friends' links to older dailies would
    for (let no = 100; no >= 40; no--) useDailyStats.getState().recordPlayed(no, played(no));
    const kept = Object.keys(useDailyStats.getState().played).map(Number).sort((a, b) => a - b);
    expect(kept).toHaveLength(31);
    expect(kept[0]).toBe(70);
    // a month of dailies, then one older one: still 31, the oldest dropped
    useDailyStats.setState({ played: {} });
    for (let no = 30; no <= 60; no++) useDailyStats.getState().recordPlayed(no, played(no));
    useDailyStats.getState().recordPlayed(20, played(20));
    expect(Object.keys(useDailyStats.getState().played)).toHaveLength(31);
  });

  it('drops a time the switch queued offline once the switch is off; a tapped one still goes', async () => {
    const base = { grid: '1'.repeat(81), seconds: 600, hints: 0, unassisted: true };
    useDailyStats.setState({ pending: { [todayNo]: { no: todayNo, ...base, auto: true }, [todayNo - 1]: { no: todayNo - 1, ...base } } });
    useSettings.setState({ autoSendDaily: false });
    await useDailyStats.getState().flushPending();
    expect(posts().map((r) => r.body.no)).toEqual([todayNo - 1]);
    expect(useDailyStats.getState().pending).toEqual({});
    // and the flag never leaves the device
    expect(Object.keys(posts()[0].body).sort()).toEqual(['grid', 'hints', 'no', 'seconds', 'token', 'unassisted']);
    // with the switch on, a queued time goes
    requests = [];
    useDailyStats.setState({ pending: { [todayNo]: { no: todayNo, ...base, auto: true } } });
    useSettings.setState({ autoSendDaily: true });
    await useDailyStats.getState().flushPending();
    expect(posts().map((r) => r.body.no)).toEqual([todayNo]);
  });

  it('sends nothing for a game that is no published daily', async () => {
    useSettings.setState({ autoSendDaily: true });
    useGame.getState().startGame(EASY, 196, 'Easy');
    const solution = useGame.getState().info!.solution;
    for (const cell of EMPTY) play(cell, Number(solution[cell]));
    await settle();
    expect(requests).toEqual([]);
    expect(useDailyStats.getState().played).toEqual({});
  });
});

describe('the privacy page on the daily’s times', () => {
  it('says, in every language, that a time goes when tapped, or by itself only once the player has switched that on', async () => {
    const { PRIVACY } = await import('../src/content/privacy');
    const label = { en: 'Send my daily times automatically', nb: nb.ui['Send my daily times automatically'], es: es.ui['Send my daily times automatically'] };
    const sendLabel = { en: 'Send my time and compare', nb: nb.ui['Send my time and compare'], es: es.ui['Send my time and compare'] };
    const off = { en: 'It is off until you turn it on.', nb: 'Den er av til du slår den på.', es: 'Está apagado hasta que lo enciendes.' };
    const never = { en: 'never an assisted solve', nb: 'aldri en løsning der du har fått hjelp', es: 'nunca una partida en la que hayas usado ayuda' };
    for (const lang of ['en', 'nb', 'es'] as const) {
      const section = PRIVACY[lang].sections[3];
      expect(section.heading).toBe(PRIVACY[lang].sections.find((s) => s.paragraphs.join(' ').includes(sendLabel[lang]))!.heading);
      expect(section.paragraphs).toHaveLength(2);
      const [asked, automatic] = section.paragraphs;
      expect(asked).toContain(sendLabel[lang]);
      expect(automatic).toContain(label[lang]);
      expect(automatic).toContain(off[lang]);
      expect(automatic).toContain(never[lang]);
      expect(automatic).toContain('31');
      // and the switch that leaves the device out of the counts says daily times are not its business
      expect(PRIVACY[lang].sections[2].paragraphs.join(' ')).toContain(lang === 'en' ? 'or by themselves once you have switched that on' : lang === 'nb' ? 'eller av seg selv når du har slått det på' : 'o por sí solos si lo has activado');
    }
  });
});
