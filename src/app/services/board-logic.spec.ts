import {
  computeAdjacentCounts,
  countMines,
  createEmptyBoard,
  getNeighbors,
  placeMines,
} from './board-logic';

/** Deterministic pseudo-random generator so tests are repeatable. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('createEmptyBoard', () => {
  it('creates a grid with the given size and correct coordinates', () => {
    const board = createEmptyBoard(3, 4);
    expect(board.length).toBe(3);
    expect(board[0].length).toBe(4);
    expect(board[2][3]).toEqual({
      row: 2,
      col: 3,
      hasMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    });
  });
});

describe('getNeighbors', () => {
  const board = createEmptyBoard(3, 3);

  it('returns 8 neighbors for a middle cell', () => {
    expect(getNeighbors(board, 1, 1).length).toBe(8);
  });

  it('returns 3 neighbors for a corner cell', () => {
    expect(getNeighbors(board, 0, 0).length).toBe(3);
  });

  it('returns 5 neighbors for an edge cell', () => {
    expect(getNeighbors(board, 0, 1).length).toBe(5);
  });
});

describe('placeMines', () => {
  it('places exactly the requested number of mines', () => {
    for (let seed = 0; seed < 20; seed++) {
      const board = placeMines(createEmptyBoard(16, 30), 99, 5, 5, seededRandom(seed));
      expect(countMines(board)).toBe(99);
    }
  });

  it('never places a mine on or around the first click', () => {
    for (let seed = 0; seed < 50; seed++) {
      const board = placeMines(createEmptyBoard(9, 9), 10, 4, 4, seededRandom(seed));
      expect(board[4][4].hasMine).toBe(false);
      expect(getNeighbors(board, 4, 4).some((n) => n.hasMine)).toBe(false);
    }
  });

  it('keeps only the clicked cell safe when the board is too full', () => {
    // 3x3 board with 8 mines: every cell except the clicked one is a mine.
    const board = placeMines(createEmptyBoard(3, 3), 8, 1, 1, seededRandom(1));
    expect(board[1][1].hasMine).toBe(false);
    expect(countMines(board)).toBe(8);
  });

  it('throws when there are more mines than free cells', () => {
    expect(() => placeMines(createEmptyBoard(3, 3), 9, 1, 1)).toThrow();
  });

  it('does not modify the input board', () => {
    const board = createEmptyBoard(9, 9);
    placeMines(board, 10, 0, 0, seededRandom(3));
    expect(countMines(board)).toBe(0);
  });
});

describe('computeAdjacentCounts', () => {
  it('counts mines in the surrounding cells', () => {
    const board = createEmptyBoard(3, 3);
    board[0][0].hasMine = true;
    board[2][2].hasMine = true;

    const counted = computeAdjacentCounts(board);

    expect(counted[1][1].adjacentMines).toBe(2);
    expect(counted[0][1].adjacentMines).toBe(1);
    expect(counted[2][0].adjacentMines).toBe(0);
    expect(counted[1][2].adjacentMines).toBe(1);
  });

  it('does not count the cell itself', () => {
    const board = createEmptyBoard(3, 3);
    board[1][1].hasMine = true;
    expect(computeAdjacentCounts(board)[1][1].adjacentMines).toBe(0);
  });
});
