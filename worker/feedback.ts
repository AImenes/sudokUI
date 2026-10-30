/**
 * Reports from players (docs/connect-the-feedback.md): POST /api/feedback
 * takes what the app's report dialog sends (src/ui/ReportDialog.tsx) and
 * e-mails it to the person who runs sudokUI, through Cloudflare Email
 * Routing: the FEEDBACK binding sends from feedback@sudokui.app to the
 * address in the FEEDBACK_TO secret, a verified destination, which never
 * appears in the code or on the site. Nothing is stored here: the report
 * exists as that e-mail and nowhere else, and the privacy page
 * (src/content/privacy.ts) says how long it is kept there.
 *
 * What a report may carry, every field checked against a closed format:
 * the kind, what the player wrote, an address for an answer if they gave
 * one, the app's version and language; and, when they leave it ticked,
 * the board as a position link, the hint they think is wrong (its
 * technique, its one-line notation, the uniqueness and marks settings,
 * and whether the app found it agrees with the solution), and the
 * browser's user agent. Nothing else from the request goes into the
 * e-mail: the address it came from is read only by the rate limit, in
 * this isolate's memory, as on the daily's route.
 *
 * Robots: a field people never see (anything in it is a robot), a dialog
 * sent within two seconds of opening (the app itself never sends sooner),
 * a post from another site's page, five reports per address in ten
 * minutes, and thirty an hour; both limits live in this isolate's memory,
 * and Cloudflare runs many, so they are brakes rather than global caps. A
 * robot caught by the first three is answered as if it had sent, so it
 * learns nothing.
 */
import { makeRateLimiter } from './daily';
import { MESSAGE_MAX, MIN_OPEN_MS, isReplyAddress } from '../src/content/feedbackFormat';

export { MESSAGE_MAX, MIN_OPEN_MS };

export const FEEDBACK_PATH = '/api/feedback';
/** the address reports come from, on the zone where Email Routing runs */
export const FEEDBACK_FROM = 'feedback@sudokui.app';
/** the most a report may weigh on the wire */
export const BODY_MAX = 16_384;

export const KINDS = ['problem', 'hint', 'idea'] as const;
export type FeedbackKind = (typeof KINDS)[number];

/** a report, as the app sends it */
export interface FeedbackBody {
  kind: FeedbackKind;
  /** what the player wrote; a hint report may leave it empty, the hint says enough */
  message: string;
  /** an address for an answer, only if the player gave one */
  reply?: string;
  version: string;
  lang: string;
  /** how long the dialog was open before Send, in milliseconds */
  openedMs: number;
  /** the field people never see: the app sends it only when something filled it in */
  website?: string;
  /** the board, when the player leaves it ticked */
  board?: { puzzle: string; position: string };
  /** the hint the player thinks is wrong */
  hint?: { tech: string; text: string; useUniqueness: boolean; markContract: string; agrees: boolean };
  /** the browser's user agent, when the player leaves it ticked */
  browser?: string;
}

/** the slice of Cloudflare's send_email binding this module uses */
export interface SendEmailLike {
  send(message: unknown): Promise<void>;
}

/** turns a raw message into what the binding sends: cloudflare:email's EmailMessage in production */
export type MakeMessage = (from: string, to: string, raw: string) => unknown;

export interface FeedbackOptions {
  /** the binding, absent until Email Routing and the secret are set up */
  sender?: SendEmailLike | null;
  /** the verified address reports go to (the FEEDBACK_TO secret) */
  to?: string;
  makeMessage?: MakeMessage;
  now?: () => Date;
  /** the message id's random part, fixed under test */
  id?: () => string;
}

const PUZZLE = /^[1-9.]{81}$/;
const POSITION = /^[A-Za-z0-9_-]{1,1200}$/;
const VERSION = /^[0-9A-Za-z.+-]{1,40}$/;
const TECH = /^[A-Z0-9_]{1,40}$/;
const LANGS = ['en', 'nb', 'es'];
const CONTRACTS = ['unknown', 'exhaustive', 'open'];
/** control characters other than a line break and a tab: a pasted one becomes a space */
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
/** free text as the e-mail carries it: line breaks as \n, any other control character a space */
const clean = (v: string) => v.replace(/\r\n?/g, '\n').replace(CONTROL, ' ');

export type FeedbackCheck = { ok: true; report: FeedbackBody; robot: boolean } | { ok: false; reason: string };

/** a report's body checked field by field; a robot is told apart but not refused */
export function checkFeedback(body: unknown): FeedbackCheck {
  const refuse = (reason: string): FeedbackCheck => ({ ok: false, reason });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return refuse('a JSON object is expected');
  const b = body as Record<string, unknown>;
  if (!KINDS.includes(b.kind as FeedbackKind)) return refuse('kind');
  if (!isText(b.message, MESSAGE_MAX)) return refuse('message');
  const message = clean(b.message as string).trim();
  if (b.kind !== 'hint' && message.length < 3) return refuse('message: say what happened');
  if (b.reply !== undefined && b.reply !== '' && !(typeof b.reply === 'string' && isReplyAddress(b.reply))) return refuse('reply');
  if (typeof b.version !== 'string' || !VERSION.test(b.version)) return refuse('version');
  if (typeof b.lang !== 'string' || !LANGS.includes(b.lang)) return refuse('lang');
  if (typeof b.openedMs !== 'number' || !Number.isFinite(b.openedMs) || b.openedMs < 0) return refuse('openedMs');
  if (b.website !== undefined && typeof b.website !== 'string') return refuse('website');
  let board: FeedbackBody['board'];
  if (b.board !== undefined) {
    const v = b.board as Record<string, unknown> | null;
    if (!v || typeof v !== 'object' || typeof v.puzzle !== 'string' || !PUZZLE.test(v.puzzle) || typeof v.position !== 'string' || !POSITION.test(v.position)) {
      return refuse('board');
    }
    board = { puzzle: v.puzzle, position: v.position };
  }
  let hint: FeedbackBody['hint'];
  if (b.hint !== undefined) {
    const v = b.hint as Record<string, unknown> | null;
    if (
      !v ||
      typeof v !== 'object' ||
      typeof v.tech !== 'string' ||
      !TECH.test(v.tech) ||
      !isText(v.text, 2000) ||
      typeof v.useUniqueness !== 'boolean' ||
      typeof v.markContract !== 'string' ||
      !CONTRACTS.includes(v.markContract) ||
      typeof v.agrees !== 'boolean'
    ) {
      return refuse('hint');
    }
    hint = { tech: v.tech, text: clean(v.text as string), useUniqueness: v.useUniqueness, markContract: v.markContract, agrees: v.agrees };
  }
  if (b.kind === 'hint' && !hint) return refuse('hint: a hint report carries the hint');
  if (b.browser !== undefined && !isText(b.browser, 400)) return refuse('browser');
  const robot = (typeof b.website === 'string' && b.website !== '') || b.openedMs < MIN_OPEN_MS;
  return {
    ok: true,
    robot,
    report: {
      kind: b.kind as FeedbackKind,
      message,
      ...(b.reply ? { reply: b.reply as string } : {}),
      version: b.version,
      lang: b.lang,
      openedMs: b.openedMs,
      ...(board ? { board } : {}),
      ...(hint ? { hint } : {}),
      ...(b.browser ? { browser: clean(b.browser as string).trim() } : {})
    }
  };
}

const KIND_NAMES: Record<FeedbackKind, string> = {
  problem: 'Something is not working',
  hint: 'A hint looks wrong',
  idea: 'An idea'
};

/** the board as a link that opens it exactly as it stood, on the site */
export const positionLink = (board: { puzzle: string; position: string }) => `https://sudokui.app/p/${board.puzzle}#s=${board.position}`;

/** a report's short number, from its message id: six letters and digits */
export const reportRef = (id: string) => id.replace(/[^0-9a-z]/gi, '').slice(0, 6);

/**
 * the e-mail's subject: the kind, for a hint its technique, and the
 * report's short number, so that no two reports share a subject and a mail
 * client that groups by subject (Proton Mail does) keeps each report its
 * own conversation. The player's words stay in the body, out of the headers
 */
export function subjectOf(report: FeedbackBody, id: string): string {
  return `[sudokUI] ${KIND_NAMES[report.kind]}${report.hint ? `: ${report.hint.tech}` : ''} #${reportRef(id)}`;
}

/** the e-mail's text: what the player wrote first, then what came with it */
export function textOf(report: FeedbackBody): string {
  const lines = [
    `${KIND_NAMES[report.kind]}`,
    `Language: ${report.lang} · version ${report.version}`,
    report.reply ? `Answer to: ${report.reply}` : 'No address given for an answer.',
    '',
    report.message || '(nothing written)'
  ];
  if (report.hint) {
    lines.push(
      '',
      `The hint: ${report.hint.tech}`,
      report.hint.text,
      `Uniqueness ${report.hint.useUniqueness ? 'on' : 'off'} · marks ${report.hint.markContract}`,
      `The app found the step ${report.hint.agrees ? 'agrees' : 'DISAGREES'} with the puzzle's solution.`
    );
  }
  if (report.board) lines.push('', `The board: ${positionLink(report.board)}`);
  if (report.browser) lines.push('', `Browser: ${report.browser}`);
  lines.push('', '-- ', `Sent from the report dialog on sudokui.app. Kept until handled, at most 12 months (the privacy page).`);
  return lines.join('\n');
}

/** a header value in RFC 2047's encoded words when it is not plain ASCII */
function headerText(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

/** text as base64, in lines of 76, as MIME wants it */
function base64Lines(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return (btoa(binary).match(/.{1,76}/g) ?? []).join('\r\n');
}

/** the whole message, headers and body, as Email Routing takes it */
export function rawMessage(report: FeedbackBody, to: string, date: Date, id: string): string {
  const headers = [
    `From: sudokUI feedback <${FEEDBACK_FROM}>`,
    `To: <${to}>`,
    ...(report.reply ? [`Reply-To: <${report.reply}>`] : []),
    `Subject: ${headerText(subjectOf(report, id))}`,
    `Message-ID: <${id}@sudokui.app>`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64'
  ];
  return `${headers.join('\r\n')}\r\n\r\n${base64Lines(textOf(report).replace(/\n/g, '\r\n'))}\r\n`;
}

/** reports allowed per address in a window, in this isolate's memory */
export const RATE_LIMIT = { count: 5, windowMs: 10 * 60 * 1000 };
/** reports this isolate sends in an hour at most, whoever sends them */
export const HOURLY_CAP = 30;
const rateLimited = makeRateLimiter(RATE_LIMIT);
let hour = { start: 0, sent: 0 };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

/** the route, or null when the request is for another path */
export async function handleFeedback(request: Request, options: FeedbackOptions = {}): Promise<Response | null> {
  if (new URL(request.url).pathname !== FEEDBACK_PATH) return null;
  if (request.method !== 'POST') return json({ error: 'method' }, 405, { allow: 'POST' });
  const now = (options.now ?? (() => new Date()))();
  if (rateLimited(request.headers.get('cf-connecting-ip'), now.getTime())) return json({ error: 'too many' }, 429, { 'retry-after': '600' });
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > BODY_MAX) return json({ error: 'too large' }, 413);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > BODY_MAX) return json({ error: 'too large' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'a JSON object is expected' }, 400);
  }
  const check = checkFeedback(body);
  if (!check.ok) return json({ error: check.reason }, 400);
  // a robot is answered as a person is, and nothing is sent; so is a post
  // another site's page made a visitor's browser send (the app's own is
  // same-origin; a browser that does not say is let through)
  const site = request.headers.get('sec-fetch-site');
  if (check.robot || (site !== null && site !== 'same-origin')) return json({ ok: true });
  if (!options.sender || !options.to || !options.makeMessage) return json({ error: 'unavailable' }, 503, { 'retry-after': '3600' });
  if (now.getTime() - hour.start >= 3_600_000) hour = { start: now.getTime(), sent: 0 };
  if (hour.sent >= HOURLY_CAP) return json({ error: 'busy' }, 429, { 'retry-after': '3600' });
  // the slot is taken before the send is awaited, so reports arriving at
  // once cannot all pass the cap, and given back if the send fails
  const slot = hour;
  slot.sent++;
  const id = (options.id ?? (() => crypto.randomUUID()))();
  try {
    await options.sender.send(options.makeMessage(FEEDBACK_FROM, options.to, rawMessage(check.report, options.to, now, id)));
  } catch {
    slot.sent--;
    return json({ error: 'unavailable' }, 503, { 'retry-after': '3600' });
  }
  return json({ ok: true });
}

/** the hourly count back to zero, for tests */
export function resetHour(): void {
  hour = { start: 0, sent: 0 };
}
