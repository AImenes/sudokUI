/**
 * The shape of what the dashboard (admin.ts) shows: a day's counts, the
 * totals over some days, and the page's metrics. Kept apart so a test or
 * a script can build them without the page.
 */

/** the dataset the app's events go to (wrangler.jsonc, analytics_engine_datasets) */
export const DATASET = 'sudokui_events';

/** how many full days the page shows, besides today */
export const DAYS_SHOWN = 30;

/** one UTC day's counts */
/** how the shares of one kind went: the share sheet, a copy, or a picture saved as a file (telemetry.ts, SHARE_VIAS) */
export interface ShareWays {
  sheet: number;
  copy: number;
  save: number;
}

export interface DayRow {
  /** 2026-10-13 */
  day: string;
  /** games begun, practice aside, as before practice was counted; and so for the other play counts below */
  starts: number;
  /** starts from opted-in devices, and of those the ones on a later day than the device's first */
  startsOptin: number;
  startsReturning: number;
  /** every completion, live and kept-while-offline alike */
  completed: number;
  /** of them, kept while offline by an opted-in device and sent later */
  completedOffline: number;
  completedOptin: number;
  completedOptinOffline: number;
  completedStandalone: number;
  /** landings on every page counted: the share pages and the home pages */
  landings: number;
  landingsDaily: number;
  /** of them, on a home page (/, /nb/, /es/) */
  landingsHome: number;
  /** landings by where they came from (telemetry.ts, LANDING_FROM); '' for those counted before it was kept */
  landingsFrom: Record<string, number>;
  /** the same for the home pages' landings only */
  landingsFromHome: Record<string, number>;
  /** every start and every solve, practice included, by kind of game (telemetry.ts, PLAY_KINDS) and by the app's language (PLAY_LANGS); '' for an older app's lines, which say neither */
  startsBy: Record<string, number>;
  completedBy: Record<string, number>;
  startsByLang: Record<string, number>;
  completedByLang: Record<string, number>;
  /** links and pictures shared, and of them the ones the share sheet took and the pictures saved (the rest were copied) */
  shares: number;
  sharesSheet: number;
  sharesSaved: number;
  /** shares by what was shared (telemetry.ts, SHARE_KINDS), each split by the way it went */
  sharesBy: Record<string, ShareWays>;
}

/** the plan's numbers over some days */
export interface Totals {
  starts: number;
  /** every completion sent, live and reported-offline */
  completed: number;
  /** of them, sent live */
  online: number;
  /** of them, kept while offline by opted-in devices */
  offlineReported: number;
  /** what everyone else played offline, at the opted-in cohort's ratio; null without a cohort */
  offlineEstimate: number | null;
  /** completed plus the estimate */
  total: number;
  completionRate: number | null;
  /** completions played from the installed app (display-mode: standalone): a home-screen or desktop icon, not a store */
  standalone: number;
  installedShare: number | null;
  optinOnline: number;
  optinOffline: number;
  landings: number;
  landingsDaily: number;
  landingsHome: number;
  landingsFrom: Record<string, number>;
  landingsFromHome: Record<string, number>;
  shares: number;
  sharesSheet: number;
  sharesSaved: number;
  sharesBy: Record<string, ShareWays>;
  /** the share pages' landings (the home pages' aside) over the links shared, pictures aside: how far a shared link travels; null without one */
  landingsPerShare: number | null;
  /** starts and solves by kind of game and by language, practice included */
  startsBy: Record<string, number>;
  completedBy: Record<string, number>;
  startsByLang: Record<string, number>;
  completedByLang: Record<string, number>;
  startsOptin: number;
  startsNew: number;
  startsReturning: number;
  newShare: number | null;
}

export interface Metrics {
  /** today and the DAYS_SHOWN days before it, oldest first */
  days: DayRow[];
  today: DayRow;
  yesterday: Totals;
  week: Totals;
  month: Totals;
  /** 2026-10-13 09:30 UTC */
  generatedAt: string;
}

// ---- Christmas: the advent calendar (docs/advent-calendar.md) ----------------

/** where the calendar stands on the dashboard's UTC day: before its 1 December, from 1 to 31 December, or after */
export type AdventPhase = 'before' | 'open' | 'over';

/**
 * Whether the doors' counts were read from the dataset: they are read for
 * the UTC days from 30 November (a player a day ahead of UTC opens door 1
 * then) to 31 January (a door under way on 1 January can still be
 * finished), not before ('soon') nor after ('past'), and 'failed' when
 * the SQL API did not answer
 */
export type AdventCounted = 'read' | 'soon' | 'past' | 'failed';

/** one door's numbers */
export interface AdventDoorRow {
  door: number;
  /** its day, 2026-12-05 */
  date: string;
  /** its band and HoDoKu rating, as advent.json publishes them; '' and 0 for a door not published */
  level: string;
  score: number;
  /** door games begun and solved, from the play lines' door (telemetry.ts, blob7) */
  started: number;
  completed: number;
  completionRate: number | null;
  /** unassisted times that reached the database and their median in seconds (daily_hist, as the win screen reads it); null without a database or when it failed */
  times: number | null;
  median: number | null;
}

/** the Christmas section: one calendar's doors, their landings, and where the calendar stands */
export interface AdventMetrics {
  year: number;
  phase: AdventPhase;
  counted: AdventCounted;
  /** whether the database was there and answered: undefined without one, false when it failed */
  database?: boolean;
  doors: AdventDoorRow[];
  started: number;
  completed: number;
  completionRate: number | null;
  /** every door's unassisted times together; null without a database or when it failed */
  times: number | null;
  /** landings on a door's address (the slot advent), and by the word their referrer gave (telemetry.ts, landingWord) */
  landings: number;
  landingsFrom: Record<string, number>;
}
