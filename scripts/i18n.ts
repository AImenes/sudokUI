// Translation tools. Fragments: while several people (or agents) translate
// different files at once, each writes its strings to a JSON fragment of
// its own instead of to the shared tables, and the fragments are merged
// afterwards. A fragment:
//
//   {
//     "files": ["src/ui/Controls.tsx"],
//     "ui":     { "<English key>":   { "nb": "...", "es": "...", "note": "optional context" } },
//     "engine": { "<template key>":  { "nb": "...", "es": "..." } }
//   }
//
//   npx vite-node scripts/i18n.ts report [--all]
//       what the source asks to be translated, and the English still
//       unwrapped, by file (--all lists every piece)
//   npx vite-node scripts/i18n.ts check <fragment.json>
//       every key the fragment's files use is there, with both languages,
//       the same placeholders / holes, and nothing left unwrapped in them
//   npx vite-node scripts/i18n.ts merge <folder>
//       adds every fragment in the folder to src/content/locales/
//       ui.<lang>.ts and engine.<lang>.ts (a fragment's text replaces the
//       table's), removes entries the source no longer uses, and lists
//       the changes, the removals and conflicts between fragments
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readSource, placeholders, holes, Finding } from './i18n-source';
import { english } from '../src/content/i18n';
import uiNb from '../src/content/locales/ui.nb';
import uiEs from '../src/content/locales/ui.es';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

const TABLES = { ui: { nb: uiNb, es: uiEs }, engine: { nb: engineNb, es: engineEs } };

interface Entry {
  nb: string;
  es: string;
  note?: string;
}
interface Fragment {
  files: string[];
  ui?: Record<string, Entry>;
  engine?: Record<string, Entry>;
}

const LANGS = ['nb', 'es'] as const;
const args = process.argv.slice(2);

function check(path: string): string[] {
  const frag: Fragment = JSON.parse(readFileSync(path, 'utf8'));
  const problems: string[] = [];
  const src = readSource();
  const inFiles = (places: { file: string }[]) => places.some((p) => frag.files.includes(p.file));
  for (const [kind, keys, table] of [
    ['ui', src.uiKeys, frag.ui ?? {}],
    ['engine', src.engineKeys, frag.engine ?? {}]
  ] as const) {
    for (const [key, places] of keys) {
      if (!inFiles(places)) continue;
      const e = table[key];
      if (!e) {
        problems.push(`missing ${kind} key (${places.map((p) => `${p.file}:${p.line}`).join(', ')}): ${key}`);
        continue;
      }
      for (const lang of LANGS) {
        const text = e[lang];
        if (typeof text !== 'string' || !text.trim()) {
          problems.push(`${lang} empty for ${kind} key: ${key}`);
          continue;
        }
        if (kind === 'ui' && placeholders(text).join() !== placeholders(english(key)).join()) {
          problems.push(`${lang} placeholders differ for: ${key}\n      ${text}`);
        }
        if (kind === 'engine') {
          const want = (key.match(/\{\d+\}/g) ?? []).length;
          const got = holes(text);
          if (got.length !== want || got.some((h, i) => h !== i)) problems.push(`${lang} holes differ (want {0}..{${want - 1}}) for: ${key}\n      ${text}`);
        }
      }
    }
    for (const key of Object.keys(table)) {
      if (!keys.has(key)) problems.push(`${kind} key in the fragment but not in the source (stale or mistyped): ${key}`);
    }
  }
  for (const f of src.untranslated) if (frag.files.includes(f.file)) problems.push(`not wrapped ${f.file}:${f.line} [${f.kind}] ${f.text.slice(0, 120)}`);
  for (const f of src.badKeys) if (frag.files.includes(f.file)) problems.push(`key built at run time ${f.file}:${f.line}: ${f.text}`);
  return problems;
}

/** a JS object literal, one entry per line, keys and values JSON-quoted */
function table(entries: [string, string][], indent = '  '): string {
  return entries.map(([k, v]) => `${indent}${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
}

function rewrite(file: string, name: string, entries: Record<string, string>) {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const open = src.indexOf(`const ${name}: `);
  const start = src.indexOf('{', open);
  // the object closes on a line of its own, or at once when written {}
  const after = src.startsWith('{}', start) ? start + 2 : src.indexOf('\n};', start) + 2;
  if (after < start) throw new Error(`${file}: cannot find the end of ${name}`);
  const sorted = Object.entries(entries);
  const body = sorted.length ? `{\n${table(sorted)}\n}` : '{}';
  writeFileSync(file, src.slice(0, start) + body + src.slice(after));
}

async function merge(folder: string) {
  const conflicts: string[] = [];
  const changed: string[] = [];
  const pruned: string[] = [];
  const src = readSource();
  for (const kind of ['ui', 'engine'] as const) {
    for (const lang of LANGS) {
      const file = `src/content/locales/${kind}.${lang}.ts`;
      const current: Record<string, string> = { ...TABLES[kind][lang] };
      const origin: Record<string, string> = Object.fromEntries(Object.keys(current).map((k) => [k, 'existing']));
      for (const name of readdirSync(folder).filter((n) => n.endsWith('.json')).sort()) {
        const frag: Fragment = JSON.parse(readFileSync(join(folder, name), 'utf8'));
        for (const [key, e] of Object.entries(frag[kind] ?? {})) {
          const text = e[lang];
          if (current[key] !== undefined && current[key] !== text) {
            // a fragment improves what the table already says; two fragments that disagree are a conflict
            if (origin[key] === 'existing') changed.push(`${kind}.${lang} ${JSON.stringify(key)}\n    was: ${current[key]}\n    now: ${text}`);
            else {
              conflicts.push(`${kind}.${lang} ${JSON.stringify(key)}\n    ${origin[key]}: ${current[key]}\n    ${name}: ${text}`);
              continue; // the first fragment stays
            }
          }
          current[key] = text;
          origin[key] = origin[key] === undefined || origin[key] === 'existing' ? name : origin[key];
        }
      }
      // what the source no longer asks for goes (a template reworded, a string removed)
      const used = kind === 'ui' ? src.uiKeys : src.engineKeys;
      for (const key of Object.keys(current)) {
        if (!used.has(key)) {
          pruned.push(`${kind}.${lang} ${JSON.stringify(key)}`);
          delete current[key];
        }
      }
      rewrite(file, kind, current);
      console.log(`${file}: ${Object.keys(current).length} entries`);
    }
  }
  if (changed.length) {
    console.log(`\n${changed.length} translations changed by a fragment:`);
    for (const c of changed) console.log(`  ${c}`);
  }
  if (pruned.length) {
    console.log(`\n${pruned.length} entries removed, no longer in the source:`);
    for (const p of pruned) console.log(`  ${p}`);
  }
  if (conflicts.length) {
    console.log(`\n${conflicts.length} conflicts between fragments (the first was kept):`);
    for (const c of conflicts) console.log(`  ${c}`);
  }
}


function report() {
  const r = readSource();
  const all = args.includes('--all');
  console.log(`${r.uiKeys.size} interface keys, ${r.engineKeys.size} engine templates`);
  if (r.badKeys.length) {
    console.log(`
${r.badKeys.length} keys built at run time (use placeholders):`);
    for (const f of r.badKeys) console.log(`  ${f.file}:${f.line}  ${f.text}`);
  }
  const byFile = new Map<string, Finding[]>();
  for (const f of r.untranslated) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  console.log(`
${r.untranslated.length} pieces of English not yet wrapped, in ${byFile.size} files:`);
  for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(list.length).padStart(4)}  ${file}`);
    if (all) for (const f of list) console.log(`        ${f.line}  [${f.kind}] ${f.text.slice(0, 140)}`);
  }
}

if (args[0] === 'report') {
  report();
} else if (args[0] === 'check') {
  const problems = check(args[1]);
  if (!problems.length) console.log('fragment complete: every key of its files, both languages, placeholders kept, nothing unwrapped');
  else {
    console.log(`${problems.length} problems:`);
    for (const p of problems) console.log(`  ${p}`);
    process.exitCode = 1;
  }
} else if (args[0] === 'merge') {
  await merge(args[1]);
} else {
  console.log('usage: i18n.ts report [--all] | check <fragment.json> | merge <folder>');
}
