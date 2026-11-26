// The live-site check's own step (.github/workflows/live-check.yml): asks
// the live site for its first pages with GET requests only, as
// scripts/liveCheck.ts says, and exits 1 when anything is wrong, which
// fails the job, and GitHub mails the owner.
//
//   npx vite-node scripts/live-check.ts                 # the check, now
//   npx vite-node scripts/live-check.ts --after-push    # first wait for GITHUB_SHA's deploy (up to 20 minutes)
//
// LIVE_CHECK_BASE points it at another address (a local server, to try it
// without touching the live site); LIVE_CHECK_DATE sets the UTC day it
// checks for (2026-12-05), today by default.
import { runLiveCheck, waitForDeploy } from './liveCheck';

const log = (line: string) => console.log(`live check: ${line}`);

async function main(): Promise<number> {
  const base = process.env.LIVE_CHECK_BASE || undefined;
  const today = process.env.LIVE_CHECK_DATE || new Date().toISOString().slice(0, 10);
  const fetchWithTimeout = (url: string, init: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (process.argv.includes('--after-push')) {
    const commit = process.env.GITHUB_SHA ?? '';
    if (!/^[0-9a-f]{7,40}$/.test(commit)) {
      log('no commit to wait for (GITHUB_SHA)');
      return 1;
    }
    const live = await waitForDeploy({ fetch: fetchWithTimeout, commit, base, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now(), log });
    if (!live) return 1;
  }
  log(`checking ${base ?? 'https://sudokui.app'} for ${today}`);
  const problems = await runLiveCheck({ fetch: fetchWithTimeout, today, base, log });
  if (problems.length) {
    console.log('');
    for (const p of problems) console.log(`::error::${p}`);
    return 1;
  }
  log('every page and picture as it should be');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.log(`::error::the live check stopped: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
