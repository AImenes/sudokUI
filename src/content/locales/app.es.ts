// Everything the app says in Spanish outside the Learn section, fetched
// the first time the language is chosen (src/content/i18n.ts).
import type { AppLocale } from '../i18n';
import ui from './ui.es';
import engine from './engine.es';
import { techNames, levels, categoryLabels } from './names.es';

const locale: AppLocale = { ui, engine, techNames, levels, categoryLabels };

export default locale;
