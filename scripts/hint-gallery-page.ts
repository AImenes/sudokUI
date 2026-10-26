// The page scripts/hint-gallery.ts writes: every worked example drawn as
// the Learn diagrams draw it (src/content/boardSvg.ts), with its legend and
// the explanation Learn shows beside it (describe(), src/engine/hintFrames.ts:
// the step's sentence, then its conclusion where that names what the
// sentence does not). Kept apart from the script, and from Node, so a test
// can read the page the script writes.
import { EXAMPLES } from '../src/content/examples';
import { boardSvg, legendOf, swatchCss } from '../src/content/boardSvg';
import { TECHS, Tech } from '../src/engine/ratings';
import { describe } from '../src/engine/hintFrames';

const escaped = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** the gallery: a card for each worked example, in the order they are stored */
export function galleryPage(): string {
  const cards = (Object.keys(EXAMPLES) as Tech[])
    .map((tech) => {
      const ex = EXAMPLES[tech]!;
      const svg = boardSvg(ex, `${TECHS[tech].name} example`);
      const legend = legendOf(ex.step, ex.values)
        .map((l) => `<span>${l.kind === 'note' ? '' : `<i style="${swatchCss(l)}"></i>`}${escaped(l.label)}</span>`)
        .join(' ');
      return `<figure id="${tech}"><figcaption>${TECHS[tech].name} <small>${tech}</small></figcaption>${svg}<div class="legend">${legend}</div><p>${escaped(describe(ex.step))}</p></figure>`;
    })
    .join('\n');
  return `<!doctype html><meta charset="utf-8"><title>Hint gallery</title>
<style>body{font:14px system-ui;background:#e9ecf3;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}figure{margin:0;background:#fff;border-radius:10px;padding:10px}figcaption{font-weight:700;margin-bottom:6px}small{color:#778;font-weight:400}svg{width:100%;height:auto}p{color:#334;font-size:12px}.legend{font-size:12px;color:#556;margin-top:4px}.legend span{display:inline-block;margin-right:12px}.legend i{display:inline-block;box-sizing:border-box;width:11px;height:11px;border-radius:50%;margin:0 6px 0 2px;vertical-align:-1px}</style>
<main>${cards}</main>`;
}
