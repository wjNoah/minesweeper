import { signal } from '@angular/core';
import { BotSkill } from '../models/bot.model';
import { PRESETS } from '../models/game.model';
import { COUNTDOWN_SECONDS, Finish, MatchMessage, MatchRules } from '../models/match.model';
import { gridWithMines, RandomFn, revealCell } from './board-logic';
import { applyBotMove, botMoveDelay, BotState, chooseBotMove, revealedSafeCells } from './bot';
import { ConnectionState, Role } from './connection.service';
import { MatchTransport } from './match-transport';

type StartMessage = Extract<MatchMessage, { type: 'start' }>;

/**
 * The computer as a 1v1 opponent. It receives the same messages as a person's device
 * would, plays its own copy of the board in real time, and answers with progress and
 * finished messages. So countdown, progress bars, results and rematches all work
 * exactly like a match against a person.
 */
export class BotOpponent implements MatchTransport {
  readonly state = signal<ConnectionState>('connected');
  /** The person always hosts: they choose the rules and start the rounds. */
  readonly role = signal<Role | null>('host');

  private readonly listeners = new Set<(message: MatchMessage) => void>();
  private round = 0;
  private rules: MatchRules | null = null;
  private bot: BotState | null = null;
  private done = false;
  /** Wall-clock time when the race starts (after the countdown). */
  private startedAt = 0;
  private moveTimer: ReturnType<typeof setTimeout> | undefined;
  private watchTimer: ReturnType<typeof setInterval> | undefined;

  /** skill is read again for every move, so a changed level applies from the next round. */
  constructor(
    private readonly skill: () => BotSkill,
    private readonly random: RandomFn = Math.random,
  ) {}

  send(message: MatchMessage): void {
    switch (message.type) {
      case 'start':
        this.startRound(message);
        break;
      case 'finished':
        if (message.round === this.round) this.onPersonFinished(message.finish);
        break;
      case 'leave':
        this.close();
        break;
    }
  }

  onMessage(listener: (message: MatchMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.stopTimers();
    this.state.set('idle');
  }

  private startRound(message: StartMessage): void {
    this.stopTimers();
    const preset = PRESETS.find((p) => p.id === message.rules.preset) ?? PRESETS[0];
    const minefield = gridWithMines(preset.rows, preset.cols, message.mines);
    this.round = message.round;
    this.rules = message.rules;
    this.done = false;
    this.bot = {
      board: revealCell(minefield, message.start.row, message.start.col),
      minesHit: 0,
      result: null,
    };
    this.startedAt = Date.now() + COUNTDOWN_SECONDS * 1000;
    // Like a person, the bot first takes a moment to look at the board.
    const firstLook = this.skill().moveMs * (1 + this.random());
    this.moveTimer = setTimeout(() => this.step(), COUNTDOWN_SECONDS * 1000 + firstLook);
  }

  private step(): void {
    if (!this.bot || !this.rules || this.done) return;
    const skill = this.skill();
    const move = chooseBotMove(this.bot.board, skill, this.random);
    this.bot = applyBotMove(this.bot, move, this.rules.mineRule);
    this.emit({
      type: 'progress',
      round: this.round,
      revealed: revealedSafeCells(this.bot.board),
      minesHit: this.bot.minesHit,
    });

    if (this.bot.result) {
      this.finish(this.bot.result);
    } else {
      this.moveTimer = setTimeout(() => this.step(), botMoveDelay(move, skill, this.random));
    }
  }

  private onPersonFinished(finish: Finish): void {
    if (this.done || !this.rules) return;
    if (this.rules.mineRule === 'defeat') {
      // Defeat rule: the round is decided as soon as the person finishes, either way.
      this.finish('stopped');
    } else if (finish.kind === 'cleared') {
      // Time penalty: like a person, the bot plays on until its time passes theirs.
      this.watchTimer = setInterval(() => {
        if (this.totalMs() > finish.totalMs) this.finish('stopped');
      }, 200);
    }
  }

  private finish(kind: Finish['kind']): void {
    this.stopTimers();
    this.done = true;
    this.emit({ type: 'finished', round: this.round, finish: { kind, totalMs: this.totalMs() } });
  }

  /** Time since the race started, plus penalties: the same as a person's total. */
  private totalMs(): number {
    const penalty = this.rules?.mineRule === 'penalty' ? this.rules.penaltySeconds * 1000 : 0;
    return Math.max(0, Date.now() - this.startedAt) + (this.bot?.minesHit ?? 0) * penalty;
  }

  /** Delivered a moment later, like a message from another device, never in the middle of a call. */
  private emit(message: MatchMessage): void {
    queueMicrotask(() => this.listeners.forEach((listener) => listener(message)));
  }

  private stopTimers(): void {
    clearTimeout(this.moveTimer);
    clearInterval(this.watchTimer);
  }
}
