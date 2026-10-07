// The one Node module the tests read files with. The app's tsconfig has
// no Node types on purpose (the engine and the content run in browsers,
// and scripts/i18n-source.ts reads the source through Vite for the same
// reason), so the few functions a test needs are declared here, no wider
// than they are used. Vitest runs on Node, where they exist. Delete this
// file if @types/node is ever added: it would hide the real signatures.
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function readdirSync(path: string): string[];
  export function existsSync(path: string): boolean;
}
