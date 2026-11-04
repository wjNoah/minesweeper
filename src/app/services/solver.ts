import {
  countMines,
  getNeighbors,
  Grid,
  isWon,
  placeMines,
  RandomFn,
  revealCell,
  revealCells,
} from './board-logic';

/** "These hidden cells contain exactly this many mines", read from one revealed number. */
interface Constraint {
  cells: number[];
  mines: number;
}

interface Deductions {
  safe: number[];
  mines: number[];
}

export type HintKind = 'safe' | 'mine' | 'wrong-flag';

export interface Hint {
  kind: HintKind;
  row: number;
  col: number;
}

export interface GeneratedBoard {
  grid: Grid;
  /** False if no board that is solvable without guessing was found in time. */
  noGuess: boolean;
}

/**
 * Plays the board like a careful player who never guesses: starting from
 * the first click, it only opens cells that logic proves are safe.
 * Returns true if that is enough to open every safe cell.
 */
export function isSolvableWithoutGuessing(grid: Grid, startRow: number, startCol: number): boolean {
  const cols = grid[0].length;
  const totalMines = countMines(grid);
  const knownMines = new Set<number>();
  let board = revealCell(grid, startRow, startCol);

  while (!isWon(board)) {
    const { safe, mines } = deduce(board, knownMines, totalMines);
    if (safe.length === 0 && mines.length === 0) return false; // Stuck: a guess would be needed.

    mines.forEach((index) => knownMines.add(index));
    board = revealCells(
      board,
      safe.map((index) => ({ row: Math.floor(index / cols), col: index % cols })),
    );
  }
  return true;
}

/**
 * Tries random boards until one can be solved without guessing. Gives up
 * after maxAttempts or timeBudgetMs (very dense custom boards are rarely
 * solvable) and then returns a normal random board.
 */
export function generateNoGuessBoard(
  empty: Grid,
  mineCount: number,
  safeRow: number,
  safeCol: number,
  random: RandomFn = Math.random,
  maxAttempts = 500,
  timeBudgetMs = 1500,
): GeneratedBoard {
  const deadline = performance.now() + timeBudgetMs;
  let grid = empty;
  for (let attempt = 0; attempt < maxAttempts && performance.now() < deadline; attempt++) {
    grid = placeMines(empty, mineCount, safeRow, safeCol, random);
    if (isSolvableWithoutGuessing(grid, safeRow, safeCol)) return { grid, noGuess: true };
  }
  return { grid, noGuess: false };
}

/**
 * Finds a move that logic proves is right, using only what the player can
 * see: revealed numbers and the mine count. The player's flags are ignored
 * because they might be wrong. Prefers pointing out a wrong flag, then a
 * safe cell, then a mine to flag. Returns null when only a guess is left.
 */
export function findHint(grid: Grid): Hint | null {
  const cols = grid[0].length;
  const totalMines = countMines(grid);
  const knownMines = new Set<number>();
  const toHint = (kind: HintKind, index: number): Hint => ({
    kind,
    row: Math.floor(index / cols),
    col: index % cols,
  });
  const isFlagged = (index: number) => grid[Math.floor(index / cols)][index % cols].isFlagged;

  // Without opening anything, keep deducing: found mines can unlock safe cells.
  for (;;) {
    const { safe, mines } = deduce(grid, knownMines, totalMines);
    const wrongFlag = safe.find(isFlagged);
    if (wrongFlag !== undefined) return toHint('wrong-flag', wrongFlag);
    if (safe.length > 0) return toHint('safe', safe[0]);
    if (mines.length === 0) break;
    mines.forEach((index) => knownMines.add(index));
  }

  const unflaggedMine = [...knownMines].find((index) => !isFlagged(index));
  return unflaggedMine === undefined ? null : toHint('mine', unflaggedMine);
}

/**
 * Finds cells that are certainly safe or certainly mines, using only what a
 * player can see. Uses the simplest rule that finds something:
 * 1. A single number: all its mines found, or all its hidden cells are mines.
 * 2. Two overlapping numbers (like the 1-2-1 pattern).
 * 3. The total number of mines left.
 */
function deduce(board: Grid, knownMines: Set<number>, totalMines: number): Deductions {
  const cols = board[0].length;
  const indexOf = (row: number, col: number) => row * cols + col;
  const isUnknown = (row: number, col: number) =>
    !board[row][col].isRevealed && !knownMines.has(indexOf(row, col));

  const constraints: Constraint[] = [];
  for (const cell of board.flat()) {
    if (!cell.isRevealed || cell.adjacentMines === 0) continue;
    const neighbors = getNeighbors(board, cell.row, cell.col);
    const unknown = neighbors
      .filter((n) => isUnknown(n.row, n.col))
      .map((n) => indexOf(n.row, n.col));
    if (unknown.length === 0) continue;
    const found = neighbors.filter((n) => knownMines.has(indexOf(n.row, n.col))).length;
    constraints.push({ cells: unknown, mines: cell.adjacentMines - found });
  }

  const safe = new Set<number>();
  const mines = new Set<number>();
  const result = () => ({ safe: [...safe], mines: [...mines] });

  // Rule 1: one number on its own.
  for (const { cells, mines: count } of constraints) {
    if (count === 0) cells.forEach((i) => safe.add(i));
    if (count === cells.length) cells.forEach((i) => mines.add(i));
  }
  if (safe.size > 0 || mines.size > 0) return result();

  // Rule 2: two numbers that share cells. If A has exactly |onlyA| more mines
  // than B, the cells only A touches must all be mines and the cells only B
  // touches must all be safe.
  const byCell = new Map<number, Constraint[]>();
  for (const constraint of constraints) {
    for (const i of constraint.cells) byCell.set(i, [...(byCell.get(i) ?? []), constraint]);
  }
  for (const a of constraints) {
    const partners = new Set(a.cells.flatMap((i) => byCell.get(i) ?? []));
    for (const b of partners) {
      if (b === a) continue;
      const onlyA = a.cells.filter((i) => !b.cells.includes(i));
      const onlyB = b.cells.filter((i) => !a.cells.includes(i));
      if (a.mines - b.mines === onlyA.length) {
        onlyA.forEach((i) => mines.add(i));
        onlyB.forEach((i) => safe.add(i));
      }
    }
  }
  if (safe.size > 0 || mines.size > 0) return result();

  // Rule 3: the mine counter. No mines left means every hidden cell is safe;
  // as many mines as hidden cells means they are all mines.
  const unknownCells = board
    .flat()
    .filter((cell) => isUnknown(cell.row, cell.col))
    .map((cell) => indexOf(cell.row, cell.col));
  const minesLeft = totalMines - knownMines.size;
  if (minesLeft === 0) unknownCells.forEach((i) => safe.add(i));
  if (minesLeft === unknownCells.length) unknownCells.forEach((i) => mines.add(i));
  return result();
}
