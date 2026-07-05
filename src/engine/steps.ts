import { Tech } from './ratings';

export interface CellDigit {
  cell: number;
  digit: number;
}

/** One solving step: what to do, plus everything needed to visualise it. */
export interface Step {
  tech: Tech;
  placements: CellDigit[];
  eliminations: CellDigit[];
  /** pattern candidates highlighted blue (e.g. base cells, chain cells) */
  primary?: CellDigit[];
  /** supporting candidates highlighted amber (e.g. cover cells, pincers) */
  secondary?: CellDigit[];
  /** fins / special cells highlighted purple */
  fins?: CellDigit[];
  /** ordered chain of cells, for drawing chain links */
  chainCells?: number[];
  description: string;
}
