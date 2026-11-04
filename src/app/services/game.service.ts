import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { MineRule, Position } from '../models/match.model';
import {
  DifficultyId,
  GameConfig,
  GameStatus,
  normalizeConfig,
  PRESETS,
} from '../models/game.model';
import { BestTimeKey, BestTimesService } from './best-times.service';
import { SettingsService } from './settings.service';
import {
  chordCell,
  countFlags,
  coverHitMines,
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
import { findHint, generateNoGuessBoard, Hint } from './solver';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly bestTimes = inject(BestTimesService);
  private readonly settings = inject(SettingsService);

  readonly difficulty = signal<DifficultyId>('beginner');
  readonly config = signal<GameConfig>(PRESETS[0]);
  readonly board = signal<Grid>(createEmptyBoard(PRESETS[0].rows, PRESETS[0].cols));
  readonly status = signal<GameStatus>('ready');
  /** When on, a normal click places or removes flags instead of revealing. */
  readonly flagMode = signal(false);
  readonly elapsedSeconds = signal(0);
  readonly isNewBest = signal(false);
  /** Whether the current board was checked to be solvable without guessing. */
  private readonly noGuessBoard = signal(false);
  /** True when no-guess mode was on but no solvable board was found in time. */
  readonly noGuessFallback = signal(false);
  /** The current hint, shown until the next move. */
  readonly hint = signal<Hint | null>(null);
  /** True right after asking for a hint when no move could be proven. */
  readonly noHintAvailable = signal(false);
  /** Games won with hints don't count for best times. */
  readonly hintsUsed = signal(0);

  /** 'match' while a 1v1 round is set up or played. The match rules replace the settings. */
  readonly mode = signal<'solo' | 'match'>('solo');
  /** Blocks clicks, for example during the 1v1 countdown. */
  readonly inputLocked = signal(false);
  readonly mineRule = signal<MineRule>('defeat');
  readonly penaltySeconds = signal(0);
  readonly minesHit = signal(0);
  /** Shown time: elapsed time plus penalties. */
  readonly displaySeconds = computed(
    () => this.elapsedSeconds() + this.minesHit() * this.penaltySeconds(),
  );

  /** Before the first click this follows the setting; after it, the actual board. */
  readonly isNoGuess = computed(() =>
    this.status() === 'ready' ? this.settings.settings().noGuess : this.noGuessBoard(),
  );

  /** Which best-time record this game counts for. Custom boards have none. */
  readonly bestTimeKey = computed((): BestTimeKey | null => {
    const difficulty = this.difficulty();
    if (difficulty === 'custom') return null;
    return this.isNoGuess() ? `${difficulty}-ng` : difficulty;
  });

  readonly minesLeft = computed(() => this.config().mines - countFlags(this.board()));
  readonly isOver = computed(() => ['won', 'lost', 'stopped'].includes(this.status()));

  /** Replaceable in tests to get a predictable board. */
  random: RandomFn = Math.random;

  private timerId: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;
  private finalMs = 0;

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
    this.noGuessBoard.set(false);
    this.noGuessFallback.set(false);
    this.clearHint();
    this.hintsUsed.set(0);
    this.minesHit.set(0);
    this.finalMs = 0;
  }

  /** 1v1: show an empty board of the right size and block input until the countdown ends. */
  prepareMatch(difficulty: DifficultyId, rule: MineRule, penaltySeconds: number): void {
    this.mode.set('match');
    this.setDifficulty(difficulty);
    this.mineRule.set(rule);
    this.penaltySeconds.set(rule === 'penalty' ? penaltySeconds : 0);
    this.inputLocked.set(true);
  }

  /** 1v1: start the round on the board both players share, with the same opening. */
  startMatchRound(minefield: Grid, start: Position): void {
    this.board.set(revealCell(minefield, start.row, start.col));
    this.status.set('playing');
    this.inputLocked.set(false);
    this.startTimer();
  }

  /** 1v1: end the round early because the result is already decided. */
  stopMatchRound(): void {
    if (this.status() !== 'playing') return;
    this.updateElapsed();
    this.stopTimer();
    this.status.set('stopped');
  }

  leaveMatch(): void {
    this.mode.set('solo');
    this.inputLocked.set(false);
    this.mineRule.set('defeat');
    this.penaltySeconds.set(0);
    this.newGame();
  }

  /** Exact time including penalties, in milliseconds, for comparing 1v1 results. */
  totalMs(): number {
    const elapsed = this.status() === 'playing' ? Date.now() - this.startedAt : this.finalMs;
    return elapsed + this.minesHit() * this.penaltySeconds() * 1000;
  }

  setDifficulty(id: DifficultyId, custom?: GameConfig): void {
    const preset = PRESETS.find((p) => p.id === id);
    const config = preset ?? normalizeConfig(custom ?? this.config());
    this.difficulty.set(id);
    this.config.set({ rows: config.rows, cols: config.cols, mines: config.mines });
    this.newGame();
  }

  setFlagMode(on: boolean): void {
    this.flagMode.set(on);
  }

  /** Normal click or tap. */
  primaryAction(row: number, col: number): void {
    if (this.flagMode()) {
      this.secondaryAction(row, col);
    } else if (!this.board()[row][col].isRevealed) {
      this.reveal(row, col);
    } else if (this.settings.settings().chordOnClick) {
      this.chord(row, col);
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
    if (this.inputLocked() || this.isOver() || this.board()[row][col].isFlagged) return;

    if (this.status() === 'ready') {
      this.board.set(this.createMinefield(row, col));
      this.status.set('playing');
      this.startTimer();
    }
    this.applyMove(revealCell(this.board(), row, col));
  }

  toggleFlag(row: number, col: number): void {
    if (this.inputLocked() || this.isOver()) return;
    this.clearHint();
    this.board.set(toggleFlag(this.board(), row, col));
  }

  /** Points out one move that logic proves is right. Only works once the game has started. */
  showHint(): void {
    if (this.status() !== 'playing' || this.mode() === 'match') return;
    const hint = findHint(this.board());
    this.hint.set(hint);
    this.noHintAvailable.set(hint === null);
    if (hint) this.hintsUsed.update((count) => count + 1);
  }

  chord(row: number, col: number): void {
    if (this.inputLocked() || this.status() !== 'playing') return;
    this.applyMove(chordCell(this.board(), row, col));
  }

  /** Places the mines around the first click, solvable without guessing if that mode is on. */
  private createMinefield(row: number, col: number): Grid {
    const { safeArea, noGuess } = this.settings.settings();
    const { mines } = this.config();
    if (!noGuess) {
      return placeMines(this.board(), mines, row, col, this.random, safeArea);
    }
    // No-guess boards always start with an opening, otherwise the first move is already a guess.
    const generated = generateNoGuessBoard(this.board(), mines, row, col, this.random);
    this.noGuessBoard.set(generated.noGuess);
    this.noGuessFallback.set(!generated.noGuess);
    return generated.grid;
  }

  private clearHint(): void {
    this.hint.set(null);
    this.noHintAvailable.set(false);
  }

  private applyMove(next: Grid): void {
    if (next !== this.board()) this.clearHint();
    if (this.mineRule() === 'penalty' && isLost(next)) {
      const covered = coverHitMines(next);
      next = covered.grid;
      this.minesHit.update((count) => count + covered.hit);
    }
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

    const key = this.bestTimeKey();
    if (result === 'won' && key && this.hintsUsed() === 0 && this.mode() === 'solo') {
      this.isNewBest.set(this.bestTimes.record(key, this.elapsedSeconds()));
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
    this.finalMs = Date.now() - this.startedAt;
    this.elapsedSeconds.set(Math.floor(this.finalMs / 1000));
  }
}
