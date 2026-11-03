import {
  computeAdjacentCounts,
  countMines,
  createEmptyBoard,
  getNeighbors,
  Grid,
  revealCell,
  toggleFlag,
} from './board-logic';
import { findHint, generateNoGuessBoard, isSolvableWithoutGuessing } from './solver';

/** Builds a grid from rows of text: '*' is a mine, '.' is empty. */
function gridFromLayout(layout: string[]): Grid {
  const grid = createEmptyBoard(layout.length, layout[0].length);
  layout.forEach((line, row) =>
    [...line].forEach((char, col) => (grid[row][col].hasMine = char === '*')),
  );
  return computeAdjacentCounts(grid);
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

describe('isSolvableWithoutGuessing', () => {
  it('solves a board where the opening reveals everything', () => {
    const grid = gridFromLayout(['....', '....', '....', '...*']);
    expect(isSolvableWithoutGuessing(grid, 0, 0)).toBe(true);
  });

  it('detects a 50/50 that needs a guess', () => {
    // Both bottom cells touch the same two 1s, so either could be the mine.
    const grid = gridFromLayout(['..', '..', '*.']);
    expect(isSolvableWithoutGuessing(grid, 0, 0)).toBe(false);
  });

  it('solves the 1-2-1 pattern, which needs two numbers together', () => {
    // No single number decides anything; comparing the 2 with a 1 finds both mines.
    const grid = gridFromLayout(['...', '...', '*.*']);
    expect(isSolvableWithoutGuessing(grid, 0, 0)).toBe(true);
  });

  it('uses the mine count in the endgame', () => {
    // The bottom-right cell is boxed in by mines, so no number touches it.
    // Once all 3 mines are found, the mine counter proves it is safe.
    const grid = gridFromLayout(['....', '....', '..**', '..*.']);
    expect(isSolvableWithoutGuessing(grid, 0, 0)).toBe(true);
  });
});

describe('generateNoGuessBoard', () => {
  it('returns a solvable board with a safe first click', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const result = generateNoGuessBoard(createEmptyBoard(9, 9), 10, 4, 4, seededRandom(seed));
      expect(result.noGuess).toBe(true);
      expect(countMines(result.grid)).toBe(10);
      expect(result.grid[4][4].hasMine).toBe(false);
      expect(getNeighbors(result.grid, 4, 4).some((n) => n.hasMine)).toBe(false);
      expect(isSolvableWithoutGuessing(result.grid, 4, 4)).toBe(true);
    }
  });

  it('finds no-guess expert boards', () => {
    const result = generateNoGuessBoard(createEmptyBoard(16, 30), 99, 8, 15, seededRandom(42));
    expect(result.noGuess).toBe(true);
    expect(countMines(result.grid)).toBe(99);
  });

  it('gives up on boards that are too dense and says so', () => {
    const result = generateNoGuessBoard(createEmptyBoard(5, 5), 20, 2, 2, seededRandom(3), 5);
    expect(countMines(result.grid)).toBe(20);
    expect(result.noGuess).toBe(isSolvableWithoutGuessing(result.grid, 2, 2));
  });
});

describe('findHint', () => {
  // After opening the top-left corner: row 1 shows 1 2 1 above the mines at (2,0) and (2,2).
  const opened = () => revealCell(gridFromLayout(['...', '...', '*.*']), 0, 0);

  it('points to a cell that is certainly safe', () => {
    expect(findHint(opened())).toEqual({ kind: 'safe', row: 2, col: 1 });
  });

  it('points out a flag that logic proves is wrong', () => {
    const grid = toggleFlag(opened(), 2, 1);
    expect(findHint(grid)).toEqual({ kind: 'wrong-flag', row: 2, col: 1 });
  });

  it('suggests flagging a mine when no safe cell is left', () => {
    let grid = revealCell(opened(), 2, 1);
    grid = toggleFlag(grid, 2, 0);
    expect(findHint(grid)).toEqual({ kind: 'mine', row: 2, col: 2 });
  });

  it('returns null when only a guess is left', () => {
    const grid = revealCell(gridFromLayout(['..', '..', '*.']), 0, 0);
    expect(findHint(grid)).toBeNull();
  });
});
