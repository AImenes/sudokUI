// The IndexNow job's own step (.github/workflows/indexnow.yml): reads the
// list the site served before the deploy from the file the job's first
// step saved, waits for the pushed commit's to go live, and sends the new
// and changed URLs (scripts/indexnow.ts, submitChanges). Exits 0 whatever
// happens, so a push's checks never fail because of it.
//
//   node --experimental-strip-types scripts/indexnow-submit.ts <old indexnow.json> [--dry-run]
//
// GITHUB_SHA names the commit to wait for; with --dry-run it sends nothing
// and prints what it would send.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { keyFrom, submitChanges } from './indexnow.ts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const oldFile = args.find((a) => !a.startsWith('--'));

async function main() {
  const commit = process.env.GITHUB_SHA ?? '';
  if (!/^[0-9a-f]{7,40}$/.test(commit)) {
    console.log('IndexNow: no commit to wait for (GITHUB_SHA): nothing sent');
    return;
  }
  let oldText: string | null = null;
  try {
    oldText = oldFile ? readFileSync(oldFile, 'utf8') : null;
  } catch {
    oldText = null;
  }
  await submitChanges({
    oldText,
    commit,
    key: keyFrom(readdirSync('public'), (name) => readFileSync(join('public', name), 'utf8')),
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30_000) }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    log: (line) => console.log(`IndexNow: ${line}`),
    dryRun
  });
}

main()
  .catch((err) => console.log(`IndexNow: stopped: ${err instanceof Error ? err.message : String(err)}`))
  .finally(() => process.exit(0));
