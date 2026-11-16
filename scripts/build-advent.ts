/**
 * Publishes a year's advent calendar (docs/advent-calendar.md): 24 doors
 * that climb gently, door 1 rated about 100 on HoDoKu's scale and door 24
 * about 1000 (doorTarget), none needing a technique above Medium, written
 * to src/content/advent.json, which the app loads when a door or the
 * calendar opens and the Worker bundles to check a door's time.
 *
 *   npx vite-node scripts/build-advent.ts [year] [--replace]   (default: this year)
 *
 * A year already in the file is never touched: a published door is a
 * promise, as a published daily is. The one exception is asked for by
 * name, --replace, and only for a year whose first door has not opened
 * anywhere yet (before 30 November UTC of its year, when a player a day
 * ahead of UTC reaches 1 December): nobody can have played a door of it
 * and nothing has been sent for one. From that day on the run refuses,
 * and the file stays as it is (yearPlan, scripts/adventDoors.ts).
 *
 * Each door is searched with its own seed (the year and the door), so a
 * run on any machine makes the same puzzles while the generator and the
 * rater stay as they are; the number of tries is fixed, not the time
 * they take, for the same reason.
 *
 * How a door is found is scripts/adventDoors.ts. Every door is checked to
 * have one solution and to be rated as near its aim as the tries allow,
 * and the doors' ratings must rise from one door to the next, their
 * levels never falling.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { LEVELS } from '../src/engine/ratings';
import { ADVENT_DOORS, AdventDoor, doorTarget } from '../src/content/advent';
import { doorAim, doorLevel, makeDoor, yearPlan } from './adventDoors';

const FILE = join(process.cwd(), 'src', 'content', 'advent.json');

const args = process.argv.slice(2);
const replace = args.includes('--replace');
const year = Number(args.find((a) => !a.startsWith('--')) ?? new Date().getFullYear());
if (!Number.isInteger(year) || year < 2026 || year > 2999) throw new Error('year: 2026 or later');

/** a trial run of some doors, written nowhere: ADVENT_TRY=1,12,24 (each as if the door before sat on its aim) */
const trial = (process.env.ADVENT_TRY ?? '').split(',').filter(Boolean).map(Number);

const existing: AdventDoor[] = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
const plan = yearPlan(existing, year, replace, new Date());
if (trial.length) {
  for (const door of trial) {
    const t0 = Date.now();
    const { door: d, tries, descents, steps } = makeDoor(year, door, door > 1 ? doorAim(door - 1) : 0);
    console.log(
      `door ${door}: ${d.score} (${d.level}, aim ${doorAim(door)}), ${d.puzzle.replace(/[^1-9]/g, '').length} clues, ${tries} tries, ${descents} brought down, ${steps} steps of the climb, ${((Date.now() - t0) / 1000).toFixed(1)} s`
    );
  }
} else if (plan === 'published') {
  console.log(`advent: ${year} is published already; nothing changed (--replace makes it again while its first door has not opened)`);
} else if (plan === 'opened') {
  throw new Error(`advent: door 1 of ${year} has opened somewhere, or is about to: a door somebody may have played never changes. Nothing changed`);
} else {
  const started = Date.now();
  const doors: AdventDoor[] = [];
  for (let door = 1; door <= ADVENT_DOORS; door++) {
    const t0 = Date.now();
    const { door: found, solution, tries, descents, steps } = makeDoor(year, door, doors[doors.length - 1]?.score ?? 0);
    // the solution travels as its hash, never in the file
    const d: AdventDoor = { ...found, solutionHash: createHash('sha256').update(solution).digest('hex') };
    doors.push(d);
    const off = d.score - doorAim(door);
    console.log(
      `door ${String(door).padStart(2)}: ${d.score} (${d.level}, target ${doorTarget(door)}${doorAim(door) === doorTarget(door) ? '' : `, aim ${doorAim(door)}`}, ${off >= 0 ? '+' : ''}${off}), ` +
        `${d.puzzle.replace(/[^1-9]/g, '').length} clues, ${tries} tries, ${descents} brought down, ${steps} steps of the climb, ${((Date.now() - t0) / 1000).toFixed(1)} s`
    );
  }
  for (const [i, d] of doors.entries()) {
    if (d.level !== doorLevel(d.door)) throw new Error(`door ${d.door} is ${d.level}, not ${doorLevel(d.door)}`);
    if (i === 0) continue;
    if (d.score <= doors[i - 1].score) throw new Error(`door ${i + 1} is rated no higher than door ${i}`);
    if (LEVELS.indexOf(d.level) < LEVELS.indexOf(doors[i - 1].level)) throw new Error(`door ${i + 1} is of a lower level than door ${i}`);
  }
  // a year made again takes the place of the one in the file; every other year stays as it is
  const kept = plan === 'replace' ? existing.filter((d) => !d.date.startsWith(`${year}-`)) : existing;
  const all = [...kept, ...doors].sort((a, b) => (a.date < b.date ? -1 : 1));
  // one line per door, so a diff shows exactly which were added
  writeFileSync(FILE, `[\n${all.map((d) => '  ' + JSON.stringify(d)).join(',\n')}\n]\n`);
  console.log(`advent: ${year}, ${doors.length} doors${plan === 'replace' ? ', in place of the ones published' : ''}, ${Math.round((Date.now() - started) / 1000)} s`);
}
