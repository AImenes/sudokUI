/**
 * The script that publishes a year's doors (scripts/build-advent.ts), run
 * as it runs from the command line, in a folder of its own with a copy of
 * the published file and the date set: a year in the file is left alone;
 * asked to replace it (--replace), the script makes the year again while
 * its first door has not opened anywhere, keeping every other year as it
 * is; and from the day the first door can open somewhere it refuses, and
 * the file stays as it was: a door somebody may have played never
 * changes. The search itself is stood in for (it takes minutes, and
 * tests/adventDoors.test.ts makes real doors again): each door comes back
 * as the one published, so what the script writes can be compared.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import published from '../src/content/advent.json';
import type { AdventDoor } from '../src/content/advent';
import { doorDate } from '../src/content/season';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';

const doors = published as AdventDoor[];
const made: number[] = [];

// the search stood in for: the published door, for whatever year is asked
vi.mock('../scripts/adventDoors', async (original) => ({
  ...(await original<typeof import('../scripts/adventDoors')>()),
  makeDoor: (year: number, door: number) => {
    made.push(door);
    const { solutionHash: _hash, ...d } = doors.find((x) => x.door === door && x.date.startsWith('2026-'))!;
    return { door: { ...d, date: doorDate(year, door) }, solution: gridToString(solve(parseGrid(d.puzzle)!)!), tries: 1, descents: 0, steps: 0 };
  }
}));

const write = (list: AdventDoor[]) => `[\n${list.map((d) => '  ' + JSON.stringify(d)).join(',\n')}\n]\n`;
/** the 2026 doors as an earlier run might have left them: other puzzles' ratings, and a year after them */
const earlier = doors.map((d) => ({ ...d, score: d.score + 1, solutionHash: '0'.repeat(64) }));
const next = doors.map((d) => ({ ...d, date: doorDate(2027, d.door) }));

let folder: string;
let file: string;
const argv = process.argv;
/** the script, named at run time: it is Node's own (node:crypto, the global process), outside what the app's tsconfig checks */
const SCRIPT = '../scripts/build-advent';
/** the script run with these arguments on this day, in the folder */
async function run(args: string[], now: string) {
  vi.setSystemTime(new Date(now));
  process.argv = ['node', 'scripts/build-advent.ts', ...args];
  vi.resetModules();
  await import(/* @vite-ignore */ SCRIPT);
}
/** the file as it stands */
const read = () => new TextDecoder().decode(readFileSync(file));

describe('scripts/build-advent.ts', () => {
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'sudokui-advent-'));
    mkdirSync(join(folder, 'src', 'content'), { recursive: true });
    file = join(folder, 'src', 'content', 'advent.json');
    vi.spyOn(process, 'cwd').mockReturnValue(folder);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['Date'] });
    made.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.argv = argv;
    rmSync(folder, { recursive: true, force: true });
  });

  it('leaves a published year as it is when not asked to replace it', async () => {
    writeFileSync(file, write(earlier));
    await run(['2026'], '2026-11-15T12:00:00Z');
    expect(made).toEqual([]);
    expect(read()).toBe(write(earlier));
  });

  it('makes a year again with --replace while its first door has not opened, and keeps every other year', async () => {
    writeFileSync(file, write([...earlier, ...next]));
    await run(['2026', '--replace'], '2026-11-29T23:00:00Z');
    expect(made).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    // the year's doors are the new ones, each with its solution's hash; 2027 stays as it was, after them
    expect(read()).toBe(write([...doors, ...next]));
  });

  it('refuses to replace a year whose first door’s day has come, anywhere: the file stays as it was', async () => {
    writeFileSync(file, write(earlier));
    for (const now of ['2026-11-30T00:00:00Z', '2026-12-01T09:00:00Z', '2026-12-25T12:00:00Z', '2027-02-01T12:00:00Z']) {
      await expect(run(['2026', '--replace'], now), now).rejects.toThrow(/door 1 of 2026 has opened/);
      expect(made, now).toEqual([]);
      expect(read(), now).toBe(write(earlier));
    }
  });

  it('adds a year the file does not have, beside the ones it has', async () => {
    writeFileSync(file, write(doors));
    await run(['2027'], '2026-12-10T12:00:00Z');
    expect(made).toHaveLength(24);
    expect(read()).toBe(write([...doors, ...next]));
  });
});
