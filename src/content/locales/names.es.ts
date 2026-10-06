// Spanish names the whole app shows, not only the Learn section:
// the techniques with an established Spanish name (the rest stay English,
// docs/glossary_input.md, section 4), the difficulty bands and the
// technique families. Shared by the Learn locale (es.ts) and the app
// locale (app.es.ts).
import type { Tech, Level, Category } from '../../engine/ratings';

export const techNames: Partial<Record<Tech, string>> = {
  "NAKED_SINGLE": "Único desnudo",
  "HIDDEN_SINGLE": "Único oculto",
  "LOCKED_PAIR": "Par bloqueado",
  "LOCKED_TRIPLE": "Trío bloqueado",
  "LOCKED_CANDIDATES_1": "Candidatos bloqueados (puntero)",
  "LOCKED_CANDIDATES_2": "Candidatos bloqueados (reclamante)",
  "NAKED_PAIR": "Par desnudo",
  "NAKED_TRIPLE": "Trío desnudo",
  "HIDDEN_PAIR": "Par oculto",
  "HIDDEN_TRIPLE": "Trío oculto",
  "NAKED_QUADRUPLE": "Cuarteto desnudo",
  "HIDDEN_QUADRUPLE": "Cuarteto oculto",
  "UNIQUENESS_1": "Rectángulo único tipo 1",
  "UNIQUENESS_2": "Rectángulo único tipo 2",
  "UNIQUENESS_3": "Rectángulo único tipo 3",
  "UNIQUENESS_4": "Rectángulo único tipo 4",
  "UNIQUENESS_5": "Rectángulo único tipo 5",
  "UNIQUENESS_6": "Rectángulo único tipo 6",
  "HIDDEN_RECTANGLE": "Rectángulo oculto",
  "AVOIDABLE_RECTANGLE_1": "Rectángulo evitable tipo 1",
  "AVOIDABLE_RECTANGLE_2": "Rectángulo evitable tipo 2",
  "EXTENDED_RECTANGLE": "Rectángulo extendido",
  "BRUTE_FORCE": "Fuerza bruta"
};

export const levels: Record<Level, string> = {
  "Beginner": "Principiante",
  "Easy": "Fácil",
  "Medium": "Medio",
  "Tricky": "Engañoso",
  "Hard": "Difícil",
  "Unfair": "Injusto",
  "Extreme": "Extremo",
  "Nightmare": "Pesadilla"
};

export const categoryLabels: Record<Category, string> = {
  "Singles": "Únicos",
  "Intersections": "Intersecciones",
  "Subsets": "Subconjuntos",
  "Basic Fish": "Peces básicos",
  "Finned Fish": "Peces con aletas",
  "Complex Fish": "Peces complejos",
  "Single Digit Patterns": "Patrones de un solo número",
  "Wings": "Wings",
  "Uniqueness": "Unicidad",
  "Chains and Loops": "Cadenas y bucles",
  "Coloring": "Coloreado",
  "Almost Locked Sets": "Conjuntos casi bloqueados",
  "Miscellaneous": "Varios",
  "Last Resort": "Último recurso"
};
