// Post-build step: writes the static /learn/ pages and the sitemap into
// dist/. Runs after `vite build` (see the "build" script in package.json):
//
//   npx vite-node scripts/build-learn.ts [folder]
//
// The pages are plain HTML generated from the same content modules the app
// uses (src/content/), so the site and the in-app Learn dialog never drift.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildLearnPages, buildLearnAssets, buildSitemap } from '../src/content/learnPages';

// an explicit folder may be given, to match `vite build --outDir <folder>`
const dist = process.argv[2] ?? join(process.cwd(), 'dist');
if (!existsSync(dist)) {
  console.error(`${dist} not found: run \`vite build\` first`);
  process.exit(1);
}

const pages = buildLearnPages();
for (const page of pages) {
  const file = join(dist, page.path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page.html);
}
const assets = buildLearnAssets();
for (const asset of assets) {
  const file = join(dist, asset.path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, asset.content);
}
writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(pages));

console.log(
  `learn pages: wrote ${pages.length} pages, ${assets.length} diagrams and sitemap.xml to dist/`
);
