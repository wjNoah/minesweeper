import { TestBed } from '@angular/core/testing';
import {
  computeAdjacentCounts,
  countMines,
  createEmptyBoard,
  getNeighbors,
  Grid,
  placeMines,
} from './board-logic';
import { isSolvableWithoutGuessing } from './solver';
import { GameService } from './game.service';
import { SettingsService } from './settings.service';

/** Repeatable boards: a test must not pass or fail by chance. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

/** '*' is a mine, '.' is empty. */
function gridFromLayout(layout: string[]): Grid {
  const grid = createEmptyBoard(layout.length, layout[0].length);
  layout.forEach((line, row) =>
    [...line].forEach((char, col) => (grid[row][col].hasMine = char === '*')),
  );
  return computeAdjacentCounts(grid);
}

describe('GameService', () => {
  let game: GameService;

  /** Position of any cell that matches, after mines are placed. */
  function find(predicate: (hasMine: boolean, isRevealed: boolean) => boolean) {
    const cell = game
      .board()
      .flat()
      .find((c) => predicate(c.hasMine, c.isRevealed));
    if (!cell) throw new Error('No matching cell');
    return cell;
  }

  function revealAllSafeCells(): void {
    for (const cell of game.board().flat()) {
      if (!cell.hasMine) game.reveal(cell.row, cell.col);
    }
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    game = TestBed.inject(GameService);
    game.random = seededRandom(7);
    game.setDifficulty('beginner');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with an empty 9x9 board without mines', () => {
    expect(game.board().length).toBe(9);
    expect(game.board()[0].length).toBe(9);
    expect(countMines(game.board())).toBe(0);
    expect(game.status()).toBe('ready');
  });

  it('places mines on the first reveal and keeps the clicked cell safe', () => {
    game.reveal(3, 5);
    const cell = game.board()[3][5];
    expect(countMines(game.board())).toBe(10);
    expect(cell.hasMine).toBe(false);
    expect(cell.isRevealed).toBe(true);
    expect(game.status()).not.toBe('lost');
  });

  it('places mines only once', () => {
    const minePositions = () =>
      game
        .board()
        .flat()
        .map((cell) => cell.hasMine);
    game.reveal(0, 0);
    const afterFirstClick = minePositions();
    game.toggleFlag(8, 8);
    game.reveal(4, 4);
    expect(minePositions()).toEqual(afterFirstClick);
  });

  describe('flagging', () => {
    it('updates the remaining mines counter', () => {
      game.toggleFlag(0, 0);
      game.toggleFlag(0, 1);
      expect(game.minesLeft()).toBe(8);
      game.toggleFlag(0, 0);
      expect(game.minesLeft()).toBe(9);
    });

    it('does not reveal a flagged cell', () => {
      game.toggleFlag(2, 2);
      game.reveal(2, 2);
      expect(game.board()[2][2].isRevealed).toBe(false);
      expect(game.status()).toBe('ready');
    });

    it('flag mode makes a normal click toggle flags', () => {
      game.setFlagMode(true);
      game.primaryAction(1, 1);
      expect(game.board()[1][1].isFlagged).toBe(true);
      expect(game.board()[1][1].isRevealed).toBe(false);

      game.setFlagMode(false);
      game.primaryAction(4, 4);
      expect(game.board()[4][4].isRevealed).toBe(true);
    });

    it('secondary action flags hidden cells', () => {
      game.secondaryAction(0, 0);
      expect(game.board()[0][0].isFlagged).toBe(true);
    });
  });

  describe('1v1 rounds', () => {
    function startRound(rule: 'defeat' | 'penalty'): void {
      game.prepareMatch('beginner', rule, 10);
      const minefield = placeMines(createEmptyBoard(9, 9), 10, 4, 4, seededRandom(5));
      game.startMatchRound(minefield, { row: 4, col: 4 });
    }

    it('blocks input until the round starts', () => {
      game.prepareMatch('beginner', 'defeat', 10);
      game.reveal(0, 0);
      expect(game.status()).toBe('ready');
      expect(
        game
          .board()
          .flat()
          .some((c) => c.isRevealed),
      ).toBe(false);
    });

    it('starts with the shared opening already revealed', () => {
      startRound('defeat');
      expect(game.status()).toBe('playing');
      expect(game.board()[4][4].isRevealed).toBe(true);
    });

    it('with the penalty rule, a mine is flagged and adds seconds instead of ending the game', () => {
      startRound('penalty');
      vi.advanceTimersByTime(3000);
      const mine = find((hasMine) => hasMine);
      game.reveal(mine.row, mine.col);

      expect(game.status()).toBe('playing');
      expect(game.minesHit()).toBe(1);
      expect(game.board()[mine.row][mine.col].isFlagged).toBe(true);
      expect(game.displaySeconds()).toBe(13);
      expect(game.totalMs()).toBe(13_000);
    });

    it('with the penalty rule, a mine stays marked and shows a short message', () => {
      startRound('penalty');
      const mine = find((hasMine) => hasMine);
      game.reveal(mine.row, mine.col);

      expect(game.board()[mine.row][mine.col].isHit).toBe(true);
      expect(game.penaltyFlash()?.seconds).toBe(10);

      vi.advanceTimersByTime(1300);
      expect(game.penaltyFlash()).toBeNull();
      expect(game.board()[mine.row][mine.col].isHit).toBe(true);
    });

    it('a second quick hit shows the message again', () => {
      startRound('penalty');
      const [first, second] = game
        .board()
        .flat()
        .filter((cell) => cell.hasMine);
      game.reveal(first.row, first.col);
      const firstId = game.penaltyFlash()?.id;
      game.reveal(second.row, second.col);
      expect(game.penaltyFlash()?.id).not.toBe(firstId);
    });

    it('adds the penalty for every mine when one chord hits several', () => {
      game.prepareMatch('beginner', 'penalty', 10);
      game.startMatchRound(gridFromLayout(['*.*......', ...Array(8).fill('.........')]), {
        row: 0,
        col: 1,
      });
      game.toggleFlag(1, 0); // Two wrong flags, so the chord opens both mines.
      game.toggleFlag(1, 1);
      game.chord(0, 1);

      expect(game.minesHit()).toBe(2);
      expect(game.penaltyFlash()?.seconds).toBe(20);
      expect(game.displaySeconds()).toBe(20);
      expect(game.status()).toBe('playing');
    });

    it('a hit mine stays flagged, so it costs a penalty only once', () => {
      startRound('penalty');
      const mine = find((hasMine) => hasMine);
      game.reveal(mine.row, mine.col);
      game.toggleFlag(mine.row, mine.col);
      game.reveal(mine.row, mine.col);
      expect(game.minesHit()).toBe(1);
      expect(game.board()[mine.row][mine.col].isFlagged).toBe(true);
    });

    it('a new game starts without penalties or a leftover message', () => {
      startRound('penalty');
      const mine = find((hasMine) => hasMine);
      game.reveal(mine.row, mine.col);

      game.newGame();
      expect(game.minesHit()).toBe(0);
      expect(game.penaltyFlash()).toBeNull();
      expect(game.displaySeconds()).toBe(0);
    });

    it('after leaving a match, a mine ends the game again and adds no seconds', () => {
      startRound('penalty');
      game.leaveMatch();
      expect(game.mode()).toBe('solo');
      expect(game.penaltySeconds()).toBe(0);

      game.reveal(4, 4);
      const mine = find((hasMine) => hasMine);
      game.reveal(mine.row, mine.col);
      expect(game.status()).toBe('lost');
    });

    it('flags are blocked during the countdown too', () => {
      game.prepareMatch('beginner', 'defeat', 10);
      game.toggleFlag(0, 0);
      expect(game.board()[0][0].isFlagged).toBe(false);
    });

    it('stopping a round freezes the time', () => {
      startRound('penalty');
      vi.advanceTimersByTime(2000);
      game.stopMatchRound();
      expect(game.status()).toBe('stopped');

      vi.advanceTimersByTime(5000);
      expect(game.elapsedSeconds()).toBe(2);
      expect(game.totalMs()).toBe(2000);
    });

    it('never reports a negative time, even if the computer’s clock is set back', () => {
      startRound('defeat');
      vi.setSystemTime(Date.now() - 60_000);
      expect(game.totalMs()).toBe(0);
    });

    it('with the defeat rule, a mine ends the game', () => {
      startRound('defeat');
      const mine = find((hasMine) => hasMine);
      game.reveal(mine.row, mine.col);
      expect(game.status()).toBe('lost');
    });

    it('does not record best times or give hints in a match', () => {
      startRound('defeat');
      game.showHint();
      expect(game.hint()).toBeNull();
      revealAllSafeCells();
      expect(game.status()).toBe('won');
      expect(localStorage.getItem('minesweeper.bestTimes')).toBeNull();
    });
  });

  describe('hints', () => {
    it('does nothing before the first click', () => {
      game.showHint();
      expect(game.hint()).toBeNull();
      expect(game.hintsUsed()).toBe(0);
    });

    it('shows a proven move and clears it after the next move', () => {
      TestBed.inject(SettingsService).update({ noGuess: true });
      game.reveal(4, 4);
      game.showHint();

      const hint = game.hint();
      if (!hint) throw new Error('A no-guess board always has a hint');
      const cell = game.board()[hint.row][hint.col];
      expect(hint.kind === 'safe' ? !cell.hasMine : cell.hasMine).toBe(true);
      expect(game.hintsUsed()).toBe(1);

      game.toggleFlag(hint.row, hint.col);
      expect(game.hint()).toBeNull();
    });

    it('any move clears the hint, not only a flag', () => {
      TestBed.inject(SettingsService).update({ noGuess: true });
      game.reveal(4, 4);
      game.showHint();
      const safe = find((hasMine, isRevealed) => !hasMine && !isRevealed);
      expect(game.hint()).not.toBeNull();

      game.reveal(safe.row, safe.col);
      expect(game.hint()).toBeNull();
    });

    it('does not count a game won with hints for best times', () => {
      TestBed.inject(SettingsService).update({ noGuess: true }); // Always has a hint to show.
      game.reveal(4, 4);
      game.showHint();
      expect(game.hintsUsed()).toBe(1);
      revealAllSafeCells();
      expect(game.status()).toBe('won');
      expect(localStorage.getItem('minesweeper.bestTimes')).toBeNull();
    });
  });

  describe('no guessing', () => {
    beforeEach(() => TestBed.inject(SettingsService).update({ noGuess: true }));

    it('deals a board that can be solved by logic alone', () => {
      game.reveal(4, 4);
      expect(game.isNoGuess()).toBe(true);
      expect(game.noGuessFallback()).toBe(false);
      expect(countMines(game.board())).toBe(10);
      expect(isSolvableWithoutGuessing(game.board(), 4, 4)).toBe(true);
    });

    it('keeps its own best times', () => {
      game.reveal(4, 4);
      vi.advanceTimersByTime(30_000);
      revealAllSafeCells();
      expect(JSON.parse(localStorage.getItem('minesweeper.bestTimes') ?? '{}')).toEqual({
        'beginner-ng': 30,
      });
    });
  });

  describe('settings', () => {
    it('with safeArea on, the first click always opens an area', () => {
      for (let seed = 1; seed <= 20; seed++) {
        game.random = seededRandom(seed);
        game.newGame();
        game.reveal(4, 4);
        expect(getNeighbors(game.board(), 4, 4).some((n) => n.hasMine)).toBe(false);
      }
    });

    it('with safeArea off, only the clicked cell is guaranteed to be safe', () => {
      TestBed.inject(SettingsService).update({ safeArea: false });
      let foundMineNextToClick = false;
      for (let seed = 1; seed <= 40; seed++) {
        game.random = seededRandom(seed);
        game.newGame();
        game.reveal(4, 4);
        expect(game.board()[4][4].hasMine).toBe(false);
        foundMineNextToClick ||= getNeighbors(game.board(), 4, 4).some((n) => n.hasMine);
      }
      expect(foundMineNextToClick).toBe(true);
    });

    it('a click on a number chords when chordOnClick is on, which is the default', () => {
      game.board.set(gridFromLayout(['*..', '...', '...']));
      game.status.set('playing');
      game.reveal(0, 1);
      game.toggleFlag(0, 0);
      game.primaryAction(0, 1);
      expect(game.board()[1][1].isRevealed).toBe(true);
    });

    it('does not chord on a single click when chordOnClick is off', () => {
      TestBed.inject(SettingsService).update({ chordOnClick: false });
      // Fixed pseudo-random sequence, so the board always has a number to chord.
      let seed = 7;
      game.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      game.reveal(4, 4);
      const target = game
        .board()
        .flat()
        .find(
          (cell) =>
            cell.isRevealed &&
            cell.adjacentMines > 0 &&
            getNeighbors(game.board(), cell.row, cell.col).some((n) => !n.isRevealed && !n.hasMine),
        );
      if (!target) throw new Error('Board has no revealed number');
      getNeighbors(game.board(), target.row, target.col)
        .filter((n) => n.hasMine)
        .forEach((n) => game.toggleFlag(n.row, n.col));
      const before = game.board();

      game.primaryAction(target.row, target.col);
      expect(game.board()).toBe(before);

      game.chord(target.row, target.col);
      expect(game.board()).not.toBe(before);
    });
  });

  describe('chording', () => {
    it('opens the neighbors of a number when all its mines are flagged', () => {
      game.reveal(4, 4);
      const target = game
        .board()
        .flat()
        .find((cell) => cell.isRevealed && cell.adjacentMines > 0);
      if (!target) throw new Error('Board has no revealed number');
      const neighbors = () => getNeighbors(game.board(), target.row, target.col);

      neighbors()
        .filter((n) => n.hasMine)
        .forEach((n) => game.toggleFlag(n.row, n.col));
      game.revealOrChord(target.row, target.col);

      expect(neighbors().every((n) => (n.hasMine ? n.isFlagged : n.isRevealed))).toBe(true);
      expect(game.status()).not.toBe('lost');
    });
  });

  describe('win and lose', () => {
    it('loses when a mine is revealed and ignores further moves', () => {
      game.reveal(4, 4);
      const mine = find((hasMine) => hasMine);
      game.reveal(mine.row, mine.col);
      expect(game.status()).toBe('lost');

      const safe = find((hasMine, isRevealed) => !hasMine && !isRevealed);
      game.reveal(safe.row, safe.col);
      expect(game.board()[safe.row][safe.col].isRevealed).toBe(false);

      game.toggleFlag(safe.row, safe.col);
      expect(game.board()[safe.row][safe.col].isFlagged).toBe(false);
    });

    it('wins when all safe cells are revealed and flags every mine', () => {
      game.reveal(4, 4);
      revealAllSafeCells();
      expect(game.status()).toBe('won');
      expect(game.minesLeft()).toBe(0);
    });

    it('restart creates a fresh board', () => {
      game.reveal(4, 4);
      game.newGame();
      expect(game.status()).toBe('ready');
      expect(countMines(game.board())).toBe(0);
      expect(
        game
          .board()
          .flat()
          .some((c) => c.isRevealed),
      ).toBe(false);
    });
  });

  describe('difficulty', () => {
    it('uses the beginner and intermediate sizes', () => {
      game.setDifficulty('beginner');
      expect(game.config()).toEqual({ rows: 9, cols: 9, mines: 10 });
      game.setDifficulty('intermediate');
      expect(game.config()).toEqual({ rows: 16, cols: 16, mines: 40 });
      game.reveal(0, 0);
      expect(countMines(game.board())).toBe(40);
    });

    it('turns an empty custom field into the smallest allowed value', () => {
      game.setDifficulty('custom', { rows: Number.NaN, cols: Number.NaN, mines: Number.NaN });
      expect(game.config()).toEqual({ rows: 5, cols: 5, mines: 1 });
    });

    it('uses the expert size of 30 columns, 16 rows and 99 mines', () => {
      game.setDifficulty('expert');
      expect(game.board().length).toBe(16);
      expect(game.board()[0].length).toBe(30);
      game.reveal(0, 0);
      expect(countMines(game.board())).toBe(99);
    });

    it('limits custom sizes to a playable range', () => {
      game.setDifficulty('custom', { rows: 2, cols: 100, mines: 5000 });
      expect(game.config()).toEqual({ rows: 5, cols: 40, mines: 199 });
    });
  });

  describe('timer and best times', () => {
    it('starts on the first reveal and stops when the game ends', () => {
      vi.advanceTimersByTime(5000);
      expect(game.elapsedSeconds()).toBe(0);

      game.reveal(4, 4);
      vi.advanceTimersByTime(3000);
      expect(game.elapsedSeconds()).toBe(3);

      revealAllSafeCells();
      vi.advanceTimersByTime(10_000);
      expect(game.elapsedSeconds()).toBe(3);
    });

    it('saves a new best time per difficulty in localStorage', () => {
      game.reveal(4, 4);
      vi.advanceTimersByTime(42_000);
      revealAllSafeCells();

      expect(game.isNewBest()).toBe(true);
      expect(JSON.parse(localStorage.getItem('minesweeper.bestTimes') ?? '{}')).toEqual({
        beginner: 42,
      });
    });

    it('does not replace a better best time', () => {
      game.reveal(4, 4);
      vi.advanceTimersByTime(10_000);
      revealAllSafeCells();

      game.newGame();
      game.reveal(4, 4);
      vi.advanceTimersByTime(20_000);
      revealAllSafeCells();

      expect(game.isNewBest()).toBe(false);
      expect(JSON.parse(localStorage.getItem('minesweeper.bestTimes') ?? '{}').beginner).toBe(10);
    });

    it('does not save best times for custom boards', () => {
      game.setDifficulty('custom', { rows: 9, cols: 9, mines: 10 });
      game.reveal(4, 4);
      revealAllSafeCells();
      expect(localStorage.getItem('minesweeper.bestTimes')).toBeNull();
    });
  });
});
