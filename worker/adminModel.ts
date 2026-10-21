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
  landings: number;
  landingsDaily: number;
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
