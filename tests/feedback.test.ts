/**
 * Reports from players (worker/feedback.ts): every field checked against
 * a closed format, so nothing a robot writes reaches a header; a robot
 * answered as a person and nothing sent; the limits; and the e-mail
 * itself, exactly as Email Routing would send it, with nothing in it but
 * what the report carried. Through the Worker too (worker/index.ts), with
 * the runtime's EmailMessage stood in for (tests/stubs/cloudflare-email.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleFeedback,
  checkFeedback,
  rawMessage,
  resetHour,
  FEEDBACK_FROM,
  FEEDBACK_PATH,
  MESSAGE_MAX,
  HOURLY_CAP,
  RATE_LIMIT,
  FeedbackBody
} from '../worker/feedback';
import { handleRequest, Env } from '../worker/index';

const SITE = 'https://sudokui.app';
const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const TO = 'owner@example.com';
const NOW = () => new Date('2026-10-23T12:00:00Z');

const problem = (over: Record<string, unknown> = {}) => ({
  kind: 'problem',
  message: 'The board froze after Undo.',
  version: '1.0.0+abc1234',
  lang: 'en',
  openedMs: 15_000,
  website: '',
  ...over
});
const hintReport = (over: Record<string, unknown> = {}) =>
  problem({
    kind: 'hint',
    message: '',
    board: { puzzle: EASY, position: 'BAAAAAAAAA-_xyz' },
    hint: { tech: 'X_WING', text: 'X-Wing: 4 r19c28 => r5c2<>4', useUniqueness: false, markContract: 'exhaustive', agrees: false },
    browser: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)',
    ...over
  });

let address = 0;
/** a request from an address of its own, so the per-address limit stays out of the way */
const post = (body: unknown, ip = `203.0.113.${(address = (address + 1) % 250)}`) =>
  new Request(`${SITE}${FEEDBACK_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

/** the binding as the route sees it: every message kept */
function outbox() {
  const sent: { from: string; to: string; raw: string }[] = [];
  return {
    sent,
    options: {
      sender: { send: async (m: unknown) => void sent.push(m as { from: string; to: string; raw: string }) },
      to: TO,
      makeMessage: (from: string, to: string, raw: string) => ({ from, to, raw }),
      now: NOW,
      id: () => 'fixed-id'
    }
  };
}

/** the e-mail's text, decoded from its base64 body */
function textOf(raw: string): string {
  const body = raw.split('\r\n\r\n')[1].replace(/\r\n/g, '');
  return new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)));
}
const header = (raw: string, name: string) => raw.split('\r\n\r\n')[0].split('\r\n').find((l) => l.startsWith(`${name}: `));

beforeEach(() => resetHour());

describe('a report checked', () => {
  it('takes a problem, an idea and a hint report in their formats', () => {
    expect(checkFeedback(problem())).toMatchObject({ ok: true, robot: false });
    expect(checkFeedback(problem({ kind: 'idea', message: 'A daily per band, please' }))).toMatchObject({ ok: true });
    const hint = checkFeedback(hintReport({ reply: 'player@example.org' }));
    expect(hint).toMatchObject({ ok: true, robot: false });
    if (hint.ok) expect(hint.report.reply).toBe('player@example.org');
  });

  it('refuses anything outside the formats', () => {
    const refused = (body: unknown, reason: RegExp) => {
      const c = checkFeedback(body);
      expect(c.ok, JSON.stringify(body)).toBe(false);
      if (!c.ok) expect(c.reason).toMatch(reason);
    };
    refused(null, /object/);
    refused([problem()], /object/);
    refused(problem({ kind: 'spam' }), /kind/);
    refused(problem({ message: '  ' }), /message/);
    refused(problem({ message: 'x'.repeat(MESSAGE_MAX + 1) }), /message/);
    refused(problem({ lang: 'de' }), /lang/);
    refused(problem({ version: '1.0.0 <script>' }), /version/);
    refused(problem({ openedMs: -1 }), /openedMs/);
    refused(problem({ website: 42 }), /website/);
    refused(hintReport({ hint: undefined }), /hint/);
    refused(hintReport({ hint: { tech: 'x-wing', text: 'a', useUniqueness: true, markContract: 'open', agrees: true } }), /hint/);
    refused(hintReport({ hint: { tech: 'X_WING', text: 'a', useUniqueness: true, markContract: 'all', agrees: true } }), /hint/);
    refused(hintReport({ board: { puzzle: EASY.slice(1), position: 'AA' } }), /board/);
    refused(hintReport({ board: { puzzle: EASY, position: 'not/base64' } }), /board/);
    refused(hintReport({ browser: 'x'.repeat(401) }), /browser/);
  });

  it('never lets an answer address carry a header of its own', () => {
    for (const reply of ['a@b.c\r\nBcc: victim@example.org', 'a@b.c\nX: y', 'Name <a@b.c>', 'a@b', '@b.c', 'a b@c.d']) {
      const c = checkFeedback(problem({ reply }));
      expect(c.ok, reply).toBe(false);
    }
  });

  it('turns a pasted control character into a space rather than refusing the report', () => {
    const c = checkFeedback(hintReport({ message: 'bell\u0007here\r\nnext\u000bline', browser: 'Mozilla/5.0\u0000x' }));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.report.message).toBe('bell here\nnext line');
    expect(c.report.browser).toBe('Mozilla/5.0 x');
  });

  it('tells a robot apart, by the hidden field or by speed', () => {
    expect(checkFeedback(problem({ website: 'https://spam.example' }))).toMatchObject({ ok: true, robot: true });
    expect(checkFeedback(problem({ openedMs: 900 }))).toMatchObject({ ok: true, robot: true });
  });
});

describe('the e-mail', () => {
  it('carries what the report carried, and nothing else', () => {
    const c = checkFeedback(hintReport({ reply: 'player@example.org', message: 'Æ, ø og å: this X-Wing removes the solution digit.' }));
    if (!c.ok) throw new Error(c.reason);
    const raw = rawMessage(c.report, TO, NOW(), 'id-1');
    expect(header(raw, 'From')).toBe(`From: sudokUI feedback <${FEEDBACK_FROM}>`);
    expect(header(raw, 'To')).toBe(`To: <${TO}>`);
    expect(header(raw, 'Reply-To')).toBe('Reply-To: <player@example.org>');
    expect(header(raw, 'Subject')).toBe('Subject: [sudokUI] A hint looks wrong: X_WING');
    expect(header(raw, 'Message-ID')).toBe('Message-ID: <id-1@sudokui.app>');
    expect(header(raw, 'Date')).toBe('Date: Fri, 23 Oct 2026 12:00:00 +0000');
    expect(header(raw, 'Content-Type')).toBe('Content-Type: text/plain; charset=utf-8');
    // every body line within MIME's 76 characters
    for (const line of raw.split('\r\n\r\n')[1].split('\r\n')) expect(line.length).toBeLessThanOrEqual(76);
    const text = textOf(raw);
    expect(text).toContain('Æ, ø og å: this X-Wing removes the solution digit.');
    expect(text).toContain('X-Wing: 4 r19c28 => r5c2<>4');
    expect(text).toContain('Uniqueness off · marks exhaustive');
    expect(text).toContain("The app found the step DISAGREES with the puzzle's solution.");
    expect(text).toContain(`The board: https://sudokui.app/p/${EASY}#s=BAAAAAAAAA-_xyz`);
    expect(text).toContain('Browser: Mozilla/5.0 (iPhone');
    expect(text).toContain('Answer to: player@example.org');
    expect(text).toContain('at most 12 months');
  });

  it('has no Reply-To, board or browser when the report has none', () => {
    const c = checkFeedback(problem());
    if (!c.ok) throw new Error(c.reason);
    const raw = rawMessage(c.report, TO, NOW(), 'id-2');
    expect(header(raw, 'Reply-To')).toBeUndefined();
    const text = textOf(raw);
    expect(text).toContain('No address given for an answer.');
    expect(text).not.toContain('The board:');
    expect(text).not.toContain('Browser:');
  });
});

describe('the route', () => {
  it('is POST only, refuses what it cannot read, and answers for its own path only', async () => {
    const { options } = outbox();
    expect(await handleFeedback(new Request(`${SITE}/api/other`, { method: 'POST' }), options)).toBeNull();
    expect((await handleFeedback(new Request(`${SITE}${FEEDBACK_PATH}`), options))!.status).toBe(405);
    expect((await handleFeedback(post('{not json'), options))!.status).toBe(400);
    expect((await handleFeedback(post(problem({ kind: 'spam' })), options))!.status).toBe(400);
    expect((await handleFeedback(post(problem({ message: 'x'.repeat(20_000) })), options))!.status).toBe(413);
  });

  it('sends one e-mail for a report, and none for a robot', async () => {
    const { sent, options } = outbox();
    const res = (await handleFeedback(post(hintReport()), options))!;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toBe(FEEDBACK_FROM);
    expect(sent[0].to).toBe(TO);
    // a robot is answered the same, and nothing goes out
    const robot = (await handleFeedback(post(problem({ website: 'spam' })), options))!;
    expect(robot.status).toBe(200);
    expect(await robot.json()).toEqual({ ok: true });
    expect((await handleFeedback(post(problem({ openedMs: 100 })), options))!.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it('sends nothing for a post another site made a visitor\u2019s browser send, and answers it as a person', async () => {
    const { sent, options } = outbox();
    const cross = new Request(`${SITE}${FEEDBACK_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'cf-connecting-ip': '192.0.2.9', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify(problem())
    });
    const res = (await handleFeedback(cross, options))!;
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
    const same = new Request(`${SITE}${FEEDBACK_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.10', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify(problem())
    });
    expect((await handleFeedback(same, options))!.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it('holds the hourly cap when reports arrive at once, and gives a failed send its slot back', async () => {
    const { sent, options } = outbox();
    const slow = { ...options, sender: { send: (m: unknown) => new Promise<void>((r) => setTimeout(() => (sent.push(m as never), r()), 20)) } };
    const answers = await Promise.all(Array.from({ length: HOURLY_CAP + 10 }, () => handleFeedback(post(problem()), slow)));
    expect(answers.filter((a) => a!.status === 200)).toHaveLength(HOURLY_CAP);
    expect(answers.filter((a) => a!.status === 429)).toHaveLength(10);
    expect(sent).toHaveLength(HOURLY_CAP);
    // a failed send does not use up the hour
    resetHour();
    const failing = { ...options, sender: { send: async () => Promise.reject(new Error('down')) } };
    for (let i = 0; i < HOURLY_CAP + 5; i++) expect((await handleFeedback(post(problem()), failing))!.status).toBe(503);
  });

  it('answers 503 until the binding and the address exist, and when sending fails', async () => {
    expect((await handleFeedback(post(problem()), {}))!.status).toBe(503);
    const { options } = outbox();
    expect((await handleFeedback(post(problem()), { ...options, to: undefined }))!.status).toBe(503);
    const failing = { ...options, sender: { send: async () => Promise.reject(new Error('destination not verified')) } };
    expect((await handleFeedback(post(problem()), failing))!.status).toBe(503);
  });

  it('takes five reports per address in ten minutes, and thirty an hour in all', async () => {
    const { sent, options } = outbox();
    for (let i = 0; i < RATE_LIMIT.count; i++) expect((await handleFeedback(post(problem(), '198.51.100.7'), options))!.status).toBe(200);
    expect((await handleFeedback(post(problem(), '198.51.100.7'), options))!.status).toBe(429);
    resetHour();
    sent.length = 0;
    for (let i = 0; i < HOURLY_CAP; i++) expect((await handleFeedback(post(problem()), options))!.status).toBe(200);
    const busy = (await handleFeedback(post(problem()), options))!;
    expect(busy.status).toBe(429);
    expect(sent).toHaveLength(HOURLY_CAP);
  });

  it('runs in the Worker, with the runtime’s message and the secret’s address', async () => {
    const messages: { from: string; to: string; raw: string }[] = [];
    const env: Env = {
      ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
      FEEDBACK: { send: async (m) => void messages.push(m as { from: string; to: string; raw: string }) },
      FEEDBACK_TO: TO
    };
    const res = await handleRequest(post(problem()), env);
    expect(res.status).toBe(200);
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe(FEEDBACK_FROM);
    expect(messages[0].to).toBe(TO);
    expect(textOf(messages[0].raw)).toContain('The board froze after Undo.');
    // without the secret, nothing is sent
    expect((await handleRequest(post(problem()), { ...env, FEEDBACK_TO: undefined })).status).toBe(503);
  });
});

export type { FeedbackBody };
