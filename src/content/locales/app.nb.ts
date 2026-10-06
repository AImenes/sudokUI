// Everything the app says in Norwegian (bokmål) outside the Learn section, fetched
// the first time the language is chosen (src/content/i18n.ts).
import type { AppLocale } from '../i18n';
import ui from './ui.nb';
import engine from './engine.nb';
import { techNames, levels, categoryLabels } from './names.nb';

const locale: AppLocale = { ui, engine, techNames, levels, categoryLabels };

export default locale;
