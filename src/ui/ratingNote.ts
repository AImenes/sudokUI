// What the rating a game shows is, in a few words, where it is not plain
// HoDoKu's: worked out without the uniqueness techniques for a player who
// does not use them, and, for the daily and the advent doors, whose
// published rating is the same for everyone, that the published one
// differs (docs/architecture.md, "The rating follows the uniqueness
// setting"). Null where there is nothing to say.
import type { Translator } from '../content/i18n';
import type { GameInfo, ShownRating } from '../state/gameStore';

export function ratingNote(t: Translator, shown: ShownRating, info: GameInfo): string | null {
  if (!shown.plain || shown.pending) return null;
  if (shown.published) {
    return t('Rated without uniqueness techniques, as you play. The published rating is {level}, {score}.', {
      level: t.level(shown.published.level),
      score: shown.published.score
    });
  }
  if (shown.score !== info.score || shown.level !== info.level) return t('Rated without uniqueness techniques, as you play.');
  return null;
}
