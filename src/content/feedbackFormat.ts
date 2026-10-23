// What a report may be, shared by the app that writes it (src/ui/report.ts,
// src/ui/ReportDialog.tsx) and the Worker that checks it
// (worker/feedback.ts), so the dialog never lets through what the Worker
// would refuse.

/** the public address reports and letters go to; Email Routing forwards it to the owner's inbox */
export const FEEDBACK_ADDRESS = 'feedback@sudokui.app';

/** the most a player may write */
export const MESSAGE_MAX = 4000;

/** a report sent sooner after the dialog opened than this was not filled in by a person */
export const MIN_OPEN_MS = 2000;

/**
 * An address for an answer: a plain ASCII mailbox, a dot-atom before the @
 * and hostname labels after it. Narrower than what mail allows, on
 * purpose: it can never carry a line break, a quote or angle brackets
 * into the e-mail's Reply-To.
 */
export const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** an answer address the Worker takes */
export const isReplyAddress = (value: string) => value.length <= 254 && value.split('@')[0].length <= 64 && EMAIL_PATTERN.test(value);

/**
 * An address with a domain in letters such as æ, ø or å (ola@blåbær.no)
 * written the way mail carries it (ola@xn--blbr-roah.no), as some browsers
 * already do in an e-mail field. Only such a domain is converted, and only
 * a bare one: an ASCII domain, or one with a path, a port, a query, a
 * percent sign or a space, comes back as it was for the check to judge,
 * and so does one the conversion would turn into a numeric address (a
 * browser reads "163" as the IP address 0.0.0.163)
 */
export function asciiAddress(value: string): string {
  const at = value.lastIndexOf('@');
  if (at < 1 || at === value.length - 1) return value;
  const domain = value.slice(at + 1);
  if (!/[^\x00-\x7f]/.test(domain) || /[\s/?#:@%\\[\]]/.test(domain)) return value;
  try {
    const host = new URL(`http://${domain}`).hostname;
    return /^[0-9.]+$/.test(host) ? value : `${value.slice(0, at)}@${host}`;
  } catch {
    return value;
  }
}
