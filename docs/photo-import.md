# Design: photo import ("scan a puzzle from a book")

Goal: point the camera at (or upload a photo of) a printed sudoku and get it
onto the board, rated and ready to play — entirely on-device, no server.

## Pipeline

1. **Capture** — `<input type="file" accept="image/*" capture="environment">`
   works on every platform (web, iOS/Android via Capacitor) with zero
   permissions code; upgrade later to a live `getUserMedia` viewfinder.

2. **Grid detection** — find the largest quadrilateral:
   - greyscale → adaptive threshold → largest connected contour
   - fit a quad to it, reject if not roughly square
   - perspective-transform to a flat 900×900 image (pure canvas math —
     a 3×3 homography; no OpenCV dependency needed)

3. **Cell classification** — split into 81 cells (with margin cropping):
   - empty-cell detection first: ink-pixel ratio below threshold → empty
   - digit cells go to OCR

4. **Digit OCR** — two candidate approaches, to be benchmarked:
   - `tesseract.js` with `tessedit_char_whitelist=123456789` and PSM
     single-char mode (~2 MB wasm, lazy-loaded only when the feature is used)
   - a tiny CNN trained on printed digits (MNIST-style but for print fonts),
     shipped as a few-hundred-KB ONNX/tfjs model — likely faster and more
     accurate on book fonts; more build work

5. **Validation + review UI** — this is what makes it usable:
   - run the brute-force solver: exactly one solution → high confidence
   - 0 or 2+ solutions → highlight the least-confident OCR cells for manual
     correction in a review grid before starting the game
   - the review step must always be shown; OCR is never trusted blindly

## Ship criteria

Feature ships only when a test set of ~30 photos of book/newspaper puzzles
(varied lighting, slight rotation, page curvature) reaches >95 % puzzle-level
accuracy after the review step. Until then it stays behind a dev flag.

## Effort estimate

Steps 1–3 and 5 are deterministic and testable in isolation (~2–3 sessions).
Step 4 is the risk; start with tesseract.js to validate the pipeline, swap in
a small model if accuracy disappoints.
