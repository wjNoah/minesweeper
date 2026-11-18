/** Gap between two cells, as in board.scss. */
const CELL_GAP_PX = 3;
/** Bigger cells only make the board harder to take in. */
export const MAX_FITTED_CELL_PX = 72;

export interface Space {
  width: number;
  height: number;
}

/**
 * The largest cell size at which the whole board fits into the space. frame is the
 * board's padding and border on two opposite sides together. Never below minSize
 * (the normal cell size): a board that doesn't fit even then scrolls instead.
 */
export function fitCellSize(
  space: Space,
  grid: { rows: number; cols: number },
  frame: number,
  minSize: number,
  maxSize = MAX_FITTED_CELL_PX,
): number {
  const perCell = (length: number, count: number) =>
    (length - frame - CELL_GAP_PX * (count - 1)) / count;
  const size = Math.floor(
    Math.min(perCell(space.width, grid.cols), perCell(space.height, grid.rows)),
  );
  return Math.max(minSize, Math.min(Math.max(maxSize, minSize), size));
}
