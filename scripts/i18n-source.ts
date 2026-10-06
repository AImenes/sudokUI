// What the source asks to be translated, read with the TypeScript compiler:
//
// - interface keys: the English text in every t('...') and msg('...') call
//   (src/content/i18n.ts), both branches of t(a ? '...' : '...') included;
// - engine templates: every tr`...` sentence (src/engine/text.ts), keyed
//   with numbered holes;
// - English left unwrapped: interface text in JSX, in the attributes people
//   read (title, aria-label, placeholder, alt), in the fields that carry
//   messages (notice, label, title, text...), and engine prose that is not
//   a tr template.
//
// tests/i18n.test.ts holds the translations to this; scripts/i18n.ts
// prints it as a report, which is also the to-do list while translating.
import ts from 'typescript';
import { templateKey } from '../src/engine/text';

export interface Place {
  file: string;
  line: number;
}

export interface Finding extends Place {
  kind: string;
  text: string;
}

export interface SourceReport {
  /** English key -> where it is used */
  uiKeys: Map<string, Place[]>;
  /** template key -> where it is written */
  engineKeys: Map<string, Place[]>;
  /** t() / msg() with a template literal that has holes: not allowed */
  badKeys: Finding[];
  /** English that should be translated but is not wrapped */
  untranslated: Finding[];
}

// the source as text, through Vite (vitest and vite-node both have it), so
// this module needs no Node types; keys are '/src/ui/App.tsx' and the like
const SOURCES = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/content/locales/**', '!/src/**/*.d.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

/** source files to scan, relative to the repository, with forward slashes */
function sourceFiles(): string[] {
  return Object.keys(SOURCES).map((k) => k.slice(1)).sort();
}

/** interface files: where English that people read must be wrapped */
const isUi = (f: string) => f.startsWith('src/ui/') || f.startsWith('src/state/') || f === 'src/main.tsx';
/** engine files whose prose must be tr templates; ratings.ts holds names and categories, which stay keys */
const isEngineProse = (f: string) =>
  f.startsWith('src/engine/') && !['src/engine/ratings.ts', 'src/engine/text.ts', 'src/engine/worker.ts'].includes(f);

/** text a person would read: letters forming a word, beyond a lone symbol or key name */
const LETTERS = /[A-Za-z]{2,}/;
/** prose: two words or more */
const PROSE = /[A-Za-z]{2,}[^A-Za-z]+[A-Za-z]{2,}/;
/** strings in the interface that are not words to translate */
const UI_ALLOW = new Set(['sudokUI', 'HoDoKu', 'GitHub', 'Nutella', 'Ctrl', 'Shift', 'Alt', 'Esc', 'Enter', 'Tab', 'Space', 'Backspace', 'Del', 'OK', 'r1c1', 'UTC', 'PNG', 'SVG', 'Auto']);
const MESSAGE_FIELDS = new Set(['notice', 'chainNote', 'message', 'text', 'title', 'label', 'heading', 'description', 'note', 'why', 'hint', 'lead', 'caption', 'name', 'what', 'placeholder', 'tip', 'summary']);
const READ_ATTRIBUTES = new Set(['title', 'aria-label', 'placeholder', 'alt', 'label', 'aria-description', 'aria-roledescription', 'aria-valuetext']);

function cooked(node: ts.TemplateLiteral): string[] {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
}

/** the English a literal says, for the lint; null when it is not a literal */
function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return cooked(node).join('…');
  return null;
}

const readable = (text: string) => {
  if (!LETTERS.test(text)) return false;
  const words = text.match(/[A-Za-z][A-Za-z0-9+]*/g) ?? [];
  return words.some((w) => w.length > 1 && !UI_ALLOW.has(w));
};

/** a call to t(...) or msg(...) */
function keyCall(node: ts.Node): ts.CallExpression | null {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (ts.isIdentifier(callee) && (callee.text === 't' || callee.text === 'msg')) return node;
  return null;
}

/** inside the arguments of a call that translates or marks, or a tr template: already handled */
function wrapped(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isTaggedTemplateExpression(p) && ts.isIdentifier(p.tag) && p.tag.text === 'tr') return true;
    if (ts.isCallExpression(p)) {
      const c = p.expression;
      if (ts.isIdentifier(c) && ['t', 'msg', 'rich', 'fill'].includes(c.text)) return true;
      // errors and logs are for developers
      if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'console') return true;
    }
    if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && /Error$/.test(p.expression.text)) return true;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    // the left of a comparison is a value, not a message: s.mode === 'corner'
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
    if (ts.isCaseClause(p) && p.expression === node) return true;
    if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
    if (ts.isTypeNode(p) || ts.isLiteralTypeNode(p)) return true;
  }
  return false;
}

export function readSource(): SourceReport {
  const report: SourceReport = { uiKeys: new Map(), engineKeys: new Map(), badKeys: [], untranslated: [] };
  const add = (map: Map<string, Place[]>, key: string, place: Place) => {
    const list = map.get(key) ?? [];
    list.push(place);
    map.set(key, list);
  };
  for (const file of sourceFiles()) {
    const text = SOURCES['/' + file];
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const place = (node: ts.Node): Place => ({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    const flag = (node: ts.Node, kind: string, text: string) => report.untranslated.push({ ...place(node), kind, text });

    const keysOf = (expr: ts.Expression, call: ts.Node) => {
      while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
      if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) add(report.uiKeys, expr.text, place(call));
      else if (ts.isConditionalExpression(expr)) {
        keysOf(expr.whenTrue, call);
        keysOf(expr.whenFalse, call);
      } else if (ts.isTemplateExpression(expr)) {
        report.badKeys.push({ ...place(call), kind: 'template key', text: expr.getText(sf) });
      }
      // anything else is a key chosen at run time, marked with msg() where it was written
    };

    const visit = (node: ts.Node) => {
      const call = keyCall(node);
      if (call && call.arguments.length) keysOf(call.arguments[0], call);

      if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'tr') {
        add(report.engineKeys, templateKey(cooked(node.template)), place(node));
      }

      if (isUi(file)) {
        if (ts.isJsxText(node) && readable(node.text.trim()) && node.text.trim()) flag(node, 'jsx text', node.text.trim());
        if (ts.isJsxAttribute(node) && READ_ATTRIBUTES.has(node.name.getText(sf)) && node.initializer) {
          const init = node.initializer;
          const lit = ts.isStringLiteral(init) ? init.text : ts.isJsxExpression(init) && init.expression ? literalText(init.expression) : null;
          if (lit !== null && readable(lit)) flag(node, `attribute ${node.name.getText(sf)}`, lit);
        }
        if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
          const scan = (e: ts.Node) => {
            const lit = literalText(e);
            if (lit !== null) {
              if (readable(lit) && !wrapped(e)) flag(e, 'jsx expression', lit);
              return;
            }
            if (ts.isConditionalExpression(e)) {
              scan(e.whenTrue);
              scan(e.whenFalse);
            } else if (ts.isBinaryExpression(e)) {
              scan(e.left);
              scan(e.right);
            } else if (ts.isParenthesizedExpression(e)) scan(e.expression);
          };
          scan(node.expression);
        }
        if (ts.isPropertyAssignment(node) && MESSAGE_FIELDS.has(node.name.getText(sf).replace(/['"]/g, ''))) {
          const scan = (e: ts.Node) => {
            const lit = literalText(e);
            if (lit !== null) {
              if ((/\s/.test(lit.trim()) || /^[A-Z][a-z]/.test(lit)) && readable(lit) && !wrapped(e)) flag(e, `field ${node.name.getText(sf)}`, lit);
              return;
            }
            if (ts.isConditionalExpression(e)) {
              scan(e.whenTrue);
              scan(e.whenFalse);
            } else if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
              scan(e.left);
              scan(e.right);
            } else if (ts.isParenthesizedExpression(e)) scan(e.expression);
          };
          scan(node.initializer);
        }
        if (ts.isCallExpression(node)) {
          const c = node.expression;
          const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : '';
          if (['alert', 'confirm', 'prompt'].includes(name)) {
            for (const a of node.arguments) {
              const lit = literalText(a);
              if (lit !== null && readable(lit)) flag(a, `${name}()`, lit);
            }
          }
        }
      }

      if (isEngineProse(file) && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))) {
        const parent = node.parent;
        const tagged = ts.isTaggedTemplateExpression(parent) && ts.isIdentifier(parent.tag) && parent.tag.text === 'tr';
        const lit = literalText(node)!;
        // a technique id (NICE_LOOP) is a key, not prose
        if (!tagged && PROSE.test(lit) && !/^[A-Z][A-Z0-9_]*$/.test(lit) && !wrapped(node)) flag(node, 'engine prose', lit);
      }

      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return report;
}

/** the {name} placeholders of an interface string */
export const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

/** the {0}, {1}... holes of an engine template */
export const holes = (s: string) => [...new Set([...s.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
