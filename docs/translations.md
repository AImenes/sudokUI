# Translations

The interface and the Learn section speak English, Norwegian (bokmål) and
Spanish. The hint texts the solver writes (and so the worked examples'
captions) are English in every language for now.

## The interface

- `src/state/settings.ts` holds `lang`. The default is the device
  language when it is one we have (`deviceLang()`), English otherwise. The
  player changes it in Settings, the first row, where each option is
  written in its own language.
- `src/content/i18n.ts` holds one dictionary per language, keyed by the
  English text. `useT()` gives a component `t(text)`, which returns the
  translation or the English text itself when there is none. Nothing can
  ever show blank; strings are translated one at a time.
- `<html lang>` follows the setting, for screen readers and hyphenation.
- `tests/i18n.test.ts` checks that every language translates the same set
  of strings and that none is blank.

To translate an interface string: wrap it where it is rendered (`New game`
becomes `{t('New game')}`), then add the English text as a key to both `nb`
and `es` in `i18n.ts`. The test fails until both have it. Tooltips and the
button help texts in Controls are still English.

## The Learn section

Everything in the Learn dialog, and the static pages built from it: the
technique guide, the Intuition guide, How to solve, the glossary, the
rating, the kin lines and the Learn interface strings.

- `src/content/learnLocale.ts` defines `LearnLocale`, the whole section in
  one language, and assembles English (`EN`) from the content modules,
  which stay the source of truth. `learnText(lang, locale)` gives one
  accessor for all of it: `techName`, `techDoc`, `glossary(id)`, `s(key)`
  for strings, `frequency`, and so on, falling back to English.
- `src/content/locales/nb.ts` and `es.ts` are the translations, keyed like
  `EN`: techniques by key, glossary entries and Intuition sections by id,
  short strings by their English text (`src/content/learnStrings.ts` lists
  every such string; `{name}` marks a placeholder).
- In the app, `useLearnText()` (`src/ui/useLearnText.ts`) loads a locale the
  first time its language is used, so English players never download it.
- Glossary links in running text work per language (`glossaryLinks.ts`),
  including Norwegian and Spanish word endings; they point at entries by
  their stable id.
- Technique names stay English, as Norwegian and Spanish solvers write them,
  except the basic techniques with an established native name (Skjult
  singel, Único oculto); the English name is then listed among the aliases.
  The terminology, including the band names, comes from the research brief
  in `docs/glossary_input.md`. Buttons are quoted as the app labels them.

`tests/learnLocale.test.ts` holds both locales to the English: complete,
in house style, every placeholder, number and cell name kept, the
"like I'm 12" texts free of notation, the agreed band names, and most
strings actually translated. When the English changes, change both
locales with it; the tests point at whatever is missing.

## The static pages

The Learn pages exist in all three languages: `/learn/x-wing/`,
`/nb/learn/x-wing/`, `/es/learn/x-wing/`, likewise the index, the Intuition
guide, the glossary, `/sudoku-difficulty-rating/` and `/how-the-best-solve/`.
Every version names the others with `hreflang` links (English is
`x-default`), carries `<html lang>` and `og:locale`, and has a language line
in its footer; the sitemap lists the alternates too. The other landing pages
(daily sudoku, solver, HoDoKu) are English only. See `docs/search.md`.
