// Norwegian (bokmål) interface strings, keyed by their English text (src/content/i18n.ts).
// The terminology follows the glossary (src/content/locales/nb.ts) and
// docs/glossary_input.md; tests/i18n.test.ts holds this file to the source.
import type { Dictionary } from '../i18n';

const ui: Dictionary = {
  // menu
  New: 'Ny',
  Practice: 'Øv',
  Import: 'Importer',
  Share: 'Del',
  Restart: 'Omstart',
  // input modes
  Digit: 'Siffer',
  Corner: 'Hjørne',
  Centre: 'Midten',
  Colour: 'Farge',
  // actions
  Undo: 'Angre',
  Redo: 'Gjør om',
  Erase: 'Slett',
  Swap: 'Bytt',
  Hint: 'Hint',
  Check: 'Sjekk',
  Steps: 'Steg',
  Scan: 'Skann',
  'Auto candidates': 'Autokandidater',
  'Fill candidates': 'Fyll kandidater',
  Assist: 'Hjelp',
  'everything in this box counts as help': 'alt i denne boksen teller som hjelp',
  'Reveals logic': 'Avslører logikk',
  'Writes marks for you': 'Skriver notater for deg',
  'What the buttons do': 'Hva knappene gjør',
  // win dialog
  'Solved!': 'Løst!',
  'New game': 'Nytt spill',
  'Challenge a friend': 'Utfordre en venn',
  Copied: 'Kopiert',
  'Admire the grid': 'Beundre brettet',
  'Unassisted solve: no help, every mark your own': 'Løst uten hjelp: ingen hint, alle notater dine egne',
  'Solved with assistance. Restart the puzzle for an unassisted run':
    'Løst med hjelp. Start oppgaven på nytt for en runde uten hjelp',
  // settings
  Language: 'Språk',
  'Show timer': 'Vis klokke',
  // learn
  Learn: 'Lær',
  Theory: 'Teori',
  'Your path': 'Din vei',
  Techniques: 'Teknikker',
  Intuition: 'Intuisjon',
  'How to solve': 'Slik løser du',
  Glossary: 'Ordliste',
  Rating: 'Vurdering'
};

export default ui;
