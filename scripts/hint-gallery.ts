// A page of every worked example drawn as the Learn diagrams draw it
// (src/content/boardSvg.ts), with the explanation Learn shows beside it,
// for looking at the hint drawings all at once (docs/hint-drawing.md,
// Checking it); the page is scripts/hint-gallery-page.ts. Writes
// .vite/hint-gallery.html (git-ignored), or the path given:
//
//   npx vite-node scripts/hint-gallery.ts [out.html]
//
// Open it in a browser, or screenshot it; nothing here is deployed.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EXAMPLES } from '../src/content/examples';
import { galleryPage } from './hint-gallery-page';

const out = process.argv[2] ?? '.vite/hint-gallery.html';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, galleryPage());
console.log(`wrote ${Object.keys(EXAMPLES).length} examples to ${out}`);
