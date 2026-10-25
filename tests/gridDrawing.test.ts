/**
 * The app board's own drawing of a hint (src/ui/Grid.tsx), rendered to
 * markup: the digits cut out of the arrows (docs/hint-drawing.md G11) by a
 * mask that holds the same digits, with every head painted back so none
 * is cut, and no mask when no line is drawn. The Learn diagrams' mask is
 * held by tests/examples.test.ts.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { EXAMPLES } from '../src/content/examples';
import type { Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame } = await import('../src/state/gameStore');
const { Grid } = await import('../src/ui/Grid');

/** the board at an example's position, with a step shown in full */
function board(tech: Tech, step?: Step): string {
  const ex = EXAMPLES[tech]!;
  const cells = Array.from({ length: 81 }, (_, i) => {
    const value = Number(ex.values[i]);
    return { given: ex.puzzle[i] >= '1' && ex.puzzle[i] <= '9', value, corner: 0, center: 0, excluded: value ? 0 : 0x1ff & ~ex.cands[i], colors: [] };
  });
  useGame.setState({ cells, autoCandidates: true, hint: step ?? ex.step, hintStage: 'full', walkIndex: 0, paused: false, won: false, chain: null });
  // a server render reads the store's initial state: give it the one set here
  // (as tests/setsReader.ts does)
  const init = useGame.getInitialState() as unknown as Record<string, unknown>;
  Object.assign(init, useGame.getState());
  return renderToStaticMarkup(React.createElement(Grid));
}

describe('the app board cuts the digits out of a hint\'s arrows', () => {
  it('with one mask on the lines, holding the board\'s digits, and every head painted back', () => {
    for (const tech of ['AIC', 'XY_CHAIN', 'NICE_LOOP', 'SIMPLE_COLORS'] as Tech[]) {
      const html = board(tech);
      const masks = [...html.matchAll(/<mask id="([^"]+)"[\s\S]*?<\/mask>/g)];
      expect(masks, tech).toHaveLength(1);
      const [whole, id] = masks[0];
      expect(html, tech).toContain(`class="chain-arrows" mask="url(#${id})"`);
      // the same digits as the board shows, in the mask's knock-out group
      const ko = whole.match(/<g class="knockout">([\s\S]*)<\/g>/)?.[1] ?? '';
      const digits = (s: string) => [...s.matchAll(/<text[^>]*>(\d)<\/text>/g)].map((m) => m[1]).join('');
      const outside = html.replace(whole, '');
      const boardDigits = digits(outside.slice(outside.indexOf('</g>', outside.indexOf('class="chain-arrows"'))));
      expect(digits(ko), tech).toBe(boardDigits);
      // every head drawn is painted back, white, after the digits
      const heads = [...outside.matchAll(/<polygon points="([^"]+)" fill="var\(--hint-arrow\)"/g)].map((m) => m[1]);
      const back = [...whole.matchAll(/<polygon points="([^"]+)" fill="#fff"/g)].map((m) => m[1]);
      expect(back, tech).toEqual(heads);
      expect(heads.length, tech).toBeGreaterThan(0);
      expect(whole.indexOf('<polygon'), tech).toBeGreaterThan(whole.indexOf('class="knockout"'));
    }
  });

  it('and draws no mask when the hint draws no line', () => {
    expect(board('NAKED_SINGLE')).not.toContain('<mask');
    // a switch inside one cell draws no line, but keeps its start dot
    const ex = EXAMPLES.XY_CHAIN!;
    const inCell = ex.step.links!.find((l) => l.from[0].cell === l.to[0].cell)!;
    const html = board('XY_CHAIN', { ...ex.step, links: [inCell] });
    expect(html).not.toContain('<mask');
    expect(html).toContain('class="chain-start"');
  });

  it('with the stylesheet turning the mask\'s digits black and thick', () => {
    const css = new TextDecoder().decode(readFileSync('src/ui/styles.css'));
    expect(css).toMatch(/\.board \.knockout text,\s*\.board \.knockout tspan \{\s*fill: #000 !important;/);
    expect(css).toMatch(/\.board \.knockout text \{\s*stroke: #000;\s*stroke-width: max\(0\.12em, 4px\);/);
  });
});
