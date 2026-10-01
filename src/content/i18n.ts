// Interface translations. English is the source: every string in the app is
// written in English where it is used, and t() looks it up in the chosen
// language. A string with no translation yet simply stays English, so the
// app never shows a blank, and strings can be translated one at a time.
//
// Scope, deliberately: the interface (menus, buttons, dialogs, settings).
// The solving content (technique explanations, glossary, hint texts, the
// static pages) is English and stays so until it has its own translation
// pass; see docs/translations.md.
import { useSettings, Lang } from '../state/settings';

export const LANGS: { value: Lang; name: string; tag: string }[] = [
  { value: 'en', name: 'English', tag: 'en' },
  { value: 'nb', name: 'Norsk', tag: 'nb' },
  { value: 'es', name: 'Español', tag: 'es' }
];

type Dictionary = Record<string, string>;

const nb: Dictionary = {
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
  Erase: 'Visk ut',
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
  Techniques: 'Teknikker',
  'How to solve': 'Slik løser du',
  Glossary: 'Ordliste',
  Rating: 'Vurdering'
};

const es: Dictionary = {
  New: 'Nuevo',
  Practice: 'Practicar',
  Import: 'Importar',
  Share: 'Compartir',
  Restart: 'Reiniciar',
  Digit: 'Cifra',
  Corner: 'Esquina',
  Centre: 'Centro',
  Colour: 'Color',
  Undo: 'Deshacer',
  Redo: 'Rehacer',
  Erase: 'Borrar',
  Swap: 'Intercambiar',
  Hint: 'Pista',
  Check: 'Comprobar',
  Steps: 'Pasos',
  Scan: 'Explorar',
  'Auto candidates': 'Autocandidatos',
  'Fill candidates': 'Rellenar candidatos',
  Assist: 'Ayuda',
  'everything in this box counts as help': 'todo lo de este cuadro cuenta como ayuda',
  'Reveals logic': 'Revela la lógica',
  'Writes marks for you': 'Escribe las anotaciones por ti',
  'What the buttons do': 'Qué hace cada botón',
  'Solved!': '¡Resuelto!',
  'New game': 'Nueva partida',
  'Challenge a friend': 'Reta a un amigo',
  Copied: 'Copiado',
  'Admire the grid': 'Admirar la cuadrícula',
  'Unassisted solve: no help, every mark your own': 'Resuelto sin ayuda: ni pistas ni anotaciones ajenas',
  'Solved with assistance. Restart the puzzle for an unassisted run':
    'Resuelto con ayuda. Reinicia el sudoku para intentarlo sin ayuda',
  Language: 'Idioma',
  'Show timer': 'Mostrar el cronómetro',
  Learn: 'Aprender',
  Techniques: 'Técnicas',
  'How to solve': 'Cómo resolver',
  Glossary: 'Glosario',
  Rating: 'Dificultad'
};

export const DICTIONARIES: Record<Lang, Dictionary> = { en: {}, nb, es };

/** the English text in `lang`, or the English text itself when untranslated */
export function translate(lang: Lang, text: string): string {
  return DICTIONARIES[lang][text] ?? text;
}

/** t('New game') in the chosen language; re-renders when the language changes */
export function useT(): (text: string) => string {
  const lang = useSettings((s) => s.lang);
  return (text) => translate(lang, text);
}
