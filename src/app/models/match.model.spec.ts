import { decideOutcome, Finish, formatRaceTime, isMatchMessage } from './match.model';

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
        rules: { preset: 'expert', noGuess: true, mineRule: 'penalty', penaltySeconds: 10 },
        mines: [1, 2, 3],
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
