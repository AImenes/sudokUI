/**
 * Dev-only screenshot staging, used by scripts/promo.sh to render marketing
 * shots headlessly. Loaded exclusively from main.tsx behind import.meta.env.DEV.
 *
 *   http://localhost:5199/#demo=<scene>&theme=<dark|light|rose>&poodle=1
 *
 * Scenes: chain (X-Chain arrows), niceloop (loop arrows), xychain,
 * steps (solution path dialog), practice (technique catalogue),
 * newgame (difficulty bands), victory (clean solve + confetti), board.
 */
import { useGame } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { parseGrid, gridToString } from '../engine/board';
import { solve } from '../engine/bruteForce';

const PUZZLES = {
  chain: ['.7.2.61....3.95..898..1.7..59....3...6..3.........9.4.2......6.......8.......42..', 1748, 'Extreme', 'X_CHAIN'],
  niceloop: ['.69..8.1.1.4..3....5......2..75.........3...5..6.1.7...289.5.3.......6...4..2..7.', 3200, 'Nightmare', 'NICE_LOOP'],
  xychain: ['95.....6...64..........7..35........72.1.........86....4..3918.69...8.24......3.9', 2790, 'Extreme', 'XY_CHAIN'],
  board: ['..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..', 196, 'Beginner', null]
} as const;

function stage() {
  const params = new URLSearchParams(location.hash.slice(1));
  const scene = params.get('demo');
  if (!scene) return;
  // claim the boot flag so App's "no game yet" effect doesn't start a
  // freshly generated puzzle over the staged one
  (window as unknown as Record<string, unknown>).__sudokuiBooted = true;

  const s = useSettings.getState();
  s.set({
    theme: (params.get('theme') as 'dark' | 'light' | 'rose') ?? 'dark',
    showPoodle: params.get('poodle') === '1',
    hideRating: false,
    showTimer: false
  });

  const g = () => useGame.getState();
  const click = (needle: string) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent!.includes(needle))?.click();

  const load = (key: keyof typeof PUZZLES) => {
    const [puzzle, score, level, tech] = PUZZLES[key];
    g().startGame(puzzle, score as number, level as never, tech as never);
  };

  setTimeout(() => {
    switch (scene) {
      case 'chain':
      case 'niceloop':
      case 'xychain':
        load(scene);
        setTimeout(() => {
          g().requestHint();
          setTimeout(() => g().revealHint(), 300);
        }, 700);
        break;
      case 'steps':
        load('niceloop');
        setTimeout(() => click('Steps'), 900);
        break;
      case 'practice':
        load('board');
        setTimeout(() => click('Practice'), 400);
        break;
      case 'newgame':
        load('board');
        setTimeout(() => click('New'), 400);
        break;
      case 'victory': {
        load('board');
        setTimeout(() => {
          const solution = gridToString(solve(parseGrid(PUZZLES.board[0])!)!);
          const cells = g().cells;
          for (let i = 0; i < 81; i++) {
            if (!cells[i].given) {
              g().select([i], false);
              g().input(Number(solution[i]));
            }
          }
        }, 600);
        break;
      }
      case 'board':
        load('board');
        setTimeout(() => g().toggleAutoCandidates(), 600);
        break;
    }
  }, 400);
}

stage();
