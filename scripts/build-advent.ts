/**
 * Publishes a year's advent calendar (docs/advent-calendar.md): 24 doors,
 * door n with a HoDoKu rating as near n x 100 as the generator can make,
 * written to src/content/advent.json, which the app loads when a door or
 * the calendar opens and the Worker bundles to check a door's time.
 *
 *   npx vite-node scripts/build-advent.ts [year]   (default: this year)
 *
 * A year already in the file is never touched: a published door is a
 * promise, as a published daily is. Each door is searched with its own
 * seed (the year and the door), so a run on any machine makes the same
 * puzzles while the generator and the rater stay as they are; the number
 * of tries is fixed, not the time they take, for the same reason.
 *
 * How a door is found is scripts/adventDoors.ts. Every door is checked to
 * have one solution and to be rated as near its target as the tries
 * allow, and the doors' ratings and bands must rise from one door to the
 * next.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { LEVELS } from '../src/engine/ratings';
import { ADVENT_DOORS, AdventDoor, doorTarget } from '../src/content/advent';
import { makeDoor } from './adventDoors';

const FILE = join(process.cwd(), 'src', 'content', 'advent.json');

const year = Number(process.argv[2] ?? new Date().getFullYear());
if (!Number.isInteger(year) || year < 2026 || year > 2999) throw new Error('year: 2026 or later');

/** a trial run of some doors, written nowhere: ADVENT_TRY=1,12,24 */
const trial = (process.env.ADVENT_TRY ?? '').split(',').filter(Boolean).map(Number);

const existing: AdventDoor[] = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
if (trial.length) {
  for (const door of trial) {
    const t0 = Date.now();
    const { door: d, tries, descents } = makeDoor(year, door, 'Easy');
    console.log(`door ${door}: ${d.score} (${d.level}), ${tries} tries, ${descents} brought down, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} else if (existing.some((d) => d.date.startsWith(`${year}-`))) {
  console.log(`advent: ${year} is published already; nothing changed`);
} else {
  const started = Date.now();
  const doors: AdventDoor[] = [];
  for (let door = 1; door <= ADVENT_DOORS; door++) {
    const t0 = Date.now();
    const { door: found, solution, tries, descents } = makeDoor(year, door, doors[doors.length - 1]?.level ?? 'Easy');
    // the solution travels as its hash, never in the file
    const d: AdventDoor = { ...found, solutionHash: createHash('sha256').update(solution).digest('hex') };
    doors.push(d);
    const off = d.score - doorTarget(door);
    console.log(
      `door ${String(door).padStart(2)}: ${d.score} (${d.level}, target ${doorTarget(door)}, ${off >= 0 ? '+' : ''}${off}), ` +
        `${d.puzzle.replace(/[^1-9]/g, '').length} clues, ${tries} tries, ${descents} brought down, ${((Date.now() - t0) / 1000).toFixed(1)} s`
    );
  }
  for (let i = 1; i < doors.length; i++) {
    if (doors[i].score <= doors[i - 1].score) throw new Error(`door ${i + 1} is rated no higher than door ${i}`);
    if (LEVELS.indexOf(doors[i].level) < LEVELS.indexOf(doors[i - 1].level)) throw new Error(`door ${i + 1} is in a lower band than door ${i}`);
  }
  const all = [...existing, ...doors].sort((a, b) => (a.date < b.date ? -1 : 1));
  // one line per door, so a diff shows exactly which were added
  writeFileSync(FILE, `[\n${all.map((d) => '  ' + JSON.stringify(d)).join(',\n')}\n]\n`);
  console.log(`advent: ${year}, ${doors.length} doors, ${Math.round((Date.now() - started) / 1000)} s`);
}
