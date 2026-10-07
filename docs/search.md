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
| `/learn/intuition/` | how the techniques fit together: the ideas behind the families, each also explained "like I'm 12", and where the names came from |
| `/learn/img/intuition-<diagram>.svg` | the Intuition guide's schematic diagrams |
| `/learn/glossary/` | the glossary |
| `/sudoku-difficulty-rating/` | how the rating works, the bands, every score, and a paste-a-puzzle box |
| `/sudoku-solver/`, `/daily-sudoku/`, `/hodoku/`, `/how-the-best-solve/` | landing pages |
| `/nb/…`, `/es/…` | every page above (techniques, Intuition, glossary, rating, landing pages) in Norwegian and Spanish, at the English address under the language's prefix (`/nb/daily-sudoku/`, `/es/learn/x-wing/`) |
| `/learn/img/intuition-<diagram>.<lang>.svg` | the Intuition diagrams with Norwegian and Spanish labels |
| `/sitemap.xml` | the home pages `/`, `/nb/` and `/es/` plus all of the above, each with its language versions |

Every page names its three language versions with `hreflang` links
(English is `x-default`) and has a language line in its footer; see
`docs/translations.md`. The home pages `/`, `/nb/` and `/es/` are the app
itself in each language (`index.html`, filled in by `src/content/home.ts`),
and alternates of each other in the same way.

The pages are self-contained HTML with one inline stylesheet: no React, no
service worker, and script only on the paste-a-puzzle box.

## Where the content lives

All of it is in `src/content/`, and the app reads the same modules:

- `techniqueDocs.ts`: what / why / how to spot, per technique
- `glossary.ts`: the terms; `glossaryLinks.ts` links them inside running text
- `intuition.ts`: the Intuition guide, built from the research brief in
  `docs/concepts_description.md`; `intuitionDiagrams.ts` draws its diagrams
- `kin.ts`: the line under each technique's name: another name, or the same
  logic in another family (a Hidden Single is a 1-fish), only where it holds
  every time
- `rating.ts`, `categories.ts`, `landing.ts`: supporting copy; `categories.ts`
  also fixes the order families are listed in, `landing.ts` the landing
  pages' addresses and links
- `examples.json`: one real position per technique (see below)
- `learnLocale.ts` gathers all of it in one language; `locales/nb.ts` and
  `locales/es.ts` are the Norwegian and Spanish versions, landing pages
  included (`docs/translations.md`)
- `learnPages.ts`: turns the above into pages; `boardSvg.ts` draws the boards

`tests/content.test.ts` holds the content to its rules: a documented entry
for every technique, hard word limits, house style (British spelling, no
dashes as punctuation), no dangling glossary references, and pages that are
well-formed, self-canonical and fully linked. `tests/intuition.test.ts` does
the same for the Intuition guide and the kin lines, and checks that no
"like I'm 12" text uses notation: no cell names, no letters standing for
digits.

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

Random generation almost never produces the rarest patterns, so the hunt
starts from a list of published puzzles known to need them (`SEEDS` in the
script). A seed is only a candidate: the example is still what the sudokUI
engine does with that puzzle, and it carries a credit line.

The same run counts how often each technique is needed and writes
`frequency.json`: the share of generated puzzles whose solve path uses the
technique at least once. The guide and the pages show it as "1 in 19
puzzles". For the big numbers there is a parallel counter that uses every
core and adds to what is stored (it never resets the count):

```bash
npx vite-node scripts/measure-frequency.ts 120     # 120 minutes on all cores
npx vite-node scripts/measure-frequency.ts 120 8   # eight workers
```

It also prints puzzles that need a still-unexampled technique, ready to
paste into the hunt's seed list, and saves practice puzzles for the rarest
techniques to `practicePuzzles.json`: puzzles that need the technique with
nothing harder before it, exactly as the browser pools them, for the
techniques its generator would take minutes to find. Practice mode serves
these before asking the generator; `tests/practicePuzzles.test.ts` holds them to
the engine like the worked examples. The hunt also takes every saved
practice puzzle as a seed, so a rare technique that the measurement run
found cleanly gets its worked example on the next `hunt-examples.ts 0`.

`tests/examples.test.ts` re-derives every stored example from its puzzle. It
fails when a finder, or the wording of its description, has changed since
the examples were stored. Run `refresh` to bring them back in line: it keeps
the puzzles and re-computes the steps.

The stored step is English. The Norwegian and Spanish pages, and the in-app
guide in those languages, explain an example in their own language: the
engine, writing in that language, finds the step again at the stored
position (`exampleStep` in `src/content/learnLocale.ts`). The same test
holds that this gives the stored step in English, and in every language the
same step, only in other words.

## Addresses are permanent

A technique's address is derived from its name (`src/content/slugs.ts`).
Renaming a technique would silently move its page and break every link and
search result pointing at it, so the full map of addresses is frozen by a
snapshot in `tests/content.test.ts`, and so are the addresses of the other
pages, in every language.

- Adding a technique or a page: run the tests, add the new line the snapshot
  asks for.
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
| `/p/<81 characters>` | the share address: opens and rates that puzzle, and previews it when pasted into a chat; `?b=`, `?s=`, `?t=` and `?vs=` carry the band, the score, up to three techniques and a challenger's time in seconds (`src/content/share.ts`) |

`<TECHNIQUE>` is a catalogue key (`X_WING`) or a page address (`x-wing`).
Each also works on `/nb/` and `/es/` (`/nb/#practice=X_WING`, `/nb/p/<81 characters>`), opening the
app in that language; the Norwegian and Spanish pages link that way, so a
reader stays in their language.

## The service worker and unknown addresses

Two settings keep the pages reachable:

- `vite.config.ts` tells the service worker to answer only the home pages
  (`/`, `/nb/`, `/es/`, `APP_NAVIGATION` in `src/content/home.ts`) with the
  app, and never the static pages (`STATIC_ROUTES` in
  `src/content/staticRoutes.ts`, in every language). Without that, a visitor
  who already has the app installed would get the game instead of the
  article.
- The build emits `nb/index.html` and `es/index.html` beside `index.html`
  (a plugin in `vite.config.ts`), so the service worker precaches all three
  home pages and `/nb/` and `/es/` open offline too.
- `wrangler.jsonc` answers unknown addresses with a real 404 instead of the
  app. Cloudflare serves the nearest `404.html` up the path, so
  `public/nb/404.html` and `public/es/404.html` answer under `/nb/` and
  `/es/` in their language; none of the three is precached.

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
  Exclude the static pages there (`/learn/*`, the landing pages, and their
  `/nb/` and `/es/` versions) so articles keep opening in the browser.
- Inside a Capacitor build, links to `/learn/` must become absolute
  `https://sudokui.app/learn/...` links opened in the system browser.
