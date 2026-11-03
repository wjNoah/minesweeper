import { CellState } from '../models/cell.model';

export type Grid = CellState[][];

/** Returns a function that produces numbers in [0, 1), like Math.random. */
export type RandomFn = () => number;

export function createEmptyBoard(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      hasMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    })),
  );
}

export function isInside(board: Grid, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[0].length;
}

/** All cells around (row, col), up to 8, excluding the cell itself. */
export function getNeighbors(board: Grid, row: number, col: number): CellState[] {
  const neighbors: CellState[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dr !== 0 || dc !== 0) && isInside(board, row + dr, col + dc)) {
        neighbors.push(board[row + dr][col + dc]);
      }
    }
  }
  return neighbors;
}

/**
 * Places mines after the first click so that click is always safe.
 * The clicked cell and its neighbors are kept free, so the first click
 * opens an area. If the board is too full for that (custom sizes), only
 * the clicked cell itself is kept free.
 */
export function placeMines(
  board: Grid,
  mineCount: number,
  safeRow: number,
  safeCol: number,
  random: RandomFn = Math.random,
): Grid {
  const rows = board.length;
  const cols = board[0].length;
  const isNearSafeCell = (r: number, c: number) =>
    Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1;
  const isSafeCell = (r: number, c: number) => r === safeRow && c === safeCol;

  const allCells = board.flat();
  let candidates = allCells.filter((cell) => !isNearSafeCell(cell.row, cell.col));
  if (candidates.length < mineCount) {
    candidates = allCells.filter((cell) => !isSafeCell(cell.row, cell.col));
  }
  if (candidates.length < mineCount) {
    throw new Error(`Cannot place ${mineCount} mines on a ${rows}x${cols} board`);
  }

  // Partial Fisher-Yates shuffle: the first mineCount candidates become mines.
  const pool = candidates.map((cell) => cell.row * cols + cell.col);
  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const mineIndexes = new Set(pool.slice(0, mineCount));

  const withMines = board.map((line) =>
    line.map((cell) => ({ ...cell, hasMine: mineIndexes.has(cell.row * cols + cell.col) })),
  );
  return computeAdjacentCounts(withMines);
}

export function computeAdjacentCounts(board: Grid): Grid {
  return board.map((line) =>
    line.map((cell) => ({
      ...cell,
      adjacentMines: getNeighbors(board, cell.row, cell.col).filter((n) => n.hasMine).length,
    })),
  );
}

export function countMines(board: Grid): number {
  return board.flat().filter((cell) => cell.hasMine).length;
}
