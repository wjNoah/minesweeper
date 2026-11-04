import {
  decideOutcome,
  Finish,
  formatRaceTime,
  isMatchMessage,
  MAX_MESSAGE_CHARS,
  parseMatchMessage,
} from './match.model';

const cleared = (totalMs: number): Finish => ({ kind: 'cleared', totalMs });
const exploded: Finish = { kind: 'exploded', totalMs: 5000 };
const stopped: Finish = { kind: 'stopped', totalMs: 9000 };

describe('decideOutcome with the defeat rule', () => {
  it('is pending while both play', () => {
    expect(decideOutcome(null, null, 'defeat')).toBe('pending');
  });

  it('loses on a mine and wins when the opponent hits one', () => {
    expect(decideOutcome(exploded, null, 'defeat')).toBe('lost');
    expect(decideOutcome(null, exploded, 'defeat')).toBe('won');
    expect(decideOutcome(stopped, exploded, 'defeat')).toBe('won');
  });

  it('lets the first to clear win', () => {
    expect(decideOutcome(cleared(40_000), null, 'defeat')).toBe('won');
    expect(decideOutcome(stopped, cleared(40_000), 'defeat')).toBe('lost');
  });

  it('compares times when both cleared at almost the same moment', () => {
    expect(decideOutcome(cleared(40_000), cleared(41_000), 'defeat')).toBe('won');
    expect(decideOutcome(cleared(40_000), cleared(40_000), 'defeat')).toBe('draw');
  });
});

describe('decideOutcome with the penalty rule', () => {
  it('waits when I cleared but the opponent can still beat my time', () => {
    expect(decideOutcome(cleared(60_000), null, 'penalty')).toBe('pending');
  });

  it('lets the lowest total time win', () => {
    expect(decideOutcome(cleared(70_000), cleared(55_000), 'penalty')).toBe('lost');
  });

  it('decides when the slower player passes the finished time', () => {
    expect(decideOutcome(cleared(60_000), stopped, 'penalty')).toBe('won');
    expect(decideOutcome(stopped, cleared(60_000), 'penalty')).toBe('lost');
  });
});

describe('isMatchMessage', () => {
  it('accepts valid messages', () => {
    expect(isMatchMessage({ type: 'progress', round: 1, revealed: 10, minesHit: 0 })).toBe(true);
    expect(
      isMatchMessage({
        type: 'start',
        round: 2,
        rules: { preset: 'beginner', noGuess: true, mineRule: 'penalty', penaltySeconds: 10 },
        mines: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        start: { row: 4, col: 5 },
      }),
    ).toBe(true);
  });

  it('rejects broken or unknown messages', () => {
    expect(isMatchMessage(null)).toBe(false);
    expect(isMatchMessage({ type: 'cheat' })).toBe(false);
    expect(isMatchMessage({ type: 'progress', round: 1 })).toBe(false);
    expect(
      isMatchMessage({
        type: 'rules',
        rules: { preset: 'expert', noGuess: true, mineRule: 'penalty', penaltySeconds: 7 },
      }),
    ).toBe(false);
  });
});

describe('formatRaceTime', () => {
  it('shows minutes, seconds and tenths', () => {
    expect(formatRaceTime(83_456)).toBe('1:23.4');
    expect(formatRaceTime(5_000)).toBe('0:05.0');
  });
});

describe('isMatchMessage with an untrusted opponent', () => {
  const rules = { preset: 'beginner', noGuess: true, mineRule: 'defeat', penaltySeconds: 10 };
  const tenMines = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const start = (changes: Record<string, unknown>) => ({
    type: 'start',
    round: 1,
    rules,
    mines: tenMines,
    start: { row: 8, col: 8 },
    ...changes,
  });

  it('accepts a start message that fits the board', () => {
    expect(isMatchMessage(start({}))).toBe(true);
  });

  it('rejects a start cell outside the board, which would crash the game', () => {
    expect(isMatchMessage(start({ start: { row: 9, col: 0 } }))).toBe(false);
    expect(isMatchMessage(start({ start: { row: -1, col: 0 } }))).toBe(false);
    expect(isMatchMessage(start({ start: { row: 1.5, col: 0 } }))).toBe(false);
  });

  it('rejects mine positions that do not fit the rules', () => {
    expect(isMatchMessage(start({ mines: tenMines.slice(1) }))).toBe(false); // too few
    expect(isMatchMessage(start({ mines: [...tenMines.slice(1), 81] }))).toBe(false); // off the board
    expect(isMatchMessage(start({ mines: [0, 0, 2, 3, 4, 5, 6, 7, 8, 9] }))).toBe(false); // twice
    expect(isMatchMessage(start({ mines: [...tenMines.slice(1), -1] }))).toBe(false);
  });

  it('rejects an opening on a mine', () => {
    expect(isMatchMessage(start({ start: { row: 0, col: 3 } }))).toBe(false);
  });

  it('rejects negative, fractional or absurd numbers in progress and finish messages', () => {
    expect(isMatchMessage({ type: 'progress', round: 1, revealed: -1, minesHit: 0 })).toBe(false);
    expect(isMatchMessage({ type: 'progress', round: 1, revealed: 2.5, minesHit: 0 })).toBe(false);
    expect(isMatchMessage({ type: 'progress', round: 1, revealed: 1e9, minesHit: 0 })).toBe(false);
    const finished = (totalMs: number) => ({
      type: 'finished',
      round: 1,
      finish: { kind: 'cleared', totalMs },
    });
    expect(isMatchMessage(finished(-5))).toBe(false);
    expect(isMatchMessage(finished(1e12))).toBe(false);
    expect(isMatchMessage(finished(41_200))).toBe(true);
  });
});

describe('parseMatchMessage', () => {
  it('parses a valid message', () => {
    expect(parseMatchMessage('{"type":"rematch"}')).toEqual({ type: 'rematch' });
  });

  it('drops oversized, non-text, broken and unknown data', () => {
    expect(parseMatchMessage('x'.repeat(MAX_MESSAGE_CHARS + 1))).toBeNull();
    expect(parseMatchMessage(new ArrayBuffer(8))).toBeNull();
    expect(parseMatchMessage('{not json')).toBeNull();
    expect(parseMatchMessage('{"type":"delete-everything"}')).toBeNull();
    expect(parseMatchMessage('null')).toBeNull();
  });
});
