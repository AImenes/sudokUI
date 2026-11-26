// The Node modules the tests use: node:fs to read files (and, on request,
// to write the fixtures of tests/drawingSnapshot.test.ts and
// tests/pathDigest.test.ts), node:process for the variables that make
// that request, and node:module for node:sqlite, which runs the D1
// schema (tests/telemetry.test.ts); and, for the one test that runs a
// script as the command line does, in a folder of its own
// (tests/adventBuild.test.ts): the folder's making and removal, its
// path, and the process's arguments and working folder. The app's tsconfig has no Node types
// on purpose (the engine and the content run in browsers, and
// scripts/i18n-source.ts reads the source through Vite for the same
// reason), so the few functions a test needs are declared here, no wider
// than they are used. Vitest runs on Node, where they exist. Delete this file if @types/node is ever
// added: it would hide the real signatures.
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function readdirSync(path: string): string[];
  export function existsSync(path: string): boolean;
  export function writeFileSync(path: string, data: string): void;
  /** tests/pathBefore.ts, listing the positions the tests ask for, on request */
  export function appendFileSync(path: string, data: string): void;
  export function mkdtempSync(prefix: string): string;
  export function mkdirSync(path: string, options: { recursive: boolean }): void;
  export function rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
declare module 'node:module' {
  /** a require for a built-in module, node:sqlite (the schema of migrations/ in tests/telemetry.test.ts) */
  export function createRequire(url: string): (id: string) => any;
}
declare module 'node:process' {
  export const env: Record<string, string | undefined>;
  /** the process itself, the same object a script reads as the global `process` */
  const process: { argv: string[]; cwd(): string; env: Record<string, string | undefined> };
  export default process;
}
