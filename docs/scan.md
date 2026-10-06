# Scanning a photo

Import, then "Scan a photo", or New game, Custom, "Or scan a photo of one": a printed puzzle (a newspaper, a book, a
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
3. Among the candidates, the one that shows grid lines after warping
   wins (`gridness`): a table edge or a loudspeaker's rim is large,
   square-ish and mostly empty too. A homography from the four corners,
   and a perspective warp to a 450 × 450 square.
4. The lines where they really are: the four thick box lines are
   unmistakable peaks of the ink profile; the thin lines sit a third of
   the way between them, give or take a few pixels. Each line is then
   followed strip by strip, so a page that curves is cut along its
   lines (`trackLines`), and the lines are painted over before the cells
   are read, so no line is left to merge with a digit.
5. Each cell, between its own tracked lines and read at three horizontal
   offsets in case the warp is a few pixels off: a margin keeps the lines
   out, thin or hollow ink touching the border is dropped (a line that
   leaked in), the blob is cropped to its box, scaled to fit, centred in
   24 × 24 and blurred a little. Too little ink, a sliver, or a sparse
   mark is an empty cell.
6. Recognition by zero-mean correlation against templates, less a penalty
   for a different width (a narrow 1 is not a 4): digits 1 to 9 in five
   common font families, regular and bold, drawn on a canvas at runtime
   and normalised exactly like a blob (`src/scan/scanner.ts`). Printed
   digits only, by design. The fonts the device has decide how well a
   book's face matches: a phone or a Mac draws Helvetica and Arial, which
   is what most printed puzzles use.
7. All eight symmetries of the warped grid are read (four rotations, each
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

## Measured on a real photo

A paperback held under a desk lamp, photographed at an angle with the
page curving into the spine (the first photo the author sent): the grid
was found among a loudspeaker and a table edge, straightened, and 24 of
its 25 digits detected; 21 read right, and all but one of the rest were
flagged as doubts for the eye to settle on the review board. The
remaining misreads are a bold Helvetica 1 and 9 against templates drawn
in the test machine's fonts. The tuning loop for the next photo is
`scanDebug` on `window.__sudokuiScan`, which returns the candidates,
the lines and any cell's blob as text.

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
