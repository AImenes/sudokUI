// A page of every worked example drawn as the Learn diagrams draw it
// (src/content/boardSvg.ts), for looking at the hint drawings all at once
// (docs/hint-drawing.md, Checking it). Writes .vite/hint-gallery.html
// (git-ignored), or the path given:
//
//   npx vite-node scripts/hint-gallery.ts [out.html]
//
// Open it in a browser, or screenshot it; nothing here is deployed.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EXAMPLES } from '../src/content/examples';
import { boardSvg } from '../src/content/boardSvg';
import { TECHS, Tech } from '../src/engine/ratings';

const out = process.argv[2] ?? '.vite/hint-gallery.html';
const cards = (Object.keys(EXAMPLES) as Tech[])
  .map((tech) => {
    const ex = EXAMPLES[tech]!;
    const svg = boardSvg(ex, `${TECHS[tech].name} example`);
    return `<figure id="${tech}"><figcaption>${TECHS[tech].name} <small>${tech}</small></figcaption>${svg}<p>${ex.step.description
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</p></figure>`;
  })
  .join('\n');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `<!doctype html><meta charset="utf-8"><title>Hint gallery</title>
<style>body{font:14px system-ui;background:#e9ecf3;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}figure{margin:0;background:#fff;border-radius:10px;padding:10px}figcaption{font-weight:700;margin-bottom:6px}small{color:#778;font-weight:400}svg{width:100%;height:auto}p{color:#334;font-size:12px}</style>
<main>${cards}</main>`
);
console.log(`wrote ${Object.keys(EXAMPLES).length} examples to ${out}`);
