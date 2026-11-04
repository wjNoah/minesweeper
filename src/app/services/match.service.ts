import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { PRESETS } from '../models/game.model';
import {
  decideOutcome,
  DEFAULT_RULES,
  Finish,
  MatchMessage,
  MatchRules,
  Position,
} from '../models/match.model';
import { computeAdjacentCounts, createEmptyBoard, Grid, placeMines, RandomFn } from './board-logic';
import { ConnectionService } from './connection.service';
import { GameService } from './game.service';
import { generateNoGuessBoard } from './solver';

/** lobby: connected, choosing rules. countdown → playing → finished, then a rematch goes back to countdown. */
export type MatchPhase = 'lobby' | 'countdown' | 'playing' | 'finished';

export interface OpponentProgress {
  revealed: number;
  minesHit: number;
}

const COUNTDOWN_SECONDS = 3;

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly connection = inject(ConnectionService);
  private readonly game = inject(GameService);

  readonly phase = signal<MatchPhase>('lobby');
  readonly rules = signal<MatchRules>(DEFAULT_RULES);
  readonly countdown = signal(0);
  readonly opponent = signal<OpponentProgress>({ revealed: 0, minesHit: 0 });
  readonly myFinish = signal<Finish | null>(null);
  readonly opponentFinish = signal<Finish | null>(null);
  /** The guest asked for a rematch and is waiting for the host. */
  readonly rematchRequested = signal(false);
  /** Shown after the match ended unexpectedly, for example when the opponent left. */
  readonly notice = signal('');

  readonly isHost = computed(() => this.connection.role() === 'host');
  readonly isConnected = computed(() => this.connection.state() === 'connected');
  readonly outcome = computed(() =>
    decideOutcome(this.myFinish(), this.opponentFinish(), this.rules().mineRule),
  );
  readonly safeCells = computed(() => {
    const { rows, cols, mines } = this.game.config();
    return rows * cols - mines;
  });

  /** Replaceable in tests to get a predictable board. */
  random: RandomFn = Math.random;

  private round = 0;
  private countdownTimer: ReturnType<typeof setInterval> | undefined;
  private raceTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    const stopListening = this.connection.onMessage((message) => this.handle(message));
    inject(DestroyRef).onDestroy(() => {
      stopListening();
      this.stopTimers();
    });

    // When the connection opens, the host shares the current rules.
    effect(() => {
      if (this.isConnected() && untracked(this.isHost)) {
        this.connection.send({ type: 'rules', rules: untracked(this.rules) });
      }
    });

    // Losing the connection ends the match.
    effect(() => {
      const state = this.connection.state();
      if (state !== 'closed' && state !== 'failed') return;
      untracked(() => {
        if (this.game.mode() === 'match') {
          this.notice.set('The match ended: your opponent left or the connection was lost.');
        }
        this.endMatch();
      });
    });

    // While racing: tell the opponent about progress, and notice when my round ends.
    effect(() => {
      const board = this.game.board();
      const status = this.game.status();
      const minesHit = this.game.minesHit();
      if (untracked(this.phase) !== 'playing') return;

      const revealed = board.flat().filter((cell) => cell.isRevealed && !cell.hasMine).length;
      this.connection.send({ type: 'progress', round: this.round, revealed, minesHit });
      if (status === 'won') untracked(() => this.finishMine('cleared'));
      if (status === 'lost') untracked(() => this.finishMine('exploded'));
    });
  }

  /** Host only: change the rules for the next round. */
  setRules(changes: Partial<MatchRules>): void {
    if (!this.isHost()) return;
    this.rules.update((rules) => ({ ...rules, ...changes }));
    this.connection.send({ type: 'rules', rules: this.rules() });
  }

  /** Host: start a round. Guest: ask the host for one. */
  startRound(): void {
    if (!this.isConnected()) return;
    if (!this.isHost()) {
      this.rematchRequested.set(true);
      this.connection.send({ type: 'rematch' });
      return;
    }

    const rules = this.rules();
    const preset = PRESETS.find((p) => p.id === rules.preset) ?? PRESETS[0];
    // A random start cell, so nobody can learn a fixed opening.
    const start = {
      row: Math.floor(this.random() * preset.rows),
      col: Math.floor(this.random() * preset.cols),
    };
    const minefield = this.createMinefield(rules, start);
    const mines = minefield
      .flat()
      .filter((cell) => cell.hasMine)
      .map((cell) => cell.row * preset.cols + cell.col);

    this.notice.set('');
    this.round++;
    // Sending the mine positions (not a seed) guarantees both boards are identical.
    this.connection.send({ type: 'start', round: this.round, rules, mines, start });
    this.beginCountdown(rules, mines, start);
  }

  leave(): void {
    this.connection.close();
    this.endMatch();
  }

  dismissNotice(): void {
    this.notice.set('');
  }

  private handle(message: MatchMessage): void {
    switch (message.type) {
      case 'rules':
        if (!this.isHost()) this.rules.set(message.rules);
        break;
      case 'start':
        if (this.isHost()) return;
        this.notice.set('');
        this.round = message.round;
        this.rules.set(message.rules);
        this.beginCountdown(message.rules, message.mines, message.start);
        break;
      case 'progress':
        if (message.round === this.round) {
          this.opponent.set({ revealed: message.revealed, minesHit: message.minesHit });
        }
        break;
      case 'finished':
        if (message.round === this.round) {
          this.opponentFinish.set(message.finish);
          this.checkOutcome();
        }
        break;
      case 'rematch':
        if (this.isHost() && this.phase() !== 'countdown' && this.phase() !== 'playing') {
          this.startRound();
        }
        break;
    }
  }

  private createMinefield(rules: MatchRules, start: Position): Grid {
    const preset = PRESETS.find((p) => p.id === rules.preset) ?? PRESETS[0];
    const empty = createEmptyBoard(preset.rows, preset.cols);
    if (rules.noGuess) {
      return generateNoGuessBoard(empty, preset.mines, start.row, start.col, this.random).grid;
    }
    return placeMines(empty, preset.mines, start.row, start.col, this.random);
  }

  private beginCountdown(rules: MatchRules, mines: number[], start: Position): void {
    this.stopTimers();
    this.myFinish.set(null);
    this.opponentFinish.set(null);
    this.opponent.set({ revealed: 0, minesHit: 0 });
    this.rematchRequested.set(false);
    this.game.prepareMatch(rules.preset, rules.mineRule, rules.penaltySeconds);

    this.phase.set('countdown');
    this.countdown.set(COUNTDOWN_SECONDS);
    this.countdownTimer = setInterval(() => {
      this.countdown.update((n) => n - 1);
      if (this.countdown() > 0) return;
      clearInterval(this.countdownTimer);
      this.game.startMatchRound(this.minefieldFrom(rules, mines), start);
      this.phase.set('playing');
      this.raceTimer = setInterval(() => this.checkPenaltyTime(), 200);
    }, 1000);
  }

  private minefieldFrom(rules: MatchRules, mines: number[]): Grid {
    const preset = PRESETS.find((p) => p.id === rules.preset) ?? PRESETS[0];
    const mineSet = new Set(mines);
    const empty = createEmptyBoard(preset.rows, preset.cols);
    const withMines = empty.map((line) =>
      line.map((cell) => ({ ...cell, hasMine: mineSet.has(cell.row * preset.cols + cell.col) })),
    );
    return computeAdjacentCounts(withMines);
  }

  /** Penalty rule: once my time passes a finished opponent's, I can't win any more. */
  private checkPenaltyTime(): void {
    const opponent = this.opponentFinish();
    if (this.myFinish() || opponent?.kind !== 'cleared') return;
    if (this.game.totalMs() > opponent.totalMs) this.finishMine('stopped');
  }

  private finishMine(kind: Finish['kind']): void {
    if (this.myFinish()) return;
    this.game.stopMatchRound();
    const finish: Finish = { kind, totalMs: this.game.totalMs() };
    this.myFinish.set(finish);
    this.connection.send({ type: 'finished', round: this.round, finish });
    this.checkOutcome();
  }

  /** Ends the round as soon as the result is clear, even if one player is still playing. */
  private checkOutcome(): void {
    if (this.outcome() === 'pending') return;
    if (!this.myFinish()) this.finishMine('stopped');
    clearInterval(this.raceTimer);
    this.phase.set('finished');
  }

  private endMatch(): void {
    this.stopTimers();
    this.phase.set('lobby');
    this.myFinish.set(null);
    this.opponentFinish.set(null);
    this.rematchRequested.set(false);
    if (this.game.mode() === 'match') this.game.leaveMatch();
  }

  private stopTimers(): void {
    clearInterval(this.countdownTimer);
    clearInterval(this.raceTimer);
  }
}
