/**
 * The engine's sentences in the player's language. Every sentence the
 * engine writes for people (hint descriptions, legend labels, link
 * sentences, the chain trainer's messages) is an English template tagged
 * `tr`:
 *
 *   tr`Full House: ${cellName(empty)} is the last empty cell in ${unit}, so it must be ${digit}.`
 *
 * With no translation loaded, `tr` is exactly the template literal, so the
 * English is what it always was. A translation table maps each template,
 * written with numbered holes,
 *
 *   "Full House: {0} is the last empty cell in {1}, so it must be {2}."
 *
 * to the same sentence in another language, whose holes may come in any
 * order. A template with no entry stays English, so nothing is ever blank.
 * Words that change with a value (a plural, "rows" or "columns") are
 * separate templates, chosen in the code, never pieces glued together, so
 * every language can build the sentence its own way.
 *
 * The engine never imports a translation: the app registers the chosen
 * language's table (src/content/locales/engine.<lang>.ts), and the worker,
 * whose sentences nobody reads, stays English. Cell names (r1c1) and
 * digits are the same in every language.
 */
export type EngineTable = Record<string, string>;

let table: EngineTable | null = null;
let current = 'en';
const missed = new Set<string>();
const keys = new WeakMap<TemplateStringsArray, string>();

/** a template's key: its text with the holes numbered {0}, {1}, ... */
export function templateKey(strings: readonly string[]): string {
  let key = strings[0];
  for (let i = 1; i < strings.length; i++) key += `{${i - 1}}` + strings[i];
  return key;
}

/** the language the engine writes in from now on; null or 'en' is English */
export function setEngineText(lang: string, t: EngineTable | null): void {
  current = t && lang !== 'en' ? lang : 'en';
  table = current === 'en' ? null : t;
}

/** the language the engine is writing in */
export const engineLang = () => current;

/** templates asked for in another language that have no translation (for the coverage tools) */
export const missedTemplates = () => [...missed];

/** An engine sentence: the English template, or its translation. */
export function tr(strings: TemplateStringsArray, ...values: unknown[]): string {
  if (table) {
    let key = keys.get(strings);
    if (key === undefined) {
      key = templateKey(strings);
      keys.set(strings, key);
    }
    const t = table[key];
    if (t !== undefined) return t.replace(/\{(\d+)\}/g, (_, i: string) => String(values[Number(i)]));
    missed.add(key);
  }
  let s = strings[0];
  for (let i = 1; i < strings.length; i++) s += String(values[i - 1]) + strings[i];
  return s;
}

/** items joined by the language's "and": "1 and 2", "1 and 2 and 3" */
export function joinAnd(items: readonly (string | number)[]): string {
  if (!items.length) return '';
  return items.map(String).reduce((a, b) => tr`${a} and ${b}`);
}

/** a list the way prose writes it: "1", "1 and 2", "1, 2 and 3" */
export function listAnd(items: readonly (string | number)[]): string {
  if (items.length < 2) return items.join('');
  return tr`${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * A house by its index in UNITS (rows 0-8, columns 9-17, boxes 18-26):
 * "row 3", "column 5", "box 9". Every language writes it without an
 * article (rad 3, fila 3), so the sentence around it supplies one if it
 * needs it; in Spanish all three are feminine (la fila, la columna, la caja).
 */
export function unitName(u: number): string {
  if (u < 9) return tr`row ${u + 1}`;
  if (u < 18) return tr`column ${u - 8}`;
  return tr`box ${u - 17}`;
}
