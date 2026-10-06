// Builds the static /learn/ pages: one crawlable, shareable HTML page per
// technique, plus an index, the Intuition guide, the glossary, the rating
// explainer and the landing pages. Pure string building (no DOM, no
// filesystem) so it is unit-testable; the build step in
// scripts/build-learn.ts writes the result into dist/.
//
// Every page exists in English, Norwegian and Spanish: /learn/x-wing/,
// /nb/learn/x-wing/, /es/learn/x-wing/, and likewise the hubs and the
// landing pages (/daily-sudoku/, /nb/daily-sudoku/...). Each names the
// other two with hreflang links and a language line, so search engines
// serve the right one and readers can switch.
//
// The pages carry the same content as the in-app Learn dialog and deep-link
// back into the app, in the page's language (/ in English, /nb/ and /es/):
// /#practice=<KEY> starts a practice puzzle, /nb/#learn=<KEY> opens the
// guide at that technique in Norwegian.
import { TECHS, ALL_TECHS, LEVELS, LEVEL_MAX_SCORE, Tech, Category } from '../engine/ratings';
import type { Lang } from '../state/settings';
import { setEngineText, EngineTable } from '../engine/text';
import { GLOSSARY, GLOSSARY_GROUPS } from './glossary';
import { techStatus, techniquesByFamily } from './categories';
import { describe } from '../engine/hintFrames';
import { techSlug, slugify } from './slugs';
import { linkGlossary } from './glossaryLinks';
import { LANDING_PAGES, LandingPage, RATING_URL } from './landing';
import { EXAMPLES } from './examples';
import { boardSvg, legendOf, BOARD_SIZE } from './boardSvg';
import { FREQUENCY, byWorth } from './frequency';
import { SOLVE_TIME_TABLES } from './solveTimes';
import { INTUITION, INTUITION_URL } from './intuition';
import { intuitionDiagram, intuitionDiagramUrl, DIAGRAM_IDS } from './intuitionDiagrams';
import { learnText, LearnText, LandingText, langPrefix, exampleStep, METHOD_URL } from './learnLocale';
import type { LearnString } from './learnStrings';
import nb from './locales/nb';
import es from './locales/es';
import engineNb from './locales/engine.nb';
import engineEs from './locales/engine.es';

export const SITE = 'https://sudokui.app';

export const LEARN_LANGS: Lang[] = ['en', 'nb', 'es'];
const TEXT: Record<Lang, LearnText> = { en: learnText('en'), nb: learnText('nb', nb), es: learnText('es', es) };
const LANG_NAME: Record<Lang, string> = { en: 'English', nb: 'Norsk', es: 'Español' };
const OG_LOCALE: Record<Lang, string> = { en: 'en_GB', nb: 'nb_NO', es: 'es_ES' };
/** the engine's sentences in each language; English is its templates themselves */
const ENGINE_TEXT: Record<Lang, EngineTable | null> = { en: null, nb: engineNb, es: engineEs };

export interface Page {
  /** file path inside dist/, e.g. learn/x-wing/index.html */
  path: string;
  /** canonical URL path, e.g. /learn/x-wing/ */
  url: string;
  html: string;
  lang: Lang;
  /** the English page's URL: the page exists in every Learn language */
  alternateOf?: string;
}

/**
 * Runs `f` with the engine writing in a language, then sets it back to
 * English: a worked example is explained by the engine itself.
 */
function inEngineLanguage<T>(lang: Lang, f: () => T): T {
  setEngineText(lang, ENGINE_TEXT[lang]);
  try {
    return f();
  } finally {
    setEngineText('en', null);
  }
}

/** a file that accompanies the pages, e.g. a technique's board diagram */
export interface Asset {
  path: string;
  content: string;
}

const diagramUrl = (tech: Tech) => `/learn/img/${techSlug(tech)}.svg`;

/** what a technique's diagram shows, for its alt text and caption */
const diagramTitle = (tech: Tech, lt: LearnText = TEXT.en) =>
  lt.s('{name} example on a sudoku board', { name: lt.techName(tech) });

/** one board diagram per technique with a worked example; the Intuition diagrams in every language */
export function buildLearnAssets(): Asset[] {
  return [
    ...ALL_TECHS.filter((tech) => EXAMPLES[tech]).map((tech) => ({
      path: diagramUrl(tech).slice(1),
      content: boardSvg(EXAMPLES[tech]!, diagramTitle(tech))
    })),
    ...LEARN_LANGS.flatMap((lang) =>
      DIAGRAM_IDS.map((id) => ({ path: intuitionDiagramUrl(id, lang).slice(1), content: intuitionDiagram(id, TEXT[lang].s) }))
    )
  ];
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** a path in a language: /learn/ in English, /nb/learn/ in Norwegian */
const at = (lang: Lang, path: string) => `${langPrefix(lang)}${path}`;
const glossaryUrl = (lang: Lang) => at(lang, '/learn/glossary/');
/** the app in a language, at a deep link if given: /#daily, /nb/#daily, /es/ (langRoot in i18n.ts) */
const app = (lang: Lang, hash = '') => at(lang, `/${hash}`);

/** running text with its glossary terms linked to their definitions */
const linked = (lt: LearnText, text: string, exclude?: string) =>
  linkGlossary(text, exclude, lt.lang, lt.loc.glossary)
    .map((seg) => (seg.term ? `<a href="${glossaryUrl(lt.lang)}#${seg.term}">${esc(seg.text)}</a>` : esc(seg.text)))
    .join('');

/**
 * Search results cut titles at about 60 characters: the first candidate
 * that fits, with the brand if there is room for it.
 */
const fitTitle = (...titles: string[]) => {
  for (const t of titles) {
    if (`${t} | sudokUI`.length <= 60) return `${t} | sudokUI`;
    if (t.length <= 60) return t;
  }
  return titles[titles.length - 1];
};

/** the first candidate that fits a search result's description line */
const fitDescription = (...candidates: string[]) =>
  candidates.find((c) => c.length <= 160) ?? candidates[candidates.length - 1];

/**
 * Paste a puzzle, land in the app with it loaded and rated, in the page's
 * language. The app reads the puzzle from the #p= fragment, so nothing is
 * sent to any server.
 */
const puzzleForm = (lt: LearnText, button: string) => `      <form class="rate" id="rate">
        <label for="puzzle">${esc(lt.s('Paste a puzzle: 81 characters, with 0 or . for empty cells'))}</label>
        <textarea id="puzzle" rows="3" autocomplete="off" spellcheck="false"></textarea>
        <button type="submit" class="cta">${esc(button)}</button>
        <p id="rate-error" role="alert"></p>
        <noscript><p>${esc(lt.s('This box needs JavaScript. You can also {open} and choose Import.')).replace(
          '{open}',
          `<a href="${app(lt.lang)}">${esc(lt.s('open sudokUI'))}</a>`
        )}</p></noscript>
      </form>
      <script>
        document.getElementById('rate').addEventListener('submit', function (e) {
          e.preventDefault();
          var s = document.getElementById('puzzle').value.replace(/[^0-9.]/g, '');
          if (s.length === 81) location.href = '${app(lt.lang, '#p=')}' + s;
          else document.getElementById('rate-error').textContent =
            ${JSON.stringify(lt.s('A puzzle needs exactly 81 cells. This one has {n}.')).replace('{n}', '" + s.length + "')};
        });
      </script>`;

const techUrl = (tech: Tech, lang: Lang = 'en') => at(lang, `/learn/${techSlug(tech)}/`);
const categoryAnchor = (cat: Category, lang: Lang) => `${at(lang, '/learn/')}#${slugify(cat)}`;

const byCategory = (): [Category, Tech[]][] => techniquesByFamily();

/** a template string with {placeholders} that stand for HTML: everything else escaped */
const withLinks = (text: string, links: Record<string, string>) =>
  esc(text).replace(/\{(\w+)\}/g, (m, k) => (k in links ? links[k] : m));

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
h3{font-size:18px;line-height:1.35;margin:26px 0 6px}
.kin{color:var(--muted);font-size:15px;margin:-4px 0 6px}
.techs .kin{font-size:14px;margin:0}
.eli12{border-left:3px solid var(--accent);background:var(--panel);border-radius:0 10px 10px 0;padding:10px 16px;margin:14px 0}
.eli12 strong{display:block;font-size:13px;letter-spacing:.6px;text-transform:uppercase;color:var(--muted)}
.eli12 p{margin:4px 0 0}
.timeline dt{margin-top:12px}
.langs{font-size:14px}
.langs span{font-weight:600}
`.trim();

interface Crumb {
  name: string;
  url: string;
}

function layout(opts: {
  lang: Lang;
  url: string;
  title: string;
  description: string;
  crumbs: Crumb[];
  jsonLd: object[];
  body: string;
  /** the English URL of a page that exists in every Learn language */
  alternateOf?: string;
}): string {
  const lt = TEXT[opts.lang];
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
  const alternates = opts.alternateOf
    ? [
        ...LEARN_LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${at(l, opts.alternateOf!)}" />`),
        `<link rel="alternate" hreflang="x-default" href="${SITE}${opts.alternateOf}" />`
      ].join('\n    ')
    : '';
  // the same page in the other languages, or their technique index
  const languages = LEARN_LANGS.map((l) =>
    l === opts.lang
      ? `<span aria-current="true">${LANG_NAME[l]}</span>`
      : `<a href="${opts.alternateOf ? at(l, opts.alternateOf) : at(l, '/learn/')}" hreflang="${l}" lang="${l}">${LANG_NAME[l]}</a>`
  ).join(' · ');
  const landing = LANDING_PAGES.filter((p) => p.url !== METHOD_URL);
  const method = lt.loc.method;
  const home = app(opts.lang);
  return `<!doctype html>
<html lang="${opts.lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(opts.title)}</title>
    <meta name="description" content="${esc(opts.description)}" />
    <link rel="canonical" href="${canonical}" />
    ${alternates}
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <meta name="theme-color" content="#1a1d29" />
    <meta property="og:site_name" content="sudokUI" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="${OG_LOCALE[opts.lang]}" />
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
      <a class="brand" href="${home}"><span class="mark">UI</span>sudokUI</a>
      <nav aria-label="${esc(lt.s('Learn'))}">
        <a href="${at(opts.lang, '/learn/')}">${esc(lt.s('Techniques'))}</a>
        <a href="${at(opts.lang, INTUITION_URL)}">${esc(lt.s('Intuition'))}</a>
        <a href="${glossaryUrl(opts.lang)}">${esc(lt.s('Glossary'))}</a>
        <a href="${at(opts.lang, RATING_URL)}">${esc(lt.s('Rating'))}</a>
        <a href="${home}">${esc(lt.s('Play'))}</a>
      </nav>
    </header>
    <main>
      <p class="crumbs">${crumbs}</p>
${opts.body}
    </main>
    <footer>
      <p class="langs" aria-label="${esc(lt.s('Language'))}">${languages}</p>
      <p>${esc(lt.s('sudokUI is a free, open-source sudoku app: no ads, no account, works offline.'))}
      <a href="${home}">${esc(lt.s('Play at sudokui.app'))}</a> ·
      <a href="https://github.com/AImenes/sudokUI">${esc(lt.s('Source on GitHub'))}</a></p>
      <p>${[
        ...landing.map((p) => ({ label: lt.landing(p.url).name, href: at(opts.lang, p.url) })),
        { label: method.name, href: at(opts.lang, METHOD_URL) },
        { label: lt.s('Difficulty rating'), href: at(opts.lang, RATING_URL) },
        { label: lt.s('Techniques'), href: at(opts.lang, '/learn/') },
        { label: lt.s('Intuition'), href: at(opts.lang, INTUITION_URL) },
        { label: lt.s('Glossary'), href: glossaryUrl(opts.lang) }
      ]
        .map((l) => `<a href="${l.href}">${esc(l.label)}</a>`)
        .join(' · ')}</p>
    </footer>
  </body>
</html>
`;
}

const website = { '@type': 'WebSite', name: 'sudokUI', url: SITE + '/' };

function article(lang: Lang, url: string, headline: string, description: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    inLanguage: lang,
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
 * engine itself: the explanation is the hint sudokUI gives at this step,
 * in the page's language (the engine finds the stored step again, writing
 * in that language).
 */
function workedExample(lt: LearnText, tech: Tech): string {
  const example = EXAMPLES[tech];
  if (!example) return '';
  const { text, keys } = inEngineLanguage(lt.lang, () => {
    const step = exampleStep(tech, example);
    return { text: describe(step), keys: legendOf(step) };
  });
  const legend = keys
    .map((l) => `<span class="key"><i style="background:${l.colour}"></i>${esc(l.label)}</span>`)
    .join(' ');
  return `      <h2>${esc(lt.s('Worked example'))}</h2>
      <figure>
        <img src="${diagramUrl(tech)}" width="${BOARD_SIZE}" height="${BOARD_SIZE}" alt="${esc(`${diagramTitle(tech, lt)}. ${text}`)}" />
        <figcaption>${legend}</figcaption>
      </figure>
      <p>${esc(text)}</p>
      <p class="meta">${esc(lt.s("Step {n} of this puzzle's solution, found and verified by the sudokUI engine. Cells are named by row and column: r2c3 is row 2, column 3.", { n: example.stepIndex + 1 }))}${
        example.credit ? ` ${esc(lt.s('Puzzle: {credit}.', { credit: example.credit }))}` : ''
      }${
        example.afterHarder ? ` ${esc(lt.s('In this puzzle the position comes after steps harder than the technique itself.'))}` : ''
      } <a href="${app(lt.lang, `#p=${example.puzzle}`)}">${esc(lt.s('Play this puzzle from the start'))}</a>.</p>
`;
}

function techniquePage(lang: Lang, tech: Tech, prev?: Tech, next?: Tech): Page {
  const lt = TEXT[lang];
  const info = TECHS[tech];
  const name = lt.techName(tech);
  const doc = lt.techDoc(tech);
  const aka = lt.techAka(tech);
  const status = techStatus(tech);
  const url = techUrl(tech, lang);
  const level = lt.level(info.level);
  const freq = lt.frequency(tech);
  const siblings = ALL_TECHS.filter((t) => TECHS[t].category === info.category && t !== tech);
  const title = fitTitle(lt.s('{name}: sudoku technique explained', { name }), lt.s('{name} in sudoku', { name }), name);
  const description = fitDescription(
    lt.s('{what} Why it works, how to spot it, and a puzzle to practise on.', { what: doc.what }),
    doc.what,
    lt.s('How the {name} works in sudoku: the pattern, why it is valid and how to spot it. {level} technique, rating score {score}.', {
      name,
      level,
      score: info.score
    })
  );
  const kin = lt.kinLine(tech);

  const body = `      <h1>${esc(lt.s('{name} in sudoku', { name }))}</h1>
${kin ? `      <p class="kin">${esc(kin)} · <a href="${at(lang, INTUITION_URL)}">${esc(lt.s('how it fits'))}</a></p>\n` : ''}      <p class="meta"><span class="badge">${esc(level)}</span> · <a href="${at(lang, RATING_URL)}#scores">${esc(lt.s('rating cost {score}', { score: info.score }))}</a> · <a href="${categoryAnchor(info.category, lang)}">${esc(lt.category(info.category))}</a>${
        aka.length ? ` · ${esc(lt.s('also called {list}', { list: aka.join(', ') }))}` : ''
      }</p>
      <p class="lead">${linked(lt, doc.what)}</p>
      <h2>${esc(lt.s('Why it works'))}</h2>
      <p>${linked(lt, doc.why)}</p>
      <h2>${esc(lt.s('How to spot it'))}</h2>
      <p>${linked(lt, doc.spot)}</p>
${workedExample(lt, tech)}      <div class="card">
        ${
          status
            ? `<p>${esc(lt.s(status.note as LearnString))}</p>
        <p><a class="cta" href="${app(lang, `#learn=${tech}`)}">${esc(lt.s('Open the guide in sudokUI'))}</a></p>`
            : `<p><strong>${esc(lt.s('Practise it on a real puzzle.'))}</strong> ${esc(
                lt.s('sudokUI generates a puzzle that needs {name} and takes you straight to the position where it applies. Hints draw the pattern on the board and explain the step.', { name })
              )}</p>
        <p><a class="cta" href="${app(lang, `#practice=${tech}`)}">${esc(lt.s('Practice {name}', { name }))}</a><a class="cta ghost" href="${app(lang, `#learn=${tech}`)}">${esc(lt.s("Open in the app's guide"))}</a></p>`
        }
      </div>
      <h2>${esc(lt.s("In a puzzle's rating"))}</h2>
      <p>${esc(lt.s("Each time the solver needs {name}, the puzzle's difficulty rating grows by {score}. Its class is {level}.", { name, score: info.score, level }))}${
        freq ? ` ${esc(lt.s('It is needed in {freq} that sudokUI generates.', { freq }))}` : ''
      } <a href="${at(lang, RATING_URL)}">${esc(lt.s('How the rating works'))}</a>.</p>
${
  siblings.length
    ? `      <h2>${esc(lt.s('More {family}', { family: lt.category(info.category).toLowerCase() }))}</h2>
      <p>${siblings.map((t) => `<a href="${techUrl(t, lang)}">${esc(lt.techName(t))}</a>`).join(' · ')}</p>
`
    : ''
}      <p class="pn"><span>${
    prev ? `← <a href="${techUrl(prev, lang)}">${esc(lt.techName(prev))}</a>` : ''
  }</span><span>${next ? `<a href="${techUrl(next, lang)}">${esc(lt.techName(next))}</a> →` : ''}</span></p>`;

  return {
    path: `${url.slice(1)}index.html`,
    url,
    lang,
    alternateOf: techUrl(tech),
    html: layout({
      lang,
      url,
      title,
      description,
      alternateOf: techUrl(tech),
      crumbs: [
        { name: 'sudokUI', url: app(lang) },
        { name: lt.s('Sudoku techniques'), url: at(lang, '/learn/') },
        { name, url }
      ],
      jsonLd: [
        {
          ...article(lang, url, lt.s('{name}: sudoku technique explained', { name }), doc.what),
          ...(EXAMPLES[tech] ? { image: [SITE + diagramUrl(tech), SITE + '/og-card.png'] } : {}),
          about: {
            '@type': 'DefinedTerm',
            name,
            ...(aka.length ? { alternateName: aka } : {}),
            inDefinedTermSet: `${SITE}${at(lang, '/learn/')}`
          }
        }
      ],
      body
    })
  };
}

function indexPage(lang: Lang): Page {
  const lt = TEXT[lang];
  const url = at(lang, '/learn/');
  const n = ALL_TECHS.length;
  const title = fitTitle(lt.s('Sudoku solving techniques: all {n} explained', { n }));
  const description = lt.s(
    'All {n} sudoku solving techniques explained in plain words, from Naked Single to Exocet, grouped by family. Practise each one free in the app.',
    { n }
  );
  const sections = byCategory()
    .map(
      ([cat, techs]) => `      <h2 id="${slugify(cat)}">${esc(lt.category(cat))}</h2>
      <p>${esc(lt.categoryNote(cat))}</p>
      <ul class="techs">
${techs
  .map(
    (t) =>
      `        <li><a href="${techUrl(t, lang)}">${esc(lt.techName(t))}</a>${
        lt.kinLine(t) ? `<span class="kin">${esc(lt.kinLine(t))}</span>` : ''
      }<span>${esc(lt.techDoc(t).what)}</span></li>`
  )
  .join('\n')}
      </ul>`
    )
    .join('\n');
  const body = `      <h1>${esc(lt.s('Sudoku solving techniques'))}</h1>
      <p class="lead">${esc(lt.s("All {n} solving techniques in sudokUI's catalogue, grouped by the idea behind them. Each one says what the pattern is, why it works and how to spot it.", { n }))}</p>
      <p><a class="cta" href="${app(lang)}">${esc(lt.s('Play sudokUI'))}</a><a class="cta ghost" href="${at(lang, INTUITION_URL)}">${esc(lt.s('How they fit together'))}</a><a class="cta ghost" href="${glossaryUrl(lang)}">${esc(lt.s('Glossary'))}</a><a class="cta ghost" href="${at(lang, RATING_URL)}">${esc(lt.s('How rating works'))}</a></p>
      <h2 id="worth-learning">${esc(lt.s('Worth learning first'))}</h2>
      <p>${esc(lt.s('How often a technique is needed, weighted by its rating cost, over the {sample} puzzles sudokUI has generated and rated. Difficulty and frequency are different things: a hard technique that turns up often repays the effort of learning it.', { sample: lt.num(FREQUENCY.sample) }))}</p>
      <ol class="techs">
${byWorth(ALL_TECHS)
  .slice(0, 12)
  .map(
    (t) =>
      `        <li><a href="${techUrl(t, lang)}">${esc(lt.techName(t))}</a><span>${esc(lt.s('{level}, needed in {freq}', { level: lt.level(TECHS[t].level), freq: lt.frequency(t) ?? '' }))}</span></li>`
  )
  .join('\n')}
      </ol>
${sections}`;
  return {
    path: `${url.slice(1)}index.html`,
    url,
    lang,
    alternateOf: '/learn/',
    html: layout({
      lang,
      url,
      title,
      description,
      alternateOf: '/learn/',
      crumbs: [
        { name: 'sudokUI', url: app(lang) },
        { name: lt.s('Sudoku techniques'), url }
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: lt.s('Sudoku solving techniques'),
          description,
          inLanguage: lang,
          url: SITE + url,
          isPartOf: website,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: n,
            itemListElement: ALL_TECHS.map((t, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: lt.techName(t),
              url: SITE + techUrl(t, lang)
            }))
          }
        }
      ],
      body
    })
  };
}

function glossaryPage(lang: Lang): Page {
  const lt = TEXT[lang];
  const url = glossaryUrl(lang);
  const title = fitTitle(lt.s('Sudoku glossary: every solving term explained'));
  const description = lt.s(
    'Plain-English definitions of sudoku solving terms: candidates, strong and weak links, conjugate pairs, almost locked sets, fins, deadly patterns and more.'
  );
  const known = new Set(GLOSSARY.map((e) => e.id));
  const sections = GLOSSARY_GROUPS.map(
    (group) => `      <h2 id="${slugify(group)}">${esc(lt.loc.glossaryGroups[group] ?? group)}</h2>
      <dl>
${GLOSSARY.filter((e) => e.group === group)
  .map((e) => {
    const g = lt.glossary(e.id);
    const see = e.see.filter((s) => known.has(s));
    const aka = [...g.aka, ...(lang !== 'en' && e.term.toLowerCase() !== g.term.toLowerCase() ? [lt.s('In English: {term}', { term: e.term })] : [])];
    return `        <dt id="${e.id}">${esc(g.term)}${
      aka.length ? ` <span class="aka">${esc(lt.s('also {list}', { list: aka.join(', ') }))}</span>` : ''
    }</dt>
        <dd>${linked(lt, g.definition, e.id)}${
          see.length
            ? ` <span class="aka">${esc(lt.s('See'))} ${see
                .map((s) => `<a href="#${s}">${esc(lt.glossary(s).term)}</a>`)
                .join(', ')}.</span>`
            : ''
        }</dd>`;
  })
  .join('\n')}
      </dl>`
  ).join('\n');
  const body = `      <h1>${esc(lt.s('Sudoku glossary'))}</h1>
      <p class="lead">${esc(lt.s("The words sudoku solvers use, and that sudokUI's hints use, each defined once and precisely."))}</p>
${sections}
      <div class="card">
        <p>${withLinks(lt.s('See the terms at work: {techniques}, or {play} and ask for a hint.'), {
          techniques: `<a href="${at(lang, '/learn/')}">${esc(lt.s('every technique explained'))}</a>`,
          play: `<a href="${app(lang)}">${esc(lt.s('play sudokUI'))}</a>`
        })}</p>
      </div>`;
  return {
    path: `${url.slice(1)}index.html`,
    url,
    lang,
    alternateOf: '/learn/glossary/',
    html: layout({
      lang,
      url,
      title,
      description,
      alternateOf: '/learn/glossary/',
      crumbs: [
        { name: 'sudokUI', url: app(lang) },
        { name: lt.s('Sudoku techniques'), url: at(lang, '/learn/') },
        { name: lt.s('Glossary'), url }
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'DefinedTermSet',
          name: lt.s('Sudoku glossary'),
          description,
          inLanguage: lang,
          url: SITE + url,
          hasDefinedTerm: GLOSSARY.map((e) => ({
            '@type': 'DefinedTerm',
            name: lt.glossary(e.id).term,
            description: lt.glossary(e.id).definition,
            url: `${SITE}${url}#${e.id}`
          }))
        }
      ],
      body
    })
  };
}

function ratingPage(lang: Lang): Page {
  const lt = TEXT[lang];
  const { rating } = lt.loc;
  const url = at(lang, RATING_URL);
  const title = fitTitle(lt.s('Sudoku difficulty rating: how hard is your puzzle?'));
  const description = lt.s(
    'How sudoku difficulty is rated: HoDoKu-compatible technique scores, eight bands from Beginner to Nightmare and the full score table. Rate any puzzle free.'
  );
  const bands = LEVELS.map(
    (level, i) =>
      `        <tr><td><span class="badge">${esc(lt.level(level))}</span></td><td class="n">${
        i === LEVELS.length - 1
          ? esc(lt.s('above {n}', { n: LEVEL_MAX_SCORE[LEVELS[i - 1]] }))
          : esc(lt.s('up to {n}', { n: LEVEL_MAX_SCORE[level] }))
      }</td><td>${esc(lt.loc.bandNotes[level])}</td></tr>`
  ).join('\n');
  const scores = byCategory()
    .map(
      ([cat, techs]) =>
        `        <tr><th colspan="4">${esc(lt.category(cat))}</th></tr>
${techs
  .map(
    (t) =>
      `        <tr><td><a href="${techUrl(t, lang)}">${esc(lt.techName(t))}</a></td><td>${esc(lt.level(TECHS[t].level))}</td><td class="n">${TECHS[t].score}</td><td>${esc(lt.frequency(t) ?? '')}</td></tr>`
  )
  .join('\n')}`
    )
    .join('\n');
  const body = `      <h1>${esc(lt.s('Sudoku difficulty rating'))}</h1>
      <p class="lead">${esc(rating.summary)}</p>
      <h2 id="rate-your-puzzle">${esc(lt.s('Rate your own sudoku'))}</h2>
${puzzleForm(lt, lt.s('Rate this puzzle'))}
      <p>${withLinks(
        lt.s(
          'The puzzle opens in sudokUI with its rating and band in the top bar. Nothing is uploaded: the rating is computed on your own device. No string at hand? {open}, choose New, then Custom, and type the puzzle onto the board. See also {hodoku}.'
        ),
        {
          open: `<a href="${app(lang)}">${esc(lt.s('Open sudokUI'))}</a>`,
          hodoku: `<a href="${at(lang, '/hodoku/')}">${esc(lt.s('how this compares with HoDoKu'))}</a>`
        }
      )}</p>
${rating.points.map((p) => `      <h2>${esc(p.title)}</h2>\n      <p>${esc(p.text)}</p>`).join('\n')}
      <h2 id="bands">${esc(lt.s('The eight difficulty bands'))}</h2>
      <table>
        <tr><th>${esc(lt.s('Band'))}</th><th class="n">${esc(lt.s('Total score'))}</th><th>${esc(lt.s('Typical techniques'))}</th></tr>
${bands}
      </table>
      <h2 id="solve-times">${esc(lt.s('How fast is fast?'))}</h2>
      <p>${esc(rating.solveTimeNote)}</p>
      <table>
        <tr><th>${esc(lt.s('Band'))}</th><th class="n">${esc(lt.s('Slow'))}</th><th class="n">${esc(lt.s('Typical'))}</th><th class="n">${esc(lt.s('Fast'))}</th><th class="n">${esc(lt.s('Expert'))}</th><th class="n">${esc(lt.s('World class'))}</th></tr>
${SOLVE_TIME_TABLES.map((t) => {
  const label = rating.modes[t.mode];
  return `        <tr><th colspan="6">${esc(label[0].toUpperCase() + label.slice(1))}</th></tr>
${t.rows
  .map(
    (r) =>
      `        <tr><td><span class="badge">${esc(lt.level(r.level))}</span></td><td class="n">${r.slow}</td><td class="n">${r.typical}</td><td class="n">${r.fast}</td><td class="n">${r.expert}</td><td class="n">${r.worldClass}</td></tr>`
  )
  .join('\n')}`;
}).join('\n')}
      </table>
      <p>${esc(lt.s('Slow is where the slowest fifth begins. Typical is the median solver. Fast is faster than four solvers in five, Expert faster than 99 in 100, World class faster than 999 in 1,000.'))} ${esc(lt.s('The app says where each of your solves lands.'))}</p>
      <h2 id="scores">${esc(lt.s('Score of every technique'))}</h2>
      <p>${esc(lt.s("The cost added to a puzzle's rating each time the solver needs the technique, and how many of the puzzles sudokUI generates need it at least once (measured on {sample} puzzles).", { sample: lt.num(FREQUENCY.sample) }))}</p>
      <table>
        <tr><th>${esc(lt.s('Technique'))}</th><th>${esc(lt.s('Class'))}</th><th class="n">${esc(lt.s('Score'))}</th><th>${esc(lt.s('Needed in'))}</th></tr>
${scores}
      </table>`;
  return {
    path: `${url.slice(1)}index.html`,
    url,
    lang,
    alternateOf: RATING_URL,
    html: layout({
      lang,
      url,
      title,
      description,
      alternateOf: RATING_URL,
      crumbs: [
        { name: 'sudokUI', url: app(lang) },
        { name: lt.s('Sudoku difficulty rating'), url }
      ],
      jsonLd: [article(lang, url, lt.s('Sudoku difficulty rating'), description)],
      body
    })
  };
}

/**
 * A landing page in a language: its copy from the locale (How the best
 * solve shares its copy with the in-app guide), its addresses and links
 * from landing.ts, each internal one in the page's language.
 */
function landingPage(page: LandingPage, lang: Lang): Page {
  const lt = TEXT[lang];
  const isMethod = page.url === METHOD_URL;
  const text: LandingText = isMethod ? { ...lt.loc.method, cta: lt.s('Play sudokUI'), related: [] } : lt.landing(page.url);
  const url = at(lang, page.url);
  const link = (l: { label: string; href: string }) =>
    `<a href="${l.href}"${l.href.startsWith('http') ? ' rel="noopener"' : ''}>${esc(l.label)}</a>`;
  const related = isMethod
    ? [
        { label: lt.s('Every technique explained'), href: at(lang, '/learn/') },
        { label: lt.s('How the difficulty rating works'), href: at(lang, RATING_URL) }
      ]
    : page.related.map((r, i) => ({ label: text.related[i], href: r.href.startsWith('/') ? at(lang, r.href) : r.href }));
  const body = `      <h1>${esc(text.h1)}</h1>
      <p class="lead">${esc(text.lead)}</p>
${page.puzzleBox ? puzzleForm(lt, text.puzzleBox ?? page.puzzleBox) : `      <p><a class="cta" href="${at(lang, page.cta.href)}">${esc(text.cta)}</a></p>`}
${text.sections
  .map(
    (s) =>
      `      <h2>${esc(s.heading)}</h2>\n${s.paragraphs.map((p) => `      <p>${esc(p)}</p>`).join('\n')}`
  )
  .join('\n')}
      <div class="card">
        <p>${related.map(link).join(' · ')}</p>
      </div>`;
  return {
    path: `${url.slice(1)}index.html`,
    url,
    lang,
    alternateOf: page.url,
    html: layout({
      lang,
      url,
      title: text.title,
      description: text.description,
      alternateOf: page.url,
      crumbs: [
        { name: 'sudokUI', url: app(lang) },
        { name: text.name, url }
      ],
      jsonLd: [article(lang, url, text.h1, text.description)],
      body
    })
  };
}

/** the svg's own size, for the img's width and height */
const svgSize = (svg: string) => {
  const [, , w, h] = /viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg)!.slice(1).map(Number);
  return { w, h };
};

function intuitionPage(lang: Lang): Page {
  const lt = TEXT[lang];
  const { intuition } = lt.loc;
  const url = at(lang, INTUITION_URL);
  const title = fitTitle(lt.s('How sudoku techniques fit together'));
  const description = lt.s(
    'Every sudoku technique comes down to three ideas: locked sets, almost locked sets and chains. Each one explained simply, plus where the names came from.'
  );
  const section = (s: (typeof INTUITION)[number]['sections'][number]) => {
    const t = intuition.sections[s.id];
    const out = [`      <h3 id="${s.id}">${esc(t.heading)}</h3>`, ...t.paragraphs.map((p) => `      <p>${linked(lt, p)}</p>`)];
    if (t.points) {
      out.push(
        `      <dl class="timeline">\n${t.points
          .map((pt) => `        <dt>${esc(pt.when)}</dt>\n        <dd>${esc(pt.what)}</dd>`)
          .join('\n')}\n      </dl>`
      );
    }
    if (s.diagram) {
      const { w, h } = svgSize(intuitionDiagram(s.diagram.id, lt.s));
      out.push(`      <figure>
        <img src="${intuitionDiagramUrl(s.diagram.id, lang)}" width="${w}" height="${h}" alt="${esc(t.caption ?? '')}" loading="lazy" />
        <figcaption>${esc(t.caption ?? '')}</figcaption>
      </figure>`);
    }
    if (t.eli12) {
      out.push(`      <aside class="eli12"><strong>${esc(lt.s("Explain it like I'm 12"))}</strong><p>${esc(t.eli12)}</p></aside>`);
    }
    if (s.techs) {
      out.push(
        `      <p class="meta">${esc(lt.s('In the catalogue:'))} ${s.techs
          .map((tech) => `<a href="${techUrl(tech, lang)}">${esc(lt.techName(tech))}</a>`)
          .join(' · ')}</p>`
      );
    }
    return out.join('\n');
  };
  const body = `      <h1>${esc(lt.s('How sudoku techniques fit together'))}</h1>
      <p class="lead">${linked(lt, intuition.lead)}</p>
      <p class="meta">${INTUITION.map((p) => `<a href="#${p.id}">${esc(intuition.parts[p.id].nav)}</a>`).join(' · ')}</p>
${INTUITION.map(
  (part) => `      <h2 id="${part.id}">${esc(intuition.parts[part.id].heading)}</h2>
      <p class="meta">${esc(intuition.parts[part.id].intro)}</p>
${part.sections.map(section).join('\n')}`
).join('\n')}
      <div class="card">
        <p><a class="cta" href="${app(lang, '#learn=intuition')}">${esc(lt.s('Open in the app'))}</a><a class="cta ghost" href="${at(lang, '/learn/')}">${esc(lt.s('All techniques'))}</a><a class="cta ghost" href="${glossaryUrl(lang)}">${esc(lt.s('Glossary'))}</a></p>
      </div>`;
  return {
    path: `${url.slice(1)}index.html`,
    url,
    lang,
    alternateOf: INTUITION_URL,
    html: layout({
      lang,
      url,
      title,
      description,
      alternateOf: INTUITION_URL,
      crumbs: [
        { name: 'sudokUI', url: app(lang) },
        { name: lt.s('Sudoku techniques'), url: at(lang, '/learn/') },
        { name: lt.s('How they fit together'), url }
      ],
      jsonLd: [article(lang, url, lt.s('How sudoku techniques fit together'), description)],
      body
    })
  };
}

export function buildLearnPages(): Page[] {
  return LEARN_LANGS.flatMap((lang) => [
    ...LANDING_PAGES.map((p) => landingPage(p, lang)),
    ratingPage(lang),
    indexPage(lang),
    intuitionPage(lang),
    glossaryPage(lang),
    ...ALL_TECHS.map((tech, i) => techniquePage(lang, tech, ALL_TECHS[i - 1], ALL_TECHS[i + 1]))
  ]);
}

/** the home pages, the app itself in each language: /, /nb/, /es/ */
export const HOME_URLS = LEARN_LANGS.map((lang) => app(lang));

/**
 * Sitemap for the app itself, in its three languages, plus every static
 * page. Locations only, plus the language versions of each (English is
 * the x-default, as in the pages' own hreflang links): search engines
 * ignore priority and changefreq, and a lastmod stamped with the build
 * date on every deploy teaches them to ignore that too.
 */
export function buildSitemap(pages: Page[]): string {
  const alt = (english: string) =>
    [
      ...LEARN_LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${at(l, english)}"/>`),
      `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${english}"/>`
    ].join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[
  ...HOME_URLS.map((url) => `  <url><loc>${SITE}${url}</loc>${alt('/')}</url>`),
  ...pages.map((p) => `  <url><loc>${SITE}${p.url}</loc>${p.alternateOf ? alt(p.alternateOf) : ''}</url>`)
].join('\n')}
</urlset>
`;
}
