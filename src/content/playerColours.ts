// The nine colours a player paints cells with (the Colour pad), shared by
// the board (src/ui/Grid.tsx), the pad and the settings, and by the
// picture of the board (src/content/boardSvg.ts), which draws them the way
// the board does: over the cell at a little over half strength, side by
// side when a cell has several.

/** the colours, by the index a cell keeps (CellState.colors) */
export const PALETTE = ['#e05563', '#e8934a', '#e6c74c', '#67b96a', '#4fc1b0', '#5b8fe0', '#9b74d8', '#d873b8', '#9aa3b5'];

/** how strongly a colour lies over its cell */
export const PALETTE_OPACITY = 0.55;
