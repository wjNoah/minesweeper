import {
  chordCell,
  computeAdjacentCounts,
  countFlags,
  countMines,
  createEmptyBoard,
  flagAllMines,
  getNeighbors,
  Grid,
  isLost,
  isWon,
  placeMines,
  revealCell,
  toggleFlag,
} from './board-logic';

/** Builds a grid from rows of text: '*' is a mine, '.' is empty. */
function gridFromLayout(layout: string[]): Grid {
  const grid = createEmptyBoard(layout.length, layout[0].length);
  layout.forEach((line, row) =>
    [...line].forEach((char, col) => (grid[row][col].hasMine = char === '*')),
  );
  return computeAdjacentCounts(grid);
}

function revealedMap(grid: Grid): string[] {
  return grid.map((line) => line.map((cell) => (cell.isRevealed ? 'o' : '#')).join(''));
}

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

  it('can keep only the clicked cell safe when safeArea is off', () => {
    // 3x3 board, 8 mines: possible only if the neighbors of the click may hold mines.
    const board = placeMines(createEmptyBoard(3, 3), 8, 0, 0, seededRandom(2), false);
    expect(board[0][0].hasMine).toBe(false);
    expect(getNeighbors(board, 0, 0).every((n) => n.hasMine)).toBe(true);
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

describe('revealCell', () => {
  it('reveals only the cell when it has a number', () => {
    const grid = gridFromLayout(['*..', '...', '...']);
    const next = revealCell(grid, 0, 1);
    expect(revealedMap(next)).toEqual(['#o#', '###', '###']);
  });

  it('flood fills an empty region and stops at numbers', () => {
    const grid = gridFromLayout([
      '....', //
      '....',
      '..**',
      '..*.',
    ]);
    const next = revealCell(grid, 0, 0);
    expect(revealedMap(next)).toEqual([
      'oooo', //
      'oooo',
      'oo##',
      'oo##',
    ]);
  });

  it('does not open flagged cells during the flood fill', () => {
    const grid = toggleFlag(gridFromLayout(['...', '...', '...']), 2, 2);
    const next = revealCell(grid, 0, 0);
    expect(next[2][2].isRevealed).toBe(false);
    expect(revealedMap(next)).toEqual(['ooo', 'ooo', 'oo#']);
  });

  it('handles a large empty board without a stack overflow', () => {
    const grid = createEmptyBoard(200, 200);
    const next = revealCell(grid, 0, 0);
    expect(next.flat().every((cell) => cell.isRevealed)).toBe(true);
  });

  it('ignores flagged and already revealed cells', () => {
    const flagged = toggleFlag(gridFromLayout(['*.', '..']), 1, 1);
    expect(revealCell(flagged, 1, 1)).toBe(flagged);

    const revealed = revealCell(flagged, 0, 1);
    expect(revealCell(revealed, 0, 1)).toBe(revealed);
  });

  it('does not modify the input grid', () => {
    const grid = gridFromLayout(['...', '...', '...']);
    revealCell(grid, 1, 1);
    expect(grid.flat().some((cell) => cell.isRevealed)).toBe(false);
  });
});

describe('toggleFlag', () => {
  it('places and removes a flag', () => {
    const grid = gridFromLayout(['*.', '..']);
    const flagged = toggleFlag(grid, 0, 0);
    expect(flagged[0][0].isFlagged).toBe(true);
    expect(countFlags(flagged)).toBe(1);

    const unflagged = toggleFlag(flagged, 0, 0);
    expect(unflagged[0][0].isFlagged).toBe(false);
    expect(countFlags(unflagged)).toBe(0);
  });

  it('cannot flag a revealed cell', () => {
    const grid = revealCell(gridFromLayout(['*.', '..']), 0, 1);
    expect(toggleFlag(grid, 0, 1)[0][1].isFlagged).toBe(false);
  });
});

describe('chordCell', () => {
  const layout = ['*..', '...', '..*'];

  it('reveals the hidden neighbors when the flag count matches', () => {
    let grid = revealCell(gridFromLayout(layout), 1, 1); // shows 2
    grid = toggleFlag(grid, 0, 0);
    grid = toggleFlag(grid, 2, 2);

    const next = chordCell(grid, 1, 1);

    expect(revealedMap(next)).toEqual(['#oo', 'ooo', 'oo#']);
    expect(isLost(next)).toBe(false);
  });

  it('does nothing when the flag count does not match', () => {
    let grid = revealCell(gridFromLayout(layout), 1, 1);
    grid = toggleFlag(grid, 0, 0);
    expect(chordCell(grid, 1, 1)).toBe(grid);
  });

  it('reveals a mine when a flag is wrong, which loses the game', () => {
    let grid = revealCell(gridFromLayout(layout), 1, 1);
    grid = toggleFlag(grid, 0, 0);
    grid = toggleFlag(grid, 0, 1); // wrong flag, the real mine is at 2,2

    expect(isLost(chordCell(grid, 1, 1))).toBe(true);
  });

  it('does nothing on hidden cells', () => {
    const grid = gridFromLayout(layout);
    expect(chordCell(grid, 1, 1)).toBe(grid);
  });
});

describe('isWon and isLost', () => {
  it('is neither won nor lost at the start', () => {
    const grid = gridFromLayout(['*.', '..']);
    expect(isWon(grid)).toBe(false);
    expect(isLost(grid)).toBe(false);
  });

  it('is lost when a mine is revealed', () => {
    const grid = revealCell(gridFromLayout(['*.', '..']), 0, 0);
    expect(isLost(grid)).toBe(true);
  });

  it('is won when all safe cells are revealed, even without flags', () => {
    let grid = gridFromLayout(['*.', '..']);
    grid = revealCell(grid, 0, 1);
    grid = revealCell(grid, 1, 0);
    expect(isWon(grid)).toBe(false);
    grid = revealCell(grid, 1, 1);
    expect(isWon(grid)).toBe(true);
  });

  it('flagAllMines flags every mine', () => {
    const grid = flagAllMines(gridFromLayout(['*.', '.*']));
    expect(grid[0][0].isFlagged).toBe(true);
    expect(grid[1][1].isFlagged).toBe(true);
    expect(countFlags(grid)).toBe(2);
  });
});
