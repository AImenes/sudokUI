# Search: the static pages

The app itself is a single page that renders in the browser, which search
engines handle poorly. Everything sudokUI wants to be found for is therefore
also published as plain HTML, generated at build time from the same content
the app shows.

## What is generated

`npm run build` runs `scripts/build-learn.ts` after the Vite build. It writes
into `dist/`:

| Address | What it is |
| --- | --- |
| `/learn/` | every technique, grouped by family |
| `/learn/<technique>/` | one page per technique (80) |
| `/learn/img/<technique>.svg` | the board diagram of its worked example |
| `/learn/glossary/` | the glossary |
| `/sudoku-difficulty-rating/` | how the rating works, the bands, every score, and a paste-a-puzzle box |
| `/sudoku-solver/`, `/daily-sudoku/`, `/hodoku/` | landing pages |
| `/sitemap.xml` | the home page plus all of the above |

The pages are self-contained HTML with one inline stylesheet: no React, no
service worker, and script only on the paste-a-puzzle box.

## Where the content lives

All of it is in `src/content/`, and the app reads the same modules:

- `techniqueDocs.ts`: what / why / how to spot, per technique
- `glossary.ts`: the terms; `glossaryLinks.ts` links them inside running text
- `rating.ts`, `categories.ts`, `landing.ts`: supporting copy
- `examples.json`: one real position per technique (see below)
- `learnPages.ts`: turns the above into pages; `boardSvg.ts` draws the boards

`tests/content.test.ts` holds the content to its rules: a documented entry
for every technique, hard word limits, house style (British spelling, no
dashes as punctuation), no dangling glossary references, and pages that are
well-formed, self-canonical and fully linked.

## Worked examples

`examples.json` is produced by a hunt, not written by hand:

```bash
npx vite-node scripts/hunt-examples.ts        # hunt for 15 minutes
npx vite-node scripts/hunt-examples.ts 40     # or longer, for the rare ones
npx vite-node scripts/hunt-examples.ts refresh
```

The hunt generates puzzles, and for every technique that a puzzle reaches
with nothing harder before it, keeps the clearest position found so far (a
small pattern on a well-filled board). It only ever improves on what is
stored.

`tests/examples.test.ts` re-derives every stored example from its puzzle. It
fails when a finder, or the wording of its description, has changed since
the examples were stored. Run `refresh` to bring them back in line: it keeps
the puzzles and re-computes the steps.

## Addresses are permanent

A technique's address is derived from its name (`src/content/slugs.ts`).
Renaming a technique would silently move its page and break every link and
search result pointing at it, so the full map of addresses is frozen by a
snapshot in `tests/content.test.ts`.

- Adding a technique: run the tests, add the new line the snapshot asks for.
- Renaming a technique: keep the old address with an entry in
  `SLUG_OVERRIDES`, or add a redirect line to `public/_redirects`
  (`/learn/old/ /learn/new/ 301`).

## Deep links into the app

These are a public interface (the pages use them, and the future iOS app
must accept them too):

| Link | Does |
| --- | --- |
| `/#p=<81 characters>` | opens and rates that puzzle |
| `/#s=<position>` | opens a shared position |
| `/#practice=<TECHNIQUE>` | starts a practice puzzle for the technique |
| `/#learn=<TECHNIQUE>` | opens the guide at the technique |
| `/#learn=glossary`, `/#learn=rating` | opens the guide at that tab |
| `/#daily` | starts today's daily puzzle |

`<TECHNIQUE>` is a catalogue key (`X_WING`) or a page address (`x-wing`).

## The service worker and unknown addresses

Two settings keep the pages reachable:

- `vite.config.ts` tells the service worker to answer only `/` with the app
  shell. Without that, a visitor who already has the app installed would get
  the game instead of the article.
- `wrangler.jsonc` answers unknown addresses with a real 404
  (`public/404.html`) instead of the app.

## Things only the site owner can do

None of these can be done from the repository:

1. **Google Search Console**: verify `sudokui.app` as a Domain property (a
   DNS record in Cloudflare), then submit `https://sudokui.app/sitemap.xml`
   and request indexing for `/learn/` and `/sudoku-difficulty-rating/`.
2. **Bing Webmaster Tools**: verify (it can import from Search Console) and
   submit the same sitemap. Bing's index also feeds DuckDuckGo, Yahoo and
   several AI search tools.
3. **Cloudflare**: enable Crawler Hints (Caching, Configuration). It tells
   search engines when pages change.
4. **GitHub**: set the repository's Website field to `https://sudokui.app`.
5. **Links**: a new site ranks on the links it earns. The rating page and the
   technique guide are the parts worth showing to the sudoku community
   (r/sudoku, the Sudoku Players' Forum), where they answer a real question.

## For the iOS app, later

- The deep links above are what the app should accept.
- The Smart App Banner, App Store markup and store badge all need the App
  Store ID and must wait for it.
- `/.well-known/apple-app-site-association` needs the Team ID and bundle ID.
  Exclude `/learn/*` there so articles keep opening in the browser.
- Inside a Capacitor build, links to `/learn/` must become absolute
  `https://sudokui.app/learn/...` links opened in the system browser.
