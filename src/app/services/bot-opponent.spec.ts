import { BOT_LEVELS } from '../models/bot.model';
import { MatchMessage, MatchRules } from '../models/match.model';
import { createEmptyBoard } from './board-logic';
import { BotOpponent } from './bot-opponent';
import { generateNoGuessBoard } from './solver';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

const rules = (changes: Partial<MatchRules> = {}): MatchRules => ({
  preset: 'beginner',
  noGuess: true,
  mineRule: 'defeat',
  penaltySeconds: 10,
  ...changes,
});

function startMessage(r: MatchRules): MatchMessage {
  const { grid } = generateNoGuessBoard(createEmptyBoard(9, 9), 10, 4, 4, seededRandom(11));
  const mines = grid
    .flat()
    .filter((c) => c.hasMine)
    .map((c) => c.row * 9 + c.col);
  return { type: 'start', round: 1, rules: r, mines, start: { row: 4, col: 4 } };
}

describe('BotOpponent', () => {
  let bot: BotOpponent;
  let received: MatchMessage[];
  const finishes = () => received.filter((m) => m.type === 'finished');

  beforeEach(() => {
    vi.useFakeTimers();
    bot = new BotOpponent(() => BOT_LEVELS.hard, seededRandom(3));
    received = [];
    bot.onMessage((m) => received.push(m));
  });

  afterEach(() => vi.useRealTimers());

  it('acts like a connected opponent where the person is the host', () => {
    expect(bot.state()).toBe('connected');
    expect(bot.role()).toBe('host');
  });

  it('waits for the countdown, then plays the round and reports its progress and time', async () => {
    bot.send(startMessage(rules()));
    await vi.advanceTimersByTimeAsync(2900);
    expect(received).toEqual([]);

    await vi.advanceTimersByTimeAsync(120_000);
    const progress = received.filter((m) => m.type === 'progress');
    expect(progress.length).toBeGreaterThan(3);
    const counts = progress.map((m) => (m.type === 'progress' ? m.revealed : 0));
    expect(counts).toEqual([...counts].sort((a, b) => a - b)); // only ever goes up

    const [finished] = finishes();
    expect(finished.type === 'finished' && finished.finish.kind).toBe('cleared');
    expect(finished.type === 'finished' && finished.finish.totalMs).toBeGreaterThan(1000);
  });

  it('with the defeat rule, stops as soon as the person finishes', async () => {
    bot.send(startMessage(rules()));
    await vi.advanceTimersByTimeAsync(4500);
    bot.send({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 1400 } });
    await vi.advanceTimersByTimeAsync(0);

    const [finished] = finishes();
    expect(finished.type === 'finished' && finished.finish.kind).toBe('stopped');
    const count = received.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(received.length).toBe(count);
  });

  it('with the penalty rule, plays on until its time passes the person’s', async () => {
    bot.send(startMessage(rules({ mineRule: 'penalty' })));
    await vi.advanceTimersByTimeAsync(3500);
    bot.send({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 2000 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(finishes()).toEqual([]); // its time (0.5 s) is still below 2 s

    await vi.advanceTimersByTimeAsync(2000);
    const [finished] = finishes();
    expect(finished.type === 'finished' && finished.finish.kind).toBe('stopped');
    expect(finished.type === 'finished' && finished.finish.totalMs).toBeGreaterThan(2000);
  });

  it('ignores messages about an older round and stops when closed', async () => {
    bot.send(startMessage(rules()));
    await vi.advanceTimersByTimeAsync(4000);
    bot.send({ type: 'finished', round: 99, finish: { kind: 'cleared', totalMs: 1 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(finishes()).toEqual([]);

    bot.close();
    expect(bot.state()).toBe('idle');
    const count = received.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(received.length).toBe(count);
  });
});
