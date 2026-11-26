# The advent calendar on paper

A poster and a flyer for the sudoku advent calendar (1 to 24 December),
in Norwegian (bokmål) and English, for noticeboards: libraries, senior
centres, cafés, churches, sports clubs and the boards of housing
associations. Each has a QR code that opens the calendar's page in its
language, and the address written out under it for anyone who would
rather type it.

## The files

| File | What it is | Paper |
|---|---|---|
| `advent-poster-a4.nb.pdf` | The poster, Norwegian | A4, upright |
| `advent-poster-a4.en.pdf` | The poster, English | A4, upright |
| `advent-flyer-a5.nb.pdf` | The flyer, Norwegian | A5, upright |
| `advent-flyer-a5.en.pdf` | The flyer, English | A5, upright |
| `advent-flyers-2up-a4.nb.pdf` | Two Norwegian flyers on one A4 sheet, with a dashed line to cut along | A4, on its side |
| `advent-flyers-2up-a4.en.pdf` | Two English flyers on one A4 sheet, with a dashed line to cut along | A4, on its side |

Each PDF has a PNG of the same name: a picture of the sheet, to look at
before printing or to send to someone who asks what it looks like. Print
the PDF, not the PNG.

The Norwegian code opens `https://sudokui.app/nb/julekalender/?utm_source=poster`
and its sheet says `sudokui.app/nb/julekalender` under it. The English
code opens `https://sudokui.app/advent/?utm_source=poster` and says
`sudokui.app/advent`.

## How to print

- **Print at 100 %.** In the print dialog choose "Actual size" (or
  "100 %", "Scale: 100"), not "Fit to page" or "Shrink to fit". The
  sheets already have a white edge of 8 to 10 mm, so nothing is cut off.
- **The paper:** A4 for the poster and for the sheet of two flyers, A5 for
  the single flyer. Most home printers have no A5 paper: print the sheet
  of two flyers on A4 instead (choose landscape if the printer asks) and
  cut along the dashed line in the middle. Two flyers per sheet also
  halves the ink.
- **Colour or black and white** both work. The code is black on white,
  and the text stays dark in grey.
- **Larger:** a print shop can print the poster on A3 at 141 %. The code
  grows with it and still reads.
- **Check one before you hang it:** scan the printed code with your own
  phone's camera. It should open the calendar's page. If it does not,
  the printer scaled the sheet or smudged the code: print again at
  100 %.
- **Before you print many, test the count once.** After the Worker with
  the poster tag is deployed, scan one test print with an iPhone's
  camera, with Google Lens on an Android phone (the Google app's camera
  or the Lens button) and, if you can borrow one, with a Samsung phone's
  camera. Then open `/admin` and look at today's row in "Landings per
  day by word, last 28 days": the scans should be under `poster`, not
  `none`, `search` or `other`. Write the result in `docs/launch-log.md`.

## Where to hang it, and asking first

Always ask before you put something up. A noticeboard belongs to
someone, and a poster put up with a yes stays up.

- **A library:** ask at the desk. Many have a board for local happenings,
  and some will put flyers out by the newspapers.
- **A senior centre:** ask the staff, and offer a few flyers to whoever
  runs the activities. The doors start very easy, so this is a good
  place for the calendar. Some people will rather type the address than
  scan: it is on every sheet.
- **A café:** ask the person at the counter; the board by the door or the
  toilets is where people stand and read.
- **A church:** ask the parish office. They may also put a line in the
  newsletter: the text is in `docs/launch-posts-2026-12.md`.
- **A sports club:** the clubhouse board; ask the club's leader or the
  person who runs the kiosk.
- **A housing association:** the board in the entrance; ask the
  association's board first.

Never on lamp posts, bus shelters or other public places without
permission. Take them down in January: the calendar closes on
31 December.

## How the visits show on the dashboard

The code's address carries the tag `utm_source=poster`. An iPhone's
camera opens a link without saying where it came from, so without the
tag a scan would count as `none`, the same as a typed address. An
Android phone may say nothing too, or name only the app that scanned
the code: Google Lens opens it in the Google app, which alone would
count as `search`, and a Samsung camera or a scanner app as `other`.
With the tag, the landing gets the word `poster` in each of these cases
(worker/telemetry.ts, `LINK_TAGS`, `landingWord`). On `/admin`:

- **Christmas: the advent calendar**, "Where the calendar's landings
  came from": the row **Paper: a poster's or a flyer's QR code**.
- **Landings per day by word, last 28 days**: the column **poster**, day
  by day (the same landings are in the Advent column too).
- **The reading to copy** at the top: `calendar page ... (poster ...)`,
  in a week that had any.

What it cannot tell:

- **Which poster.** Every poster and flyer carries the same word, so a
  library and a café cannot be told apart. To judge one place, hang
  there first and read the `poster` column for a few days before the
  next; write each date in `docs/launch-log.md`.
- **A typed address** (`sudokui.app/advent`) counts as `none`, as every
  typed address does.
- **A scan shared on.** If someone copies the address from the browser
  after scanning and sends it on, the tag goes with it: a friend who
  opens it from an app that says nothing also counts as `poster`. That is
  still the poster's doing.

Nothing about the person who scanned is kept: only the word, which page
it was, and the country (the privacy page, `/privacy/`, says so).

## Making them again

```sh
npx vite-node scripts/print-poster.ts
```

It needs Playwright's Chromium (the one the browser tests use). It
draws every sheet, reads each code back from its preview with a QR
decoder, in colour and in grey, and stops with an error if a code does
not read as its exact address or a PDF is not one page of its paper.
Grey renders, to see how a black-and-white printer will do, go to
`.vite/print-grey/`. `tests/printPoster.test.ts` reads the files here
the same way. The words are in the script (`WORDS`); the addresses and
the paper sizes in `scripts/print-poster/sheets.ts`.
