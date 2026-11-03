import { PresetId } from './game.model';

export type MineRule = 'defeat' | 'penalty';
export type PenaltySeconds = 5 | 10 | 20 | 30;

export interface MatchRules {
  preset: PresetId;
  noGuess: boolean;
  /** Defeat: a mine ends your game. Penalty: the mine is flagged and seconds are added. */
  mineRule: MineRule;
  penaltySeconds: PenaltySeconds;
}

export const DEFAULT_RULES: MatchRules = {
  preset: 'beginner',
  noGuess: true,
  mineRule: 'defeat',
  penaltySeconds: 10,
};

export const PENALTY_OPTIONS: readonly PenaltySeconds[] = [5, 10, 20, 30];

export interface Position {
  row: number;
  col: number;
}

/**
 * How a player's round ended. 'stopped' means the result was already decided
 * (for example the opponent cleared first), so the game was ended early.
 */
export type FinishKind = 'cleared' | 'exploded' | 'stopped';

export interface Finish {
  kind: FinishKind;
  /** Time including penalties, in milliseconds. */
  totalMs: number;
}

export type Outcome = 'pending' | 'won' | 'lost' | 'draw';

/** Everything the two players send each other. */
export type MatchMessage =
  | { type: 'rules'; rules: MatchRules }
  | { type: 'start'; round: number; rules: MatchRules; mines: number[]; start: Position }
  | { type: 'progress'; round: number; revealed: number; minesHit: number }
  | { type: 'finished'; round: number; finish: Finish }
  | { type: 'rematch' }
  | { type: 'leave' };

/**
 * Decides the round from my result and the opponent's (null = still playing).
 * Defeat rule: a mine loses, otherwise the first to clear wins.
 * Penalty rule: the lowest total time wins; a player still playing loses as
 * soon as their time passes a finished opponent's (they then send 'stopped').
 */
export function decideOutcome(me: Finish | null, opponent: Finish | null, rule: MineRule): Outcome {
  const compare = (a: Finish, b: Finish): Outcome =>
    a.totalMs === b.totalMs ? 'draw' : a.totalMs < b.totalMs ? 'won' : 'lost';
  const cleared = (f: Finish | null): f is Finish => f?.kind === 'cleared';

  if (cleared(me) && cleared(opponent)) return compare(me, opponent);

  if (rule === 'defeat') {
    if (me?.kind === 'exploded' && opponent?.kind === 'exploded') return 'draw';
    if (me?.kind === 'exploded') return 'lost';
    if (opponent?.kind === 'exploded') return 'won';
    if (cleared(me)) return 'won';
    if (cleared(opponent)) return 'lost';
    return 'pending';
  }

  if (cleared(me) && opponent?.kind === 'stopped') return 'won';
  if (cleared(opponent) && me?.kind === 'stopped') return 'lost';
  return 'pending';
}

/** Checks a message received from the other device before using it. */
export function isMatchMessage(value: unknown): value is MatchMessage {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

  switch (message['type']) {
    case 'rules':
      return isRules(message['rules']);
    case 'start': {
      const start = message['start'] as Record<string, unknown> | null;
      return (
        isNumber(message['round']) &&
        isRules(message['rules']) &&
        Array.isArray(message['mines']) &&
        message['mines'].every(isNumber) &&
        typeof start === 'object' &&
        start !== null &&
        isNumber(start['row']) &&
        isNumber(start['col'])
      );
    }
    case 'progress':
      return (
        isNumber(message['round']) && isNumber(message['revealed']) && isNumber(message['minesHit'])
      );
    case 'finished': {
      const finish = message['finish'] as Record<string, unknown> | null;
      return (
        isNumber(message['round']) &&
        typeof finish === 'object' &&
        finish !== null &&
        ['cleared', 'exploded', 'stopped'].includes(finish['kind'] as string) &&
        isNumber(finish['totalMs'])
      );
    }
    case 'rematch':
    case 'leave':
      return true;
    default:
      return false;
  }
}

function isRules(value: unknown): value is MatchRules {
  if (typeof value !== 'object' || value === null) return false;
  const rules = value as Record<string, unknown>;
  return (
    ['beginner', 'intermediate', 'expert'].includes(rules['preset'] as string) &&
    typeof rules['noGuess'] === 'boolean' &&
    ['defeat', 'penalty'].includes(rules['mineRule'] as string) &&
    PENALTY_OPTIONS.includes(rules['penaltySeconds'] as PenaltySeconds)
  );
}

/** m:ss.t, for comparing close race times. */
export function formatRaceTime(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}
