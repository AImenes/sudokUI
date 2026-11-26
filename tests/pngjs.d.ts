// The one function of pngjs (a devDependency, MIT) that the print
// sheets' reader uses (scripts/print-poster/read.ts, read by
// tests/printPoster.test.ts): a PNG file decoded to its pixels, four bytes
// each, red, green, blue and alpha. The package ships no types, and
// @types/pngjs would bring @types/node, which tests/node.d.ts stands in
// for on purpose.
declare module 'pngjs' {
  export const PNG: {
    sync: {
      read(data: Uint8Array): { width: number; height: number; data: Uint8Array };
    };
  };
}
