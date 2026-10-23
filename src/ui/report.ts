// What the report dialog (src/ui/ReportDialog.tsx) sends to POST
// /api/feedback (worker/feedback.ts), which e-mails it to the person who
// runs sudokUI and stores nothing; the privacy page (src/content/privacy.ts)
// lists every field. The board goes while "Include the board" is ticked,
// the browser's user agent only when "Include my browser's details" is
// (it starts unticked), an address for an answer only if one is typed.
import { encodePosition, stepMatchesSolution } from '../state/gameStore';
import type { CellState, GameInfo, MarkContract } from '../state/gameStore';
import type { Step } from '../engine/steps';
import { stepText } from '../content/eureka';
import { FEEDBACK_ADDRESS, MESSAGE_MAX, MIN_OPEN_MS, isReplyAddress, asciiAddress } from '../content/feedbackFormat';

export { FEEDBACK_ADDRESS, MESSAGE_MAX, MIN_OPEN_MS, isReplyAddress, asciiAddress };
export const FEEDBACK_API = '/api/feedback';

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0';

export type ReportKind = 'problem' | 'hint' | 'idea';

/** a report as the route takes it */
export interface ReportBody {
  kind: ReportKind;
  message: string;
  reply?: string;
  version: string;
  lang: string;
  openedMs: number;
  /** the field people never see: sent only when something filled it in */
  website?: string;
  board?: { puzzle: string; position: string };
  hint?: { tech: string; text: string; useUniqueness: boolean; markContract: string; agrees: boolean };
  browser?: string;
}

/** the board on the screen as a position link's parts, or nothing when no game is on it (custom entry) */
export function reportBoard(info: GameInfo | null, cells: CellState[], autoCandidates: boolean): ReportBody['board'] {
  if (!info || !/^[1-9.]{81}$/.test(info.puzzle)) return undefined;
  return { puzzle: info.puzzle, position: encodePosition(cells, autoCandidates) };
}

/** the hint as the report carries it: what it is, its notation, the settings it was found under, and whether it agrees with the solution */
export function reportHint(hint: Step, solution: string, useUniqueness: boolean, markContract: MarkContract): NonNullable<ReportBody['hint']> {
  return {
    tech: hint.tech,
    text: stepText(hint).slice(0, 2000),
    useUniqueness,
    markContract,
    agrees: stepMatchesSolution(hint, solution)
  };
}

export type ReportOutcome = 'sent' | 'refused' | 'unavailable';

/** sends a report; what came of it */
export async function sendReport(body: ReportBody): Promise<ReportOutcome> {
  try {
    const res = await fetch(FEEDBACK_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) return 'sent';
    return res.status === 400 || res.status === 413 ? 'refused' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** the same report as a letter from the player's own mail app, when the route cannot take it */
export function mailtoOf(subject: string, text: string): string {
  return `mailto:${FEEDBACK_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
