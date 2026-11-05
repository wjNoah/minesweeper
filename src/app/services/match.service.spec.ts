import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatchMessage } from '../models/match.model';
import { ConnectionService, ConnectionState, Role } from './connection.service';
import { GameService } from './game.service';
import { MatchService } from './match.service';

/** Stands in for the WebRTC connection: records what is sent, lets tests deliver messages. */
class FakeConnection {
  readonly state = signal<ConnectionState>('connected');
  readonly role = signal<Role | null>('host');
  readonly sent: MatchMessage[] = [];
  private listener: ((message: MatchMessage) => void) | null = null;

  send(message: MatchMessage): void {
    this.sent.push(message);
  }
  onMessage(listener: (message: MatchMessage) => void): () => void {
    this.listener = listener;
    return () => (this.listener = null);
  }
  deliver(message: MatchMessage): void {
    this.listener?.(message);
  }
  close(): void {
    this.state.set('idle');
  }
}

describe('MatchService', () => {
  let connection: FakeConnection;
  let match: MatchService;
  let game: GameService;

  function setUp(role: Role): void {
    connection = new FakeConnection();
    connection.role.set(role);
    TestBed.configureTestingModule({
      providers: [{ provide: ConnectionService, useValue: connection }],
    });
    match = TestBed.inject(MatchService);
    game = TestBed.inject(GameService);
    TestBed.tick();
  }

  function sentOfType<T extends MatchMessage['type']>(type: T) {
    return connection.sent.filter((m): m is Extract<MatchMessage, { type: T }> => m.type === type);
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('host sends the rules when connected and the exact mines when starting', () => {
    setUp('host');
    expect(sentOfType('rules').length).toBe(1);

    match.setRules({ preset: 'intermediate', mineRule: 'penalty' });
    match.startRound();
    const start = sentOfType('start')[0];
    expect(start.mines.length).toBe(40);
    expect(start.rules.mineRule).toBe('penalty');
    expect(match.phase()).toBe('countdown');
  });

  it('guest builds the same board from the host message after the countdown', () => {
    setUp('guest');
    const mines = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    connection.deliver({
      type: 'start',
      round: 1,
      rules: { preset: 'beginner', noGuess: false, mineRule: 'defeat', penaltySeconds: 10 },
      mines,
      start: { row: 8, col: 8 },
    });
    expect(game.inputLocked()).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(match.phase()).toBe('playing');
    const boardMines = game
      .board()
      .flat()
      .filter((c) => c.hasMine)
      .map((c) => c.row * 9 + c.col);
    expect(boardMines).toEqual(mines);
    expect(game.board()[8][8].isRevealed).toBe(true);
  });

  it('with the defeat rule, I lose and stop when the opponent clears first', () => {
    setUp('host');
    match.startRound();
    vi.advanceTimersByTime(3000);

    connection.deliver({
      type: 'finished',
      round: 1,
      finish: { kind: 'cleared', totalMs: 20_000 },
    });

    expect(match.outcome()).toBe('lost');
    expect(match.phase()).toBe('finished');
    expect(game.status()).toBe('stopped');
    expect(sentOfType('finished')[0].finish.kind).toBe('stopped');
  });

  it('with the penalty rule, I lose once my time passes the finished opponent', () => {
    setUp('host');
    match.setRules({ mineRule: 'penalty' });
    match.startRound();
    vi.advanceTimersByTime(3000);

    connection.deliver({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 5_000 } });
    expect(match.outcome()).toBe('pending');

    vi.advanceTimersByTime(6000);
    expect(match.outcome()).toBe('lost');
  });

  it('sends progress at most twice a second, and the last update always arrives', () => {
    setUp('guest');
    connection.deliver({
      type: 'start',
      round: 1,
      rules: { preset: 'beginner', noGuess: false, mineRule: 'defeat', penaltySeconds: 10 },
      mines: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      start: { row: 8, col: 8 },
    });
    vi.advanceTimersByTime(3000);
    TestBed.tick();
    const before = sentOfType('progress').length;

    // Five quick moves within a quarter of a second.
    for (let col = 0; col < 5; col++) {
      game.toggleFlag(0, col);
      TestBed.tick();
      vi.advanceTimersByTime(50);
    }
    expect(sentOfType('progress').length).toBe(before);

    vi.advanceTimersByTime(500);
    expect(sentOfType('progress').length).toBe(before + 1);
  });

  describe('while a round is running', () => {
    it('the host cannot restart it (for example from the open 1v1 dialog)', () => {
      setUp('host');
      match.startRound();
      match.startRound();
      expect(sentOfType('start').length).toBe(1);

      vi.advanceTimersByTime(3000);
      match.startRound();
      expect(sentOfType('start').length).toBe(1);
      expect(match.phase()).toBe('playing');
    });

    it('the host cannot change the rules, so both devices decide the winner the same way', () => {
      setUp('host');
      match.startRound();
      vi.advanceTimersByTime(3000);
      match.setRules({ mineRule: 'penalty' });
      expect(match.rules().mineRule).toBe('defeat');
    });

    it('the guest ignores rule changes', () => {
      setUp('guest');
      connection.deliver({
        type: 'start',
        round: 1,
        rules: { preset: 'beginner', noGuess: false, mineRule: 'defeat', penaltySeconds: 10 },
        mines: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        start: { row: 8, col: 8 },
      });
      connection.deliver({
        type: 'rules',
        rules: { preset: 'expert', noGuess: false, mineRule: 'penalty', penaltySeconds: 30 },
      });
      expect(match.rules().mineRule).toBe('defeat');
    });

    it('a rematch request from the guest does not restart it', () => {
      setUp('host');
      match.startRound();
      connection.deliver({ type: 'rematch' });
      expect(sentOfType('start').length).toBe(1);
    });
  });

  it('guest asks for a rematch instead of starting', () => {
    setUp('guest');
    match.startRound();
    expect(sentOfType('rematch').length).toBe(1);
    expect(match.rematchRequested()).toBe(true);
  });

  it('ends the match when the connection closes', () => {
    setUp('host');
    match.startRound();
    vi.advanceTimersByTime(3000);
    connection.state.set('closed');
    TestBed.tick();
    expect(game.mode()).toBe('solo');
    expect(match.notice()).toContain('opponent left');
  });

  describe('against the bot', () => {
    it('plays a whole round: the bot clears the board while the person waits', async () => {
      setUp('host');
      const sentBefore = connection.sent.length;
      match.playBot();
      match.setBotLevel('hard');
      TestBed.tick();
      expect(match.isBot()).toBe(true);
      expect(match.isHost()).toBe(true);

      match.startRound();
      expect(match.phase()).toBe('countdown');
      await vi.advanceTimersByTimeAsync(3000);
      expect(match.phase()).toBe('playing');

      await vi.advanceTimersByTimeAsync(180_000);
      expect(match.opponentFinish()?.kind).toBe('cleared');
      expect(match.outcome()).toBe('lost');
      expect(match.phase()).toBe('finished');
      // Nothing went over the network once the bot was chosen.
      expect(connection.sent.length).toBe(sentBefore);
    });

    it('leaving the bot returns to normal play and to network matches', () => {
      setUp('host');
      match.playBot();
      TestBed.tick();
      match.leave();
      expect(match.isBot()).toBe(false);
      expect(game.mode()).toBe('solo');
    });
  });
});
