# Translations

The interface speaks English, Norwegian (bokmål) and Spanish. The solving
content, which is the technique explanations, the glossary, the hint
texts and the static pages, is English in every language for now.

## How it works

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

## Translating a string

1. Wrap it where it is rendered: `New game` becomes `{t('New game')}`.
   Strings built from pieces (`Needed in ${x} puzzles`) should instead be
   wrapped as whole sentences with a placeholder, which the dictionary
   does not support yet: add that when the first such string is needed.
2. Add the English text as a key to both `nb` and `es` in `i18n.ts`.
   The test fails until both have it.

Tooltips (`title=...`) and the button help texts in Controls are still
English. They are the next batch.

## What stays English, and why

The guide is 80 technique explanations, a glossary and the worked examples,
all held to house-style tests and to the engine. Translating it is a
content project with its own review, not a dictionary. When it happens it
should live beside the English in `src/content/`, keyed by technique, so the
same tests can run per language.

The static pages under `/learn/` are English for search engines; a
translated site would need `/nb/learn/` and `/es/learn/` with their own
sitemaps and `hreflang` links.
