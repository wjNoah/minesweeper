import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatchMessage, MatchRules } from '../models/match.model';
import { gridWithMines } from './board-logic';
import { ConnectionService, ConnectionState, Role } from './connection.service';
import { GameService } from './game.service';
import { MatchService } from './match.service';
import { QuestService } from './quest.service';
import { isSolvableWithoutGuessing } from './solver';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

const RULES: MatchRules = {
  preset: 'beginner',
  noGuess: false,
  mineRule: 'defeat',
  penaltySeconds: 10,
};

/**
 * Mines at the even cells of the top and bottom rows. From the middle, the opening reveals 63
 * of the 71 safe cells; the 8 cells between the mines stay hidden, so moves change the count.
 */
const POCKET_MINES = [0, 2, 4, 6, 8, 72, 74, 76, 78, 80];
const POCKET_CELLS = [1, 3, 5, 7].flatMap((col) => [
  { row: 0, col },
  { row: 8, col },
]);

/** Stands in for the connection to the other player: records what is sent, lets tests deliver messages. */
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
    match.random = seededRandom(11);
    game = TestBed.inject(GameService);
    TestBed.tick();
  }

  /** A guest receives a round on the board with hidden pockets, and the countdown ends. */
  function startPocketRound(rules: Partial<MatchRules> = {}, round = 1): void {
    connection.deliver({
      type: 'start',
      round,
      rules: { ...RULES, ...rules },
      mines: POCKET_MINES,
      start: { row: 4, col: 4 },
    });
    vi.advanceTimersByTime(3000);
    TestBed.tick();
  }

  function play(row: number, col: number): void {
    game.reveal(row, col);
    TestBed.tick();
  }

  const lastProgress = () => sentOfType('progress').at(-1);

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

  it('the host plays exactly the board it sent, from the same opening', () => {
    setUp('host');
    match.startRound();
    const { mines, start } = sentOfType('start')[0];
    vi.advanceTimersByTime(3000);

    const myMines = game
      .board()
      .flat()
      .filter((c) => c.hasMine)
      .map((c) => c.row * 9 + c.col);
    expect(myMines).toEqual([...mines].sort((a, b) => a - b));
    expect(game.board()[start.row][start.col].isRevealed).toBe(true);
    expect(game.board()[start.row][start.col].hasMine).toBe(false);
  });

  it('with no guessing on, every board can be solved by logic alone', () => {
    setUp('host');
    match.setRules({ preset: 'expert', noGuess: true });
    // Several rounds, because some random Expert boards happen to be solvable anyway.
    for (let round = 1; round <= 8; round++) {
      match.startRound();
      const { mines, start } = sentOfType('start')[round - 1];
      expect(isSolvableWithoutGuessing(gridWithMines(16, 30, mines), start.row, start.col)).toBe(
        true,
      );
      vi.advanceTimersByTime(3000);
      connection.deliver({ type: 'finished', round, finish: { kind: 'cleared', totalMs: 1 } });
    }
  });

  it('the guest takes over the rules the host chooses in the lobby', () => {
    setUp('guest');
    connection.deliver({ type: 'rules', rules: { ...RULES, preset: 'expert' } });
    expect(match.rules().preset).toBe('expert');
  });

  it('the host does not take orders from the guest', () => {
    setUp('host');
    connection.deliver({ type: 'rules', rules: { ...RULES, preset: 'expert' } });
    expect(match.rules().preset).toBe('beginner');

    connection.deliver({
      type: 'start',
      round: 1,
      rules: RULES,
      mines: POCKET_MINES,
      start: { row: 4, col: 4 },
    });
    expect(match.phase()).toBe('lobby');
  });

  it('a guest ignores a rematch message, only the host can start a round', () => {
    setUp('guest');
    connection.deliver({ type: 'rematch' });
    expect(match.phase()).toBe('lobby');
    expect(sentOfType('start')).toEqual([]);
    expect(sentOfType('rematch')).toEqual([]);
  });

  it('shows the opponent’s progress for this round, not for an older one', () => {
    setUp('guest');
    startPocketRound({}, 2);

    connection.deliver({ type: 'progress', round: 1, revealed: 50, minesHit: 3 });
    expect(match.opponent()).toEqual({ revealed: 0, minesHit: 0 });

    connection.deliver({ type: 'progress', round: 2, revealed: 40, minesHit: 1 });
    expect(match.opponent()).toEqual({ revealed: 40, minesHit: 1 });
  });

  it('ignores a finish message from an older round', () => {
    setUp('guest');
    startPocketRound({}, 2);
    connection.deliver({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 1000 } });
    expect(match.opponentFinish()).toBeNull();
    expect(match.phase()).toBe('playing');
  });

  it('reports my win to the opponent, with the last progress first and my time', () => {
    setUp('guest');
    startPocketRound();
    vi.advanceTimersByTime(4000);
    for (const { row, col } of POCKET_CELLS) play(row, col);

    expect(lastProgress()?.revealed).toBe(71);
    expect(connection.sent.at(-1)).toEqual({
      type: 'finished',
      round: 1,
      finish: { kind: 'cleared', totalMs: 4000 },
    });
    expect(match.outcome()).toBe('won');
    expect(match.phase()).toBe('finished');
  });

  it('reports my explosion to the opponent, and I have lost', () => {
    setUp('guest');
    startPocketRound();
    play(0, 0);

    expect(sentOfType('finished')[0].finish.kind).toBe('exploded');
    expect(match.outcome()).toBe('lost');
  });

  it('a rematch request after a round starts a fresh round for the host', () => {
    setUp('host');
    match.startRound();
    vi.advanceTimersByTime(3000);
    connection.deliver({ type: 'progress', round: 1, revealed: 30, minesHit: 2 });
    connection.deliver({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 1000 } });
    expect(match.phase()).toBe('finished');

    connection.deliver({ type: 'rematch' });
    expect(sentOfType('start').map((m) => m.round)).toEqual([1, 2]);
    expect(match.phase()).toBe('countdown');
    expect(match.myFinish()).toBeNull();
    expect(match.opponentFinish()).toBeNull();
    expect(match.opponent()).toEqual({ revealed: 0, minesHit: 0 });
    expect(match.outcome()).toBe('pending');
  });

  it('the guest stops waiting for the rematch when the new round starts', () => {
    setUp('guest');
    startPocketRound();
    connection.deliver({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 1000 } });
    match.startRound();
    expect(match.rematchRequested()).toBe(true);

    startPocketRound({}, 2);
    expect(match.rematchRequested()).toBe(false);
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

    vi.advanceTimersByTime(4500);
    expect(match.outcome()).toBe('pending'); // I can still beat 5 seconds.

    vi.advanceTimersByTime(1000);
    expect(match.outcome()).toBe('lost');
    expect(sentOfType('finished')[0].finish.kind).toBe('stopped');
  });

  it('sends progress at most twice a second, and the newest state always arrives', () => {
    setUp('guest');
    startPocketRound();
    const before = sentOfType('progress').length;
    expect(lastProgress()?.revealed).toBe(63);

    // Three quick moves within a quarter of a second.
    for (const { row, col } of POCKET_CELLS.slice(0, 3)) {
      play(row, col);
      vi.advanceTimersByTime(50);
    }
    expect(sentOfType('progress').length).toBe(before);

    vi.advanceTimersByTime(500);
    expect(sentOfType('progress').length).toBe(before + 1);
    expect(lastProgress()?.revealed).toBe(66);
  });

  it('the last progress does not wait: the round is over right away', () => {
    setUp('guest');
    startPocketRound();
    for (const { row, col } of POCKET_CELLS) play(row, col); // No time passes.
    expect(lastProgress()?.revealed).toBe(71);
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

  it('ends the match when the connection fails', () => {
    setUp('host');
    match.startRound();
    vi.advanceTimersByTime(3000);
    connection.state.set('failed');
    TestBed.tick();
    expect(game.mode()).toBe('solo');
    expect(match.notice()).toContain('connection was lost');
  });

  it('leaving closes the connection and ends the round', () => {
    setUp('host');
    match.startRound();
    match.leave();
    expect(connection.state()).toBe('idle');
    expect(game.mode()).toBe('solo');
    expect(match.phase()).toBe('lobby');
  });

  it('a stopped countdown does not start a round later', () => {
    setUp('host');
    match.startRound();
    match.leave();
    vi.advanceTimersByTime(5000);
    expect(game.status()).toBe('ready');
    expect(match.phase()).toBe('lobby');
  });

  describe('quests', () => {
    const done = (id: string) =>
      TestBed.inject(QuestService)
        .list()
        .find((entry) => entry.quest.id === id)?.completedAt !== null;

    it('a win against a friend counts once both results are in', () => {
      setUp('guest');
      startPocketRound();
      for (const { row, col } of POCKET_CELLS) play(row, col);
      expect(match.outcome()).toBe('won');
      expect(done('beat-friend')).toBe(false); // The opponent's result is still on its way.

      connection.deliver({ type: 'finished', round: 1, finish: { kind: 'stopped', totalMs: 9 } });
      expect(done('beat-friend')).toBe(true);
      expect(done('beat-bot')).toBe(false);
    });

    it('an early "win" that turns into a loss does not count', () => {
      setUp('guest');
      startPocketRound();
      vi.advanceTimersByTime(5000);
      for (const { row, col } of POCKET_CELLS) play(row, col);
      // The opponent cleared at the same moment, in a faster time.
      connection.deliver({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 10 } });
      expect(match.outcome()).toBe('lost');
      expect(done('beat-friend')).toBe(false);
    });

    it('a lost match does not count', () => {
      setUp('guest');
      startPocketRound();
      connection.deliver({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 10 } });
      expect(match.outcome()).toBe('lost');
      expect(done('beat-friend')).toBe(false);
    });

    it('beating the Hard bot completes both bot quests', async () => {
      setUp('host');
      match.playBot();
      match.setBotLevel('hard');
      TestBed.tick();
      match.startRound();
      await vi.advanceTimersByTimeAsync(3000);

      // Clear the board before the bot makes its first move.
      for (const cell of game.board().flat()) {
        if (!cell.hasMine) play(cell.row, cell.col);
      }
      await vi.advanceTimersByTimeAsync(0);

      expect(match.outcome()).toBe('won');
      expect(done('beat-bot')).toBe(true);
      expect(done('beat-hard-bot')).toBe(true);
      expect(done('beat-friend')).toBe(false);
    });
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

    it('forgets an old connection error, so it does not come back after the bot match', () => {
      setUp('host');
      connection.state.set('failed');
      TestBed.tick();
      match.playBot();
      expect(connection.state()).toBe('idle');
    });

    it('the strength can change between rounds, but not during one', () => {
      setUp('host');
      match.playBot();
      TestBed.tick();
      match.setBotLevel('easy');
      expect(match.botLevel()).toBe('easy');

      match.startRound();
      match.setBotLevel('hard');
      expect(match.botLevel()).toBe('easy');
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
