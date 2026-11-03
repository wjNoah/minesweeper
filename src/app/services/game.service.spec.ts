import { TestBed } from '@angular/core/testing';
import { countMines } from './board-logic';
import { GameService } from './game.service';

describe('GameService', () => {
  let game: GameService;

  beforeEach(() => {
    game = TestBed.inject(GameService);
    game.newGame();
  });

  it('starts with an empty 9x9 board without mines', () => {
    expect(game.board().length).toBe(9);
    expect(game.board()[0].length).toBe(9);
    expect(countMines(game.board())).toBe(0);
  });

  it('places mines on the first reveal and keeps the clicked cell safe', () => {
    game.reveal(3, 5);
    const cell = game.board()[3][5];
    expect(countMines(game.board())).toBe(10);
    expect(cell.hasMine).toBe(false);
    expect(cell.isRevealed).toBe(true);
  });

  it('places mines only once', () => {
    const minePositions = () =>
      game
        .board()
        .flat()
        .map((cell) => cell.hasMine);
    game.reveal(0, 0);
    const afterFirstClick = minePositions();
    game.reveal(8, 8);
    expect(minePositions()).toEqual(afterFirstClick);
  });
});
