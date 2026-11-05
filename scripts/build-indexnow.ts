// Post-build step, the last of `npm run build`: writes dist/indexnow.json,
// every URL in dist/sitemap.xml with a hash of the page built for it and
// the commit it was built from, for the IndexNow job on a push to main
// (scripts/indexnow.ts, docs/deployment.md). Fails the build when the
// sitemap lists a page the build did not write, or the key file in
// public/ is missing or wrong.
//
//   npx vite-node scripts/build-indexnow.ts [folder]
import { writeFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { buildManifest, keyFrom, MANIFEST_FILE } from './indexnow.ts';
import type { ReadFile } from './indexnow.ts';

const dist = process.argv[2] ?? join(process.cwd(), 'dist');
if (!existsSync(join(dist, 'sitemap.xml'))) {
  console.error(`${dist}/sitemap.xml not found: run \`vite build\` and scripts/build-learn.ts first`);
  process.exit(1);
}

/** the commit, in full: Cloudflare's Workers Builds sets WORKERS_CI_COMMIT_SHA, GitHub Actions GITHUB_SHA; else git (vite.config.ts, buildCommit) */
function commit(): string | null {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromCi) return fromCi;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

const read: ReadFile = (path) => {
  const file = join(dist, path);
  return existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : null;
};
// the key file is copied from public/ by vite build: it must be there, and right
keyFrom(readdirSync(dist), read);
const manifest = await buildManifest(read, commit());
writeFileSync(join(dist, MANIFEST_FILE), JSON.stringify(manifest, null, 1) + '\n');
console.log(`indexnow: ${Object.keys(manifest.pages).length} sitemap URLs hashed into ${MANIFEST_FILE} (commit ${manifest.commit?.slice(0, 7) ?? 'unknown'})`);
