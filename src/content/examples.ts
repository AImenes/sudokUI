// One real position per technique, found by scripts/hunt-examples.ts and
// stored with the step the engine takes there. tests/examples.test.ts
// re-derives every one of them from its puzzle, so a stored example can
// never drift from what the solver actually does.
import data from './examples.json';
import { Tech } from '../engine/ratings';
import { Example } from './boardSvg';

export const EXAMPLES = data as unknown as Partial<Record<Tech, Example>>;
