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

export function isInside(grid: Grid, row: number, col: number): boolean {
  return row >= 0 && row < grid.length && col >= 0 && col < grid[0].length;
}

/** All cells around (row, col), up to 8, excluding the cell itself. */
export function getNeighbors(grid: Grid, row: number, col: number): CellState[] {
  const neighbors: CellState[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dr !== 0 || dc !== 0) && isInside(grid, row + dr, col + dc)) {
        neighbors.push(grid[row + dr][col + dc]);
      }
    }
  }
  return neighbors;
}

/**
 * Places mines after the first click so that click is always safe.
 * With safeArea, the clicked cell and its neighbors are kept free, so the
 * first click opens an area. If the grid is too full for that (custom
 * sizes), or safeArea is off, only the clicked cell itself is kept free.
 */
export function placeMines(
  grid: Grid,
  mineCount: number,
  safeRow: number,
  safeCol: number,
  random: RandomFn = Math.random,
  safeArea = true,
): Grid {
  const rows = grid.length;
  const cols = grid[0].length;
  const isNearSafeCell = (r: number, c: number) =>
    Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1;
  const isSafeCell = (r: number, c: number) => r === safeRow && c === safeCol;

  const allCells = grid.flat();
  let candidates = allCells.filter((cell) => !isNearSafeCell(cell.row, cell.col));
  if (!safeArea || candidates.length < mineCount) {
    candidates = allCells.filter((cell) => !isSafeCell(cell.row, cell.col));
  }
  if (candidates.length < mineCount) {
    throw new Error(`Cannot place ${mineCount} mines on a ${rows}x${cols} grid`);
  }

  // Partial Fisher-Yates shuffle: the first mineCount candidates become mines.
  const pool = candidates.map((cell) => cell.row * cols + cell.col);
  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const mineIndexes = new Set(pool.slice(0, mineCount));

  const withMines = grid.map((line) =>
    line.map((cell) => ({ ...cell, hasMine: mineIndexes.has(cell.row * cols + cell.col) })),
  );
  return computeAdjacentCounts(withMines);
}

export function computeAdjacentCounts(grid: Grid): Grid {
  return grid.map((line) =>
    line.map((cell) => ({
      ...cell,
      adjacentMines: getNeighbors(grid, cell.row, cell.col).filter((n) => n.hasMine).length,
    })),
  );
}

export function countMines(grid: Grid): number {
  return grid.flat().filter((cell) => cell.hasMine).length;
}

export function countFlags(grid: Grid): number {
  return grid.flat().filter((cell) => cell.isFlagged).length;
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((line) => line.map((cell) => ({ ...cell })));
}

/** Returns a new grid where only the given cell is changed. */
function updateCell(grid: Grid, row: number, col: number, changes: Partial<CellState>): Grid {
  return grid.map((line, r) =>
    r !== row ? line : line.map((cell, c) => (c === col ? { ...cell, ...changes } : cell)),
  );
}

/**
 * Reveals a cell. If it has no adjacent mines, the whole empty region and
 * its numbered border are opened too (flood fill). The flood fill uses an
 * explicit stack instead of recursion, so large empty areas can't overflow
 * the call stack. Flagged cells are never opened.
 */
export function revealCell(grid: Grid, row: number, col: number): Grid {
  const start = grid[row][col];
  if (start.isRevealed || start.isFlagged) return grid;

  const next = cloneGrid(grid);
  const stack: CellState[] = [next[row][col]];
  while (stack.length > 0) {
    const cell = stack.pop()!;
    if (cell.isRevealed || cell.isFlagged) continue;
    cell.isRevealed = true;
    if (!cell.hasMine && cell.adjacentMines === 0) {
      stack.push(...getNeighbors(next, cell.row, cell.col));
    }
  }
  return next;
}

export function toggleFlag(grid: Grid, row: number, col: number): Grid {
  const cell = grid[row][col];
  if (cell.isRevealed) return grid;
  return updateCell(grid, row, col, { isFlagged: !cell.isFlagged });
}

/**
 * Chording: on a revealed number whose flag count matches the number,
 * reveal all other hidden neighbors at once.
 */
export function chordCell(grid: Grid, row: number, col: number): Grid {
  const cell = grid[row][col];
  if (!cell.isRevealed || cell.adjacentMines === 0) return grid;

  const neighbors = getNeighbors(grid, row, col);
  const flags = neighbors.filter((n) => n.isFlagged).length;
  if (flags !== cell.adjacentMines) return grid;

  return neighbors.reduce((current, n) => revealCell(current, n.row, n.col), grid);
}

export function isLost(grid: Grid): boolean {
  return grid.flat().some((cell) => cell.hasMine && cell.isRevealed);
}

/** Won when every cell without a mine is revealed. */
export function isWon(grid: Grid): boolean {
  return grid.flat().every((cell) => cell.hasMine || cell.isRevealed);
}

/** After a win, every mine gets a flag so the counter shows 0. */
export function flagAllMines(grid: Grid): Grid {
  return grid.map((line) =>
    line.map((cell) => (cell.hasMine ? { ...cell, isFlagged: true } : cell)),
  );
}
