// Norwegian (bokmål) names the whole app shows, not only the Learn section:
// the techniques with an established Norwegian name (the rest stay English,
// docs/glossary_input.md, section 4), the difficulty bands and the
// technique families. Shared by the Learn locale (nb.ts) and the app
// locale (app.nb.ts).
import type { Tech, Level, Category } from '../../engine/ratings';

export const techNames: Partial<Record<Tech, string>> = {
  "NAKED_SINGLE": "Naken singel",
  "HIDDEN_SINGLE": "Skjult singel",
  "LOCKED_PAIR": "Låst par",
  "LOCKED_TRIPLE": "Låst trippel",
  "LOCKED_CANDIDATES_1": "Låste kandidater (pekende)",
  "LOCKED_CANDIDATES_2": "Låste kandidater (hevdende)",
  "NAKED_PAIR": "Naket par",
  "NAKED_TRIPLE": "Naken trippel",
  "HIDDEN_PAIR": "Skjult par",
  "HIDDEN_TRIPLE": "Skjult trippel",
  "NAKED_QUADRUPLE": "Naken kvartett",
  "HIDDEN_QUADRUPLE": "Skjult kvartett",
  "UNIQUENESS_1": "Unikt rektangel type 1",
  "UNIQUENESS_2": "Unikt rektangel type 2",
  "UNIQUENESS_3": "Unikt rektangel type 3",
  "UNIQUENESS_4": "Unikt rektangel type 4",
  "UNIQUENESS_5": "Unikt rektangel type 5",
  "UNIQUENESS_6": "Unikt rektangel type 6",
  "HIDDEN_RECTANGLE": "Skjult rektangel",
  "AVOIDABLE_RECTANGLE_1": "Unngåelig rektangel type 1",
  "AVOIDABLE_RECTANGLE_2": "Unngåelig rektangel type 2",
  "EXTENDED_RECTANGLE": "Utvidet rektangel",
  "BRUTE_FORCE": "Prøving og feiling"
};

export const levels: Record<Level, string> = {
  "Beginner": "Nybegynner",
  "Easy": "Lett",
  "Medium": "Middels",
  "Tricky": "Lur",
  "Hard": "Vanskelig",
  "Unfair": "Urettferdig",
  "Extreme": "Ekstrem",
  "Nightmare": "Mareritt"
};

export const categoryLabels: Record<Category, string> = {
  "Singles": "Singler",
  "Intersections": "Skjæringer",
  "Subsets": "Delmengder",
  "Basic Fish": "Grunnleggende fisk",
  "Finned Fish": "Fisk med finner",
  "Complex Fish": "Kompleks fisk",
  "Single Digit Patterns": "Mønstre på ett tall",
  "Wings": "Wings",
  "Uniqueness": "Entydighet",
  "Chains and Loops": "Kjeder og sløyfer",
  "Coloring": "Fargelegging",
  "Almost Locked Sets": "Nesten låste mengder",
  "Miscellaneous": "Diverse",
  "Last Resort": "Siste utvei"
};
