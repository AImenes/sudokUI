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
  /** links shared, and of them the ones the share sheet took (the rest were copied) */
  shares: number;
  sharesSheet: number;
  /** shares by what was shared (telemetry.ts, SHARE_KINDS), each split by the way it went */
  sharesBy: Record<string, { sheet: number; copy: number }>;
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
  sharesBy: Record<string, { sheet: number; copy: number }>;
  /** the share pages' landings (the home pages' aside) over shares: how far a shared link travels; null without a share */
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
