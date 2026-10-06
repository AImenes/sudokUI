// Spanish versions of the engine's sentences (src/engine/text.ts), keyed
// by the English template with its holes numbered {0}, {1}, ... in the
// order they appear. A hole may move, as the sentence needs; every hole
// must appear. tests/i18n.test.ts holds this table to the engine's source.
import type { EngineTable } from '../../engine/text';

const engine: EngineTable = {};

export default engine;
