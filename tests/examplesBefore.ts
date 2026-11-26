/**
 * The stored examples as the tests of the hint words and drawings were
 * written against them. Filing the AIC with the Nice Loops
 * (docs/rating-chains.md) moved the solve paths, and seven examples with
 * them: the AIC, the AIC with Groups, the AIC with ALSs, the Grouped Nice
 * Loop, the ALS-XZ, the ALS-XY-Wing and the ALS-XY-Chain
 * (src/content/examples.json). Their positions and steps from before are
 * kept in tests/fixtures/examplesBefore.json: the finders are the same, so
 * each step is still what its finder gives at its position, and the tests
 * that pin an example's words, sets and drawing keep the example they
 * were written for (tests/examples.test.ts holds the stored examples
 * themselves to the engine, and the snapshot tests their drawings;
 * tests/storedExampleWords.test.ts pins the words of the stored ones, the
 * ones the Learn pages show, in English, Norwegian and Spanish).
 *
 * Not a test file itself.
 */
import { EXAMPLES } from '../src/content/examples';
import type { Example } from '../src/content/boardSvg';
import type { Tech } from '../src/engine/ratings';
import before from './fixtures/examplesBefore.json';

export const EXAMPLES_BEFORE: Partial<Record<Tech, Example>> = { ...EXAMPLES, ...(before as unknown as Partial<Record<Tech, Example>>) };
