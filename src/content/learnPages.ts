// Builds the static /learn/ pages: one crawlable, shareable HTML page per
// technique, plus an index, the glossary and the rating explainer. Pure
// string building (no DOM, no filesystem) so it is unit-testable; the
// build step in scripts/build-learn.ts writes the result into dist/.
//
// The pages carry the same content as the in-app Learn dialog and deep-link
// back into the app: /#practice=<KEY> starts a practice puzzle,
// /#learn=<KEY> opens the guide at that technique.
import {
  TECHS,
  ALL_TECHS,
  LEVELS,
  LEVEL_MAX_SCORE,
  Tech,
  Category
} from '../engine/ratings';
import { TECH_DOCS } from './techniqueDocs';
import { GLOSSARY, GLOSSARY_GROUPS } from './glossary';
import { RATING_SUMMARY, RATING_POINTS, BAND_NOTES } from './rating';
import { CATEGORY_NOTES, categoryLabel, techStatus } from './categories';
import { techSlug, slugify } from './slugs';
import { linkGlossary } from './glossaryLinks';
import { LANDING_PAGES, LandingPage, RATING_URL } from './landing';
import { EXAMPLES } from './examples';
import { boardSvg, legendOf, BOARD_SIZE } from './boardSvg';
import { FREQUENCY, frequencyLabel, byWorth } from './frequency';

export const SITE = 'https://sudokui.app';

export interface Page {
  /** file path inside dist/, e.g. learn/x-wing/index.html */
  path: string;
  /** canonical URL path, e.g. /learn/x-wing/ */
  url: string;
  html: string;
}

/** a file that accompanies the pages, e.g. a technique's board diagram */
export interface Asset {
  path: string;
  content: string;
}

const diagramUrl = (tech: Tech) => `/learn/img/${techSlug(tech)}.svg`;

/** what a technique's diagram shows, for its alt text and caption */
const diagramTitle = (tech: Tech) => `${TECHS[tech].name} example on a sudoku board`;

/** one board diagram per technique that has a worked example */
export function buildLearnAssets(): Asset[] {
  return ALL_TECHS.filter((tech) => EXAMPLES[tech]).map((tech) => ({
    path: diagramUrl(tech).slice(1),
    content: boardSvg(EXAMPLES[tech]!, diagramTitle(tech))
  }));
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** running text with its glossary terms linked to their definitions */
const linked = (text: string, exclude?: string) =>
  linkGlossary(text, exclude)
    .map((seg) =>
      seg.term
        ? `<a href="/learn/glossary/#${slugify(seg.term)}">${esc(seg.text)}</a>`
        : esc(seg.text)
    )
    .join('');

/** search results cut titles at about 60 characters: drop the brand first */
const fitTitle = (title: string) =>
  `${title} | sudokUI`.length <= 60 ? `${title} | sudokUI` : title;

/** the first candidate that fits a search result's description line */
const fitDescription = (...candidates: string[]) =>
  candidates.find((c) => c.length <= 160) ?? candidates[candidates.length - 1];

/**
 * Paste a puzzle, land in the app with it loaded and rated. The app reads
 * the puzzle from the #p= fragment, so nothing is sent to any server.
 */
const puzzleForm = (button: string) => `      <form class="rate" id="rate">
        <label for="puzzle">Paste a puzzle: 81 characters, with 0 or . for empty cells</label>
        <textarea id="puzzle" rows="3" autocomplete="off" spellcheck="false"></textarea>
        <button type="submit" class="cta">${esc(button)}</button>
        <p id="rate-error" role="alert"></p>
        <noscript><p>This box needs JavaScript. You can also <a href="/">open sudokUI</a> and choose Import.</p></noscript>
      </form>
      <script>
        document.getElementById('rate').addEventListener('submit', function (e) {
          e.preventDefault();
          var s = document.getElementById('puzzle').value.replace(/[^0-9.]/g, '');
          if (s.length === 81) location.href = '/#p=' + s;
          else document.getElementById('rate-error').textContent =
            'A puzzle needs exactly 81 cells. This one has ' + s.length + '.';
        });
      </script>`;

const techUrl = (tech: Tech) => `/learn/${techSlug(tech)}/`;
const categoryAnchor = (cat: Category) => `/learn/#${slugify(cat)}`;

const byCategory = (): [Category, Tech[]][] => {
  const map = new Map<Category, Tech[]>();
  for (const tech of ALL_TECHS) {
    const cat = TECHS[tech].category;
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(tech);
  }
  return [...map.entries()];
};

const STYLE = `
:root{--bg:#14161f;--soft:#1c1f2b;--panel:#222636;--text:#e8eaf2;--muted:#a8b0c2;--accent:#8ab6f7;--line:rgba(128,128,160,.28)}
@media (prefers-color-scheme:light){:root{--bg:#f2f4f9;--soft:#e8ebf3;--panel:#fff;--text:#23293a;--muted:#555d70;--accent:#2a5aad}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
.site{display:flex;align-items:center;gap:8px 18px;flex-wrap:wrap;padding:12px 20px;background:var(--soft);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--text);font-weight:700;font-size:20px}
.mark{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#5b8fe0,#9b74d8);color:#fff;font-weight:800;font-size:15px}
.site nav{display:flex;gap:6px 18px;flex-wrap:wrap;margin-left:auto;font-size:15px}
main{max-width:760px;margin:0 auto;padding:26px 20px 56px}
h1{font-size:32px;line-height:1.2;margin:10px 0 8px}
h2{font-size:21px;line-height:1.3;margin:34px 0 8px}
p{margin:0 0 14px}
.crumbs{font-size:14px;color:var(--muted);margin:0}
.crumbs a{color:var(--muted)}
.meta{color:var(--muted);font-size:15px}
.lead{font-size:19px}
.badge{display:inline-block;padding:1px 10px;border-radius:20px;font-size:13px;font-weight:700;background:rgba(128,128,160,.22);color:var(--text)}
.cta{display:inline-block;margin:6px 10px 6px 0;padding:11px 18px;border-radius:10px;background:#2f68bd;color:#fff;text-decoration:none;font-weight:600}
.cta.ghost{background:none;border:1px solid var(--line);color:var(--text)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:18px 0}
.card p:last-child{margin-bottom:0}
table{border-collapse:collapse;width:100%;font-size:15px}
td,th{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.techs{list-style:none;padding:0;margin:0}
.techs li{padding:10px 0;border-bottom:1px solid var(--line)}
.techs a{font-weight:600}
.techs span{display:block;color:var(--muted);font-size:15px}
ol.techs{list-style:decimal;padding-left:28px}
ol.techs li{padding-left:4px}
dt{font-weight:700;margin-top:16px;scroll-margin-top:12px}
dd{margin:2px 0 0}
.aka{color:var(--muted);font-size:14px;font-weight:400}
.pn{display:flex;justify-content:space-between;gap:12px;margin-top:30px;font-size:15px}
footer{max-width:760px;margin:0 auto;padding:20px;color:var(--muted);font-size:14px;border-top:1px solid var(--line)}
footer a{color:var(--muted)}
.rate label{display:block;font-weight:600;margin-bottom:6px}
.rate textarea{width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--text);font:15px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.rate button{border:none;cursor:pointer;font:inherit;font-weight:600}
#rate-error{color:var(--muted);min-height:1.6em;margin:0}
figure{margin:18px 0}
figure img{display:block;width:100%;max-width:520px;height:auto;border-radius:8px}
figcaption{color:var(--muted);font-size:15px;margin-top:8px}
.key{display:inline-block;margin-right:14px;white-space:nowrap}
.key i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px}
`.trim();

interface Crumb {
  name: string;
  url: string;
}

function layout(opts: {
  url: string;
  title: string;
  description: string;
  crumbs: Crumb[];
  jsonLd: object[];
  body: string;
}): string {
  const canonical = SITE + opts.url;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: opts.crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: SITE + c.url
    }))
  };
  const ld = [...opts.jsonLd, breadcrumb]
    // "</" inside a JSON string must not close the script element
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`)
    .join('\n    ');
  const crumbs = opts.crumbs
    .map((c, i) =>
      i === opts.crumbs.length - 1 ? esc(c.name) : `<a href="${c.url}">${esc(c.name)}</a>`
    )
    .join(' › ');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(opts.title)}</title>
    <meta name="description" content="${esc(opts.description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <meta name="theme-color" content="#1a1d29" />
    <meta property="og:site_name" content="sudokUI" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(opts.title)}" />
    <meta property="og:description" content="${esc(opts.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SITE}/og-card.png" />
    <meta name="twitter:card" content="summary_large_image" />
    ${ld}
    <style>${STYLE}</style>
  </head>
  <body>
    <header class="site">
      <a class="brand" href="/"><span class="mark">UI</span>sudokUI</a>
      <nav aria-label="Learn">
        <a href="/learn/">Techniques</a>
        <a href="/learn/glossary/">Glossary</a>
        <a href="${RATING_URL}">Rating</a>
        <a href="/">Play</a>
      </nav>
    </header>
    <main>
      <p class="crumbs">${crumbs}</p>
${opts.body}
    </main>
    <footer>
      <p>sudokUI is a free, open-source sudoku app: no ads, no account, works offline.
      <a href="/">Play at sudokui.app</a> ·
      <a href="https://github.com/AImenes/sudokUI">Source on GitHub</a></p>
      <p>${[
        ...LANDING_PAGES.map((p) => ({ label: p.name, href: p.url })),
        { label: 'Difficulty rating', href: RATING_URL },
        { label: 'Techniques', href: '/learn/' },
        { label: 'Glossary', href: '/learn/glossary/' }
      ]
        .map((l) => `<a href="${l.href}">${esc(l.label)}</a>`)
        .join(' · ')}</p>
    </footer>
  </body>
</html>
`;
}

const website = { '@type': 'WebSite', name: 'sudokUI', url: SITE + '/' };

function article(url: string, headline: string, description: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    inLanguage: 'en',
    url: SITE + url,
    mainEntityOfPage: SITE + url,
    image: SITE + '/og-card.png',
    isPartOf: website,
    author: { '@type': 'Organization', name: 'sudokUI', url: SITE + '/' },
    publisher: {
      '@type': 'Organization',
      name: 'sudokUI',
      url: SITE + '/',
      logo: { '@type': 'ImageObject', url: SITE + '/icon-512.png' }
    }
  };
}

/**
 * A real position where the technique applies, drawn and explained by the
 * engine itself: the explanation is the hint sudokUI gives at this step.
 */
function workedExample(tech: Tech): string {
  const example = EXAMPLES[tech];
  if (!example) return '';
  const name = TECHS[tech].name;
  const legend = legendOf(example.step)
    .map((l) => `<span class="key"><i style="background:${l.colour}"></i>${esc(l.label)}</span>`)
    .join(' ');
  return `      <h2>Worked example</h2>
      <figure>
        <img src="${diagramUrl(tech)}" width="${BOARD_SIZE}" height="${BOARD_SIZE}" alt="${esc(`${diagramTitle(tech)}. ${example.step.description}`)}" />
        <figcaption>${legend}</figcaption>
      </figure>
      <p>${esc(example.step.description)}</p>
      <p class="meta">Step ${example.stepIndex + 1} of this puzzle's solution, found and verified by the sudokUI engine. Cells are named by row and column: r2c3 is row 2, column 3.${
        example.credit ? ` Puzzle: ${esc(example.credit)}.` : ''
      }${
        example.afterHarder
          ? ' In this puzzle the position comes after steps harder than the technique itself.'
          : ''
      } <a href="/#p=${example.puzzle}">Play this puzzle from the start</a>.</p>
`;
}

function techniquePage(tech: Tech, prev?: Tech, next?: Tech): Page {
  const info = TECHS[tech];
  const doc = TECH_DOCS[tech];
  const status = techStatus(tech);
  const url = techUrl(tech);
  const siblings = ALL_TECHS.filter((t) => TECHS[t].category === info.category && t !== tech);
  const title = fitTitle(`${info.name}: sudoku technique explained`);
  const description = fitDescription(
    `${doc.what} Why it works, how to spot it, and a puzzle to practise on.`,
    doc.what,
    `How the ${info.name} works in sudoku: the pattern, why it is valid and how to spot it. ${info.level} technique, rating score ${info.score}.`
  );

  const body = `      <h1>${esc(info.name)} in sudoku</h1>
      <p class="meta"><span class="badge">${info.level}</span> · <a href="${RATING_URL}#scores">rating cost ${info.score}</a> · <a href="${categoryAnchor(info.category)}">${esc(categoryLabel(info.category))}</a>${
        doc.aka.length ? ` · also called ${esc(doc.aka.join(', '))}` : ''
      }</p>
      <p class="lead">${linked(doc.what)}</p>
      <h2>Why it works</h2>
      <p>${linked(doc.why)}</p>
      <h2>How to spot it</h2>
      <p>${linked(doc.spot)}</p>
${workedExample(tech)}      <div class="card">
        ${
          status
            ? `<p>${esc(status.note)}</p>
        <p><a class="cta" href="/#learn=${tech}">Open the guide in sudokUI</a></p>`
            : `<p><strong>Practise it on a real puzzle.</strong> sudokUI generates a puzzle that needs ${esc(info.name)} and takes you straight to the position where it applies. Hints draw the pattern on the board and explain the step.</p>
        <p><a class="cta" href="/#practice=${tech}">Practice ${esc(info.name)}</a><a class="cta ghost" href="/#learn=${tech}">Open in the app's guide</a></p>`
        }
      </div>
      <h2>In a puzzle's rating</h2>
      <p>Each time the solver needs ${esc(info.name)}, the puzzle's difficulty rating grows by ${info.score}. It is a ${info.level}-class technique.${
        frequencyLabel(tech) ? ` It is needed in ${frequencyLabel(tech)} that sudokUI generates.` : ''
      } <a href="${RATING_URL}">How the rating works</a>.</p>
${
  siblings.length
    ? `      <h2>More ${esc(categoryLabel(info.category).toLowerCase())}</h2>
      <p>${siblings.map((t) => `<a href="${techUrl(t)}">${esc(TECHS[t].name)}</a>`).join(' · ')}</p>
`
    : ''
}      <p class="pn"><span>${
    prev ? `← <a href="${techUrl(prev)}">${esc(TECHS[prev].name)}</a>` : ''
  }</span><span>${next ? `<a href="${techUrl(next)}">${esc(TECHS[next].name)}</a> →` : ''}</span></p>`;

  return {
    path: `learn/${techSlug(tech)}/index.html`,
    url,
    html: layout({
      url,
      title,
      description,
      crumbs: [
        { name: 'sudokUI', url: '/' },
        { name: 'Sudoku techniques', url: '/learn/' },
        { name: info.name, url }
      ],
      jsonLd: [
        {
          ...article(url, `${info.name}: sudoku technique explained`, doc.what),
          ...(EXAMPLES[tech] ? { image: [SITE + diagramUrl(tech), SITE + '/og-card.png'] } : {}),
          about: {
            '@type': 'DefinedTerm',
            name: info.name,
            ...(doc.aka.length ? { alternateName: doc.aka } : {}),
            inDefinedTermSet: `${SITE}/learn/`
          }
        }
      ],
      body
    })
  };
}

function indexPage(): Page {
  const url = '/learn/';
  const n = ALL_TECHS.length;
  const title = fitTitle(`Sudoku solving techniques: all ${n} explained`);
  const description = `All ${n} sudoku solving techniques explained in plain words, from Naked Single to Exocet, grouped by family. Practise each one free in the app.`;
  const sections = byCategory()
    .map(
      ([cat, techs]) => `      <h2 id="${slugify(cat)}">${esc(categoryLabel(cat))}</h2>
      <p>${esc(CATEGORY_NOTES[cat])}</p>
      <ul class="techs">
${techs
  .map(
    (t) =>
      `        <li><a href="${techUrl(t)}">${esc(TECHS[t].name)}</a><span>${esc(TECH_DOCS[t].what)}</span></li>`
  )
  .join('\n')}
      </ul>`
    )
    .join('\n');
  const body = `      <h1>Sudoku solving techniques</h1>
      <p class="lead">All ${n} solving techniques in sudokUI's catalogue, in the order a solver reaches for them. Each one says what the pattern is, why it works and how to spot it.</p>
      <p><a class="cta" href="/">Play sudokUI</a><a class="cta ghost" href="/learn/glossary/">Glossary</a><a class="cta ghost" href="${RATING_URL}">How rating works</a></p>
      <h2 id="worth-learning">Worth learning first</h2>
      <p>How often a technique is needed, weighted by its rating cost, over the ${FREQUENCY.sample.toLocaleString('en')} puzzles sudokUI has generated and rated. Difficulty and frequency are different things: a hard technique that turns up often repays the effort of learning it.</p>
      <ol class="techs">
${byWorth(ALL_TECHS)
  .slice(0, 12)
  .map(
    (t) =>
      `        <li><a href="${techUrl(t)}">${esc(TECHS[t].name)}</a><span>${TECHS[t].level}, needed in ${esc(frequencyLabel(t) ?? '')}</span></li>`
  )
  .join('\n')}
      </ol>
${sections}`;
  return {
    path: 'learn/index.html',
    url,
    html: layout({
      url,
      title,
      description,
      crumbs: [
        { name: 'sudokUI', url: '/' },
        { name: 'Sudoku techniques', url }
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Sudoku solving techniques',
          description,
          url: SITE + url,
          isPartOf: website,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: n,
            itemListElement: ALL_TECHS.map((t, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: TECHS[t].name,
              url: SITE + techUrl(t)
            }))
          }
        }
      ],
      body
    })
  };
}

function glossaryPage(): Page {
  const url = '/learn/glossary/';
  const title = fitTitle('Sudoku glossary: every solving term explained');
  const description =
    'Plain-English definitions of sudoku solving terms: candidates, strong and weak links, conjugate pairs, almost locked sets, fins, deadly patterns and more.';
  const sections = GLOSSARY_GROUPS.map(
    (group) => `      <h2 id="${slugify(group)}">${esc(group)}</h2>
      <dl>
${GLOSSARY.filter((e) => e.group === group)
  .map((e) => {
    const see = e.see.filter((s) => GLOSSARY.some((g) => g.term === s));
    return `        <dt id="${slugify(e.term)}">${esc(e.term)}${
      e.aka.length ? ` <span class="aka">also ${esc(e.aka.join(', '))}</span>` : ''
    }</dt>
        <dd>${linked(e.definition, e.term)}${
          see.length
            ? ` <span class="aka">See ${see
                .map((s) => `<a href="#${slugify(s)}">${esc(s)}</a>`)
                .join(', ')}.</span>`
            : ''
        }</dd>`;
  })
  .join('\n')}
      </dl>`
  ).join('\n');
  const body = `      <h1>Sudoku glossary</h1>
      <p class="lead">The words sudoku solvers use, and that sudokUI's hints use, each defined once and precisely.</p>
${sections}
      <div class="card">
        <p>See the terms at work: <a href="/learn/">every technique explained</a>, or <a href="/">play sudokUI</a> and ask for a hint.</p>
      </div>`;
  return {
    path: 'learn/glossary/index.html',
    url,
    html: layout({
      url,
      title,
      description,
      crumbs: [
        { name: 'sudokUI', url: '/' },
        { name: 'Sudoku techniques', url: '/learn/' },
        { name: 'Glossary', url }
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'DefinedTermSet',
          name: 'Sudoku glossary',
          description,
          url: SITE + url,
          hasDefinedTerm: GLOSSARY.map((e) => ({
            '@type': 'DefinedTerm',
            name: e.term,
            description: e.definition,
            url: `${SITE}${url}#${slugify(e.term)}`
          }))
        }
      ],
      body
    })
  };
}

function ratingPage(): Page {
  const url = RATING_URL;
  const title = fitTitle('Sudoku difficulty rating: how hard is your puzzle?');
  const description =
    'How sudoku difficulty is rated: HoDoKu-compatible technique scores, eight bands from Beginner to Nightmare and the full score table. Rate any puzzle free.';
  const bands = LEVELS.map(
    (level, i) =>
      `        <tr><td><span class="badge">${level}</span></td><td class="n">${
        i === LEVELS.length - 1
          ? `above ${LEVEL_MAX_SCORE[LEVELS[i - 1]]}`
          : `up to ${LEVEL_MAX_SCORE[level]}`
      }</td><td>${esc(BAND_NOTES[level])}</td></tr>`
  ).join('\n');
  const scores = byCategory()
    .map(
      ([cat, techs]) =>
        `        <tr><th colspan="4">${esc(categoryLabel(cat))}</th></tr>
${techs
  .map(
    (t) =>
      `        <tr><td><a href="${techUrl(t)}">${esc(TECHS[t].name)}</a></td><td>${TECHS[t].level}</td><td class="n">${TECHS[t].score}</td><td>${frequencyLabel(t) ?? ''}</td></tr>`
  )
  .join('\n')}`
    )
    .join('\n');
  const body = `      <h1>Sudoku difficulty rating</h1>
      <p class="lead">${esc(RATING_SUMMARY)}</p>
      <h2 id="rate-your-puzzle">Rate your own sudoku</h2>
${puzzleForm('Rate this puzzle')}
      <p>The puzzle opens in sudokUI with its rating and band in the top bar. Nothing is uploaded: the rating is computed on your own device. No string at hand? <a href="/">Open sudokUI</a>, choose New, then Custom, and type the puzzle onto the board. See also <a href="/hodoku/">how this compares with HoDoKu</a>.</p>
${RATING_POINTS.map((p) => `      <h2>${esc(p.title)}</h2>\n      <p>${esc(p.text)}</p>`).join('\n')}
      <h2 id="bands">The eight difficulty bands</h2>
      <table>
        <tr><th>Band</th><th class="n">Total score</th><th>Typical techniques</th></tr>
${bands}
      </table>
      <h2 id="scores">Score of every technique</h2>
      <p>The cost added to a puzzle's rating each time the solver needs the technique, and how many of the puzzles sudokUI generates need it at least once (measured on ${FREQUENCY.sample.toLocaleString('en')} puzzles).</p>
      <table>
        <tr><th>Technique</th><th>Class</th><th class="n">Score</th><th>Needed in</th></tr>
${scores}
      </table>`;
  return {
    path: `${url.slice(1)}index.html`,
    url,
    html: layout({
      url,
      title,
      description,
      crumbs: [
        { name: 'sudokUI', url: '/' },
        { name: 'Sudoku difficulty rating', url }
      ],
      jsonLd: [article(url, 'Sudoku difficulty rating', description)],
      body
    })
  };
}

function landingPage(page: LandingPage): Page {
  const link = (l: { label: string; href: string }) =>
    `<a href="${l.href}"${l.href.startsWith('http') ? ' rel="noopener"' : ''}>${esc(l.label)}</a>`;
  const body = `      <h1>${esc(page.h1)}</h1>
      <p class="lead">${esc(page.lead)}</p>
${page.puzzleBox ? puzzleForm(page.puzzleBox) : `      <p><a class="cta" href="${page.cta.href}">${esc(page.cta.label)}</a></p>`}
${page.sections
  .map(
    (s) =>
      `      <h2>${esc(s.heading)}</h2>\n${s.paragraphs.map((p) => `      <p>${esc(p)}</p>`).join('\n')}`
  )
  .join('\n')}
      <div class="card">
        <p>${page.related.map(link).join(' · ')}</p>
      </div>`;
  return {
    path: `${page.url.slice(1)}index.html`,
    url: page.url,
    html: layout({
      url: page.url,
      title: page.title,
      description: page.description,
      crumbs: [
        { name: 'sudokUI', url: '/' },
        { name: page.name, url: page.url }
      ],
      jsonLd: [article(page.url, page.h1, page.description)],
      body
    })
  };
}

export function buildLearnPages(): Page[] {
  return [
    ...LANDING_PAGES.map(landingPage),
    ratingPage(),
    indexPage(),
    glossaryPage(),
    ...ALL_TECHS.map((tech, i) => techniquePage(tech, ALL_TECHS[i - 1], ALL_TECHS[i + 1]))
  ];
}

/**
 * Sitemap for the app itself plus every static page. Locations only:
 * search engines ignore priority and changefreq, and a lastmod stamped
 * with the build date on every deploy teaches them to ignore that too.
 */
export function buildSitemap(pages: Page[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', ...pages.map((p) => p.url)].map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`;
}
