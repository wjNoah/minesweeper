import { Injectable, signal } from '@angular/core';
import { Grid, createEmptyBoard, placeMines, RandomFn } from './board-logic';

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly rows = signal(9);
  readonly cols = signal(9);
  readonly mineCount = signal(10);
  readonly board = signal<Grid>(createEmptyBoard(9, 9));

  private minesPlaced = false;

  /** Replaceable in tests to get a predictable board. */
  random: RandomFn = Math.random;

  newGame(): void {
    this.board.set(createEmptyBoard(this.rows(), this.cols()));
    this.minesPlaced = false;
  }

  reveal(row: number, col: number): void {
    if (!this.minesPlaced) {
      this.board.set(placeMines(this.board(), this.mineCount(), row, col, this.random));
      this.minesPlaced = true;
    }
    this.board.update((board) =>
      board.map((line) =>
        line.map((cell) =>
          cell.row === row && cell.col === col ? { ...cell, isRevealed: true } : cell,
        ),
      ),
    );
  }
}
