/**
 * The explanation the hint panel shows under its title
 * (docs/hint-readability-2026-11.md, L3): the engine's explanation
 * (describe) without the "Name:" it opens with, which repeats the title
 * right above it ("Full House: r4c9 is the last empty cell ..." under
 * "Full House"). Every finder keeps its opening name, which Learn's worked
 * examples and the tooltips of the solution path show as they always did;
 * the panel alone leaves it out, here, for every technique at once.
 *
 * The name is left out only where it is the panel's title, or another name
 * of the same technique (its English name, a name it is also known by, or
 * a shorter form a finder writes, "Nishio" for Nishio Forcing Chain), with
 * a digit after it where a single-digit pattern names one ("X-Wing on 7",
 * "på 7", "en el 7"), and then only where the rest names that digit again.
 * What is left opens with a capital, but for a cell's name ("r4c9 is
 * ..."), which the walk's sentences also open with.
 */
import { describe } from '../engine/hintFrames';
import { unitName } from '../engine/text';
import { TECHS } from '../engine/ratings';
import type { Step } from '../engine/steps';
import { TECH_DOCS } from './techniqueDocs';

/** a name and what follows it: up to the first colon, with no sentence ending before it */
const NAMED = /^([^:.;!?]{1,60}): (\S[\s\S]*)$/;
/** the digit a single-digit pattern's name carries, in the three languages */
const ON_DIGIT = / (?:on|på|en el) (\d)$/;
const CELL = /r\dc\d/g;

/** whether a sentence names the digit d, as a number of its own, outside a cell's name and a house's */
function namesDigit(text: string, d: number): boolean {
  let plain = text.replace(CELL, ' ');
  for (let u = 26; u >= 0; u--) plain = plain.split(unitName(u)).join(' ');
  return new RegExp(`(?<!\\d)${d}(?!\\d)`).test(plain);
}

/**
 * The text without its opening name, where that name is one of the names
 * given (compared without case; a name's shorter form, ending where a
 * word or a plural "s" of the full name would follow, counts too)
 */
export function withoutName(text: string, names: readonly string[]): string {
  const m = NAMED.exec(text);
  if (!m) return text;
  const [, prefix, rest] = m;
  const on = ON_DIGIT.exec(prefix);
  const said = (on ? prefix.slice(0, on.index) : prefix).toLowerCase();
  const known = names.some((n) => {
    const full = n.toLowerCase();
    return full === said || (said.length >= 3 && full.startsWith(said) && (full[said.length] === ' ' || full.slice(said.length) === 's'));
  });
  if (!known || (on && !namesDigit(rest, Number(on[1])))) return text;
  return /^r\dc\d/.test(rest) ? rest : rest[0].toLocaleUpperCase() + rest.slice(1);
}

/** the explanation under the hint panel's title, the technique's name as the title gives it */
export function panelExplanation(step: Step, title: string): string {
  return withoutName(describe(step), [title, TECHS[step.tech].name, ...(TECH_DOCS[step.tech]?.aka ?? [])]);
}
