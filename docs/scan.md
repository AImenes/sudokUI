# Scanning a photo

Import, then "Scan a photo": a printed puzzle (a newspaper, a book, a
screen) read off a photo into the custom-entry board, checked by eye and
by the validator before play. In-house and offline from the first use:
no model download, no service, about 20 KB of code.

## How it reads

`src/scan/image.ts`, on plain typed arrays with no DOM (tested in node):

1. Grey, then ink by adaptive threshold (darker than the local mean).
2. The grid: the ink component whose bounding box is large, roughly
   square and mostly empty inside (lines, not a photo), with its corners
   at the component's extreme pixels along the two diagonals. No grid
   found means the whole photo is taken as the grid (a tight crop).
3. A homography from the four corners, and a perspective warp to a
   450 × 450 square: 81 cells of 50 px.
4. Each cell: a margin keeps the lines out, ink touching the border is
   dropped (a line that leaked in), the blob is cropped to its box,
   scaled to fit, centred in 24 × 24 and blurred a little. Too little ink
   is an empty cell.
5. Recognition by zero-mean correlation against templates: digits 1 to 9
   in five common font families, regular and bold, drawn on a canvas at
   runtime and normalised exactly like a blob (`src/scan/scanner.ts`).
   Printed digits only, by design.
6. All eight symmetries of the warped grid are read (four rotations, each
   also mirrored). The reading with the best total match, less a penalty
   per duplicate digit in a house, wins. A photo taken upside down, or
   through a mirroring front camera, reads the same.

## What the player sees

- The camera: a file input (the phone offers the camera or the library),
  and on devices with getUserMedia a live view with Snap, which is how a
  laptop or an iPad uses its front camera. Both paths end in `scanImage`
  on a Blob, so a native camera plugin in an app can feed it too.
- Fewer than 17 digits read means a message, not a board.
- Otherwise the digits land on the custom-entry board, with the
  scanner's doubts shaded and the straightened grid shown beside the
  board for comparison. "Check & play" runs the same validation as any
  custom puzzle: a unique solution, then a rating. A misread digit is
  caught there, and fixed on the board.

## Limits

Printed digits only; handwritten ones are not in the templates. Heavy
shadows, a curved page or a grid that fills less than a third of the
frame may defeat the grid finder. The scan runs on the main thread in a
few hundred milliseconds at 900 px.

## Tests

`tests/scan.test.ts`: synthetic photos with nine block glyphs chosen to be
unlike each other and their mirror images are read back under all eight
symmetries and from an angle. `tests/e2e/smoke.spec.ts`: a puzzle
rendered in a serif and a sans-serif face, upright, turned, mirrored,
skewed and under uneven light, screenshotted and fed through the file
input; every digit must be right, since "Check & play" refuses anything
without a unique solution.
