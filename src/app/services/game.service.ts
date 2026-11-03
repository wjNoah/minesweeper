import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  DifficultyId,
  GameConfig,
  GameStatus,
  normalizeConfig,
  PRESETS,
} from '../models/game.model';
import { BestTimesService } from './best-times.service';
import {
  chordCell,
  countFlags,
  createEmptyBoard,
  flagAllMines,
  Grid,
  isLost,
  isWon,
  placeMines,
  RandomFn,
  revealCell,
  toggleFlag,
} from './board-logic';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly bestTimes = inject(BestTimesService);

  readonly difficulty = signal<DifficultyId>('beginner');
  readonly config = signal<GameConfig>(PRESETS[0]);
  readonly board = signal<Grid>(createEmptyBoard(PRESETS[0].rows, PRESETS[0].cols));
  readonly status = signal<GameStatus>('ready');
  /** When on, a normal click places or removes flags instead of revealing. */
  readonly flagMode = signal(false);
  readonly elapsedSeconds = signal(0);
  readonly isNewBest = signal(false);

  readonly minesLeft = computed(() => this.config().mines - countFlags(this.board()));
  readonly isOver = computed(() => this.status() === 'won' || this.status() === 'lost');

  /** Replaceable in tests to get a predictable board. */
  random: RandomFn = Math.random;

  private timerId: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  newGame(): void {
    const { rows, cols } = this.config();
    this.stopTimer();
    this.board.set(createEmptyBoard(rows, cols));
    this.status.set('ready');
    this.elapsedSeconds.set(0);
    this.isNewBest.set(false);
  }

  setDifficulty(id: DifficultyId, custom?: GameConfig): void {
    const preset = PRESETS.find((p) => p.id === id);
    const config = preset ?? normalizeConfig(custom ?? this.config());
    this.difficulty.set(id);
    this.config.set({ rows: config.rows, cols: config.cols, mines: config.mines });
    this.newGame();
  }

  toggleFlagMode(): void {
    this.flagMode.update((on) => !on);
  }

  /** Normal click or tap. */
  primaryAction(row: number, col: number): void {
    if (this.flagMode()) {
      this.secondaryAction(row, col);
    } else {
      this.revealOrChord(row, col);
    }
  }

  /** Right-click, Shift+Click or long press: flag hidden cells, chord numbers. */
  secondaryAction(row: number, col: number): void {
    if (this.board()[row][col].isRevealed) {
      this.chord(row, col);
    } else {
      this.toggleFlag(row, col);
    }
  }

  revealOrChord(row: number, col: number): void {
    if (this.board()[row][col].isRevealed) {
      this.chord(row, col);
    } else {
      this.reveal(row, col);
    }
  }

  reveal(row: number, col: number): void {
    if (this.isOver() || this.board()[row][col].isFlagged) return;

    if (this.status() === 'ready') {
      this.board.set(placeMines(this.board(), this.config().mines, row, col, this.random));
      this.status.set('playing');
      this.startTimer();
    }
    this.applyMove(revealCell(this.board(), row, col));
  }

  toggleFlag(row: number, col: number): void {
    if (this.isOver()) return;
    this.board.set(toggleFlag(this.board(), row, col));
  }

  chord(row: number, col: number): void {
    if (this.status() !== 'playing') return;
    this.applyMove(chordCell(this.board(), row, col));
  }

  private applyMove(next: Grid): void {
    this.board.set(next);
    if (isLost(next)) {
      this.endGame('lost');
    } else if (isWon(next)) {
      this.board.set(flagAllMines(next));
      this.endGame('won');
    }
  }

  private endGame(result: 'won' | 'lost'): void {
    this.updateElapsed();
    this.stopTimer();
    this.status.set(result);

    const difficulty = this.difficulty();
    if (result === 'won' && difficulty !== 'custom') {
      this.isNewBest.set(this.bestTimes.record(difficulty, this.elapsedSeconds()));
    }
  }

  private startTimer(): void {
    this.startedAt = Date.now();
    this.timerId = setInterval(() => this.updateElapsed(), 250);
  }

  private stopTimer(): void {
    clearInterval(this.timerId);
    this.timerId = undefined;
  }

  private updateElapsed(): void {
    this.elapsedSeconds.set(Math.floor((Date.now() - this.startedAt) / 1000));
  }
}
