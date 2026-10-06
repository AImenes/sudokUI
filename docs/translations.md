# Translations

sudokUI speaks English, Norwegian (bokmål) and Spanish: the interface, the
hints and every other sentence the engine writes, the Learn section and the
static pages. English is the source everywhere; a missing translation shows
the English, never a blank.

## The interface

- `src/state/settings.ts` holds `lang`. The default is the device
  language when it is one we have (`deviceLang()`), English otherwise. The
  player changes it in Settings, the first row, where each option is
  written in its own language.
- `/nb/` and `/es/` are the app itself in Norwegian and Spanish: arriving
  there chooses the language (`src/main.tsx`), and while the player is on
  one of them the address follows a change of language. `/` keeps whatever
  was chosen. Share links carry the address they were made on.
- `src/content/i18n.ts` is the translator. Keys are the English text:

  ```ts
  const t = useT();                    // in a component
  const t = translator();              // anywhere else: a store action, a helper
  t('New game')
  t('{n} moves', { n })                // placeholders are {name}
  t(n === 1 ? '{n} cell' : '{n} cells', { n })   // plurals are two keys
  t.tech(tech); t.level(level); t.family(category)   // names, as the guide gives them
  rich(t('Press {key} to pause'), { key: <kbd>P</kbd> })   // elements inside a sentence
  msg('Takes back your last action.')  // declared away from where it is shown;
                                       // translate it there: t(b.text)
  t('Clear||the colour')               // the same English with another meaning
  ```

  Never build a key at run time (`t(\`Use ${x}?\`)`): write the whole
  sentence with a placeholder, so each language can order it its own way.
  Never glue translated pieces into a sentence either; a sentence is one
  key.
- `src/content/locales/ui.<lang>.ts` are the tables, `names.<lang>.ts` the
  technique, band and family names, `engine.<lang>.ts` the engine's
  sentences; `app.<lang>.ts` bundles the three. It is fetched the first
  time its language is used, before the app first renders in it, so
  English players never download it and nothing flickers.
- `<html lang>` follows the setting, for screen readers and hyphenation.

## The engine's sentences

Hints, legends, the walk through a chain, the chain trainer, Check's "why
not": every sentence the engine writes is an English template tagged `tr`
(`src/engine/text.ts`):

```ts
description: tr`Full House: ${cellName(empty)} is the last empty cell in ${unitName(u)}, so it must be ${digit}.`
```

Untranslated, `tr` is exactly the template literal. The table maps the
template with numbered holes, `Full House: {0} is the last empty cell in
{1}, so it must be {2}.`, to the sentence in the other language, holes in
whatever order it needs. Words that change with a value (a plural, rows or
columns) are separate templates chosen in the code, never fragments glued
in, so every language can agree its words. `unitName(u)` names a house
(row 3, rad 3, fila 3, with no article: the sentence supplies one), and
`joinAnd` and `listAnd` join lists with the language's "and". Cell names (r1c1) and digits are the same
in every language.

The engine never imports a translation; the app registers the chosen
language's table, and the worker, whose sentences nobody reads, stays
English.

## The Learn section

Everything in the Learn dialog, and the static pages built from it: the
technique guide, the Intuition guide, How to solve, the glossary, the
rating, the kin lines, the landing pages and the Learn interface strings.

- `src/content/learnLocale.ts` defines `LearnLocale`, the whole section in
  one language, and assembles English (`EN`) from the content modules,
  which stay the source of truth. `learnText(lang, locale)` gives one
  accessor for all of it, falling back to English.
- `src/content/locales/nb.ts` and `es.ts` are the translations, keyed like
  `EN`: techniques by key, glossary entries and Intuition sections by id,
  short strings by their English text (`src/content/learnStrings.ts` lists
  every such string; `{name}` marks a placeholder).
- In the app, `useLearnText()` (`src/ui/useLearnText.ts`) loads a locale the
  first time its language is used.
- Glossary links in running text work per language (`glossaryLinks.ts`),
  including Norwegian and Spanish word endings.

## The static pages

Every page exists in all three languages: `/learn/x-wing/`,
`/nb/learn/x-wing/`, `/es/learn/x-wing/`, likewise the index, the Intuition
guide, the glossary, the landing pages and the home page (`/`, `/nb/`,
`/es/`). Every version names the others with `hreflang` links (English is
`x-default`), carries `<html lang>` and `og:locale`, and has a language line
in its footer; the sitemap lists the alternates too. See `docs/search.md`.

## Tests and tools

- `tests/i18n.test.ts` reads the source with the TypeScript compiler
  (`scripts/i18n-source.ts`): every `t()` / `msg()` key and every `tr`
  template must be in both tables, with the same placeholders, holes,
  numbers, symbols and cell names, and nothing stale; no English that
  people read may be left unwrapped in the interface or the engine.
- `tests/learnLocale.test.ts` does the same for the Learn section.
- `npx vite-node scripts/i18n.ts report --all` lists what is still
  unwrapped, by file and line.
- `npx vite-node scripts/engine-text-corpus.ts` writes every sentence the
  engine produces over a fixed corpus of positions, in any language: it
  proves a change leaves the English untouched, and lists templates a
  translation is missing.

When the English changes, change both languages with it; the tests point
at whatever is missing.

## Style and terminology

The terminology comes from the research brief, `docs/glossary_input.md`
(section 4), and is fixed in the published glossary
(`src/content/locales/nb.ts`, `es.ts`, the `glossary` part): a word the
glossary defines is used exactly as the glossary gives it, everywhere.

**Technique names** stay English, as Norwegian and Spanish solvers write
them (X-Wing, Swordfish, XY-Wing, Skyscraper, Sue de Coq, AIC, Exocet...),
except the ones with an established native name in `names.<lang>.ts`
(Skjult singel, Único oculto, Låste kandidater (pekende), Rectángulo único
tipo 1...). Always use those exact names; in code, `t.tech(tech)`. Never
translate an English technique name word by word.

**Keep as they are**: sudokUI, HoDoKu, Nutella, r1c1 cell names, digits,
keyboard keys and shortcuts (Ctrl+Z, Backspace, the mode keys Z X C V),
emoji and button symbols.

| English | Norsk (bokmål) | Español |
| --- | --- | --- |
| cell | rute | casilla |
| row, column, box | rad, kolonne, boks | fila, columna, caja |
| unit (house) | enhet | unidad |
| digit | tall (the input mode: Siffer) | número (the input mode: Cifra) |
| given | gitt tall | número dado |
| candidate | kandidat | candidato |
| pencil mark | notat | anotación (nota) |
| corner mark / centre mark | hjørnenotat / midtnotat | nota de esquina / nota central |
| auto candidates | autokandidater | candidatos automáticos (button: Autocandidatos) |
| puzzle | oppgave (sudoku where it reads better) | sudoku |
| game (one play) | spill | partida |
| board, grid | brett | tablero (the 9×9 grid as a pattern: cuadrícula) |
| position | stilling | posición |
| step | steg | paso |
| hint | hint (et hint, hintet, hintene) | pista |
| solution | løsning | solución |
| solve (verb) | løse | resolver |
| solver (the engine) | løseren | el resolvedor |
| technique | teknikk | técnica |
| rating (a puzzle's score) | poengsum | puntuación |
| score (a technique's) | poeng | puntos, puntuación |
| difficulty band | vanskelighetsgrad (short: grad) | nivel de dificultad (short: nivel) |
| assisted / unassisted | med hjelp / uten hjelp | con ayuda / sin ayuda |
| practice | øving (verb: øve) | práctica (verb: practicar) |
| strong / weak link | sterk / svak lenke | enlace fuerte / débil |
| chain, loop | kjede, sløyfe | cadena, bucle |
| conjugate pair | konjugert par | par conjugado |
| bivalue cell | toverdirute | casilla bivalor |
| deadly pattern | dødelig mønster | patrón mortal |
| fish, fin | fisk, finne | pez, aleta |
| colouring | fargelegging | coloreado |
| daily puzzle | dagens oppgave | el sudoku del día |
| streak | dager på rad | racha |
| settings | innstillinger | ajustes |
| tap / hold / drag / click / press | trykk på / hold inne / dra / klikk / trykk | toca / mantén pulsado / arrastra / haz clic / pulsa |

Buttons are quoted as the app labels them, in that language: Hint, Sjekk,
Steg, Skann, Hjelp, Autokandidater, Fyll kandidater; Pista, Revisar, Pasos,
Explorar, Ayuda, Autocandidatos, Rellenar candidatos. (Spanish Explorar is
the Scan button, which lists every technique in a position; scanning a
photo is escanear.) The bands are Nybegynner, Lett, Middels, Lur,
Vanskelig, Urettferdig, Ekstrem, Mareritt and Principiante, Fácil, Medio,
Engañoso, Difícil, Injusto, Extremo, Pesadilla.

**Norwegian**: bokmål in its moderate, everyday forms, as `nb.ts` writes
it (boksen, ruten, tallet, kandidatene); address the player as "du";
sentence case in titles and buttons ("Nytt spill", not "Nytt Spill");
quotation marks «». Prefer plain verbs to nouns ("Sjekk brettet", not
"Utfør sjekking"). "Løsning" is the solution; for the act of solving
write "løse" or rephrase.

**Spanish**: neutral European Spanish, as `es.ts` writes it (casilla,
Revisar, ajustes); address the player as "tú" (Elige, Toca, Pulsa);
sentence case; opening ¿ and ¡; quotation marks «». Avoid regionalisms.
English technique names are masculine, as the glossary uses them (el
X-Wing, el Swordfish, un XY-Wing); native names keep their own gender (el
rectángulo único, los candidatos bloqueados).

**Both**: say what the English says, no more and no less: the hints teach,
and a learner who trusts a sentence must never be led to a wrong deduction.
Keep sentences as short as the English; labels on phone-sized buttons must
stay short (one or two words). No em or en dashes as punctuation (house
style), no exclamation marks in teaching text. A fragment the code glues
to other text keeps its leading or trailing space.

**Search**: the static pages and the home pages are what people find. Their
titles (about 60 characters) and descriptions (about 155) use the words
people actually search for in that language, naturally, once each:
Norwegian "sudoku", "gratis", "på nett", "spill sudoku", "løse sudoku",
"sudokuløser", "dagens sudoku", "vanskelighetsgrad", "teknikker"; Spanish
"sudoku", "gratis", "online", "jugar al sudoku", "resolver sudoku",
"sudoku diario", "nivel de dificultad", "técnicas". Never stuff keywords;
a title is a sentence a person would click.
