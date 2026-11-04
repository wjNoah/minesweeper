export type BotLevel = 'easy' | 'medium' | 'hard';

export interface BotSkill {
  label: string;
  description: string;
  /** Average time for one move (open a cell). Flags are quicker, guesses slower. */
  moveMs: number;
  /** Chance per move to click a random hidden cell instead of the proven one. */
  mistakeChance: number;
}

export const BOT_LEVEL_IDS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

// Tuned so the bots play like people: median times on no-guessing boards
// (Beginner / Intermediate / Expert): Easy about 40 s / 3 min / 8 min,
// Medium about 20 s / 1.7 min / 4.5 min, Hard about 12 s / 50 s / 2.2 min.
export const BOT_LEVELS: Record<BotLevel, BotSkill> = {
  easy: {
    label: 'Easy',
    description: 'Like a casual player: about 40 s on Beginner, and now and then clicks a mine.',
    moveMs: 2300,
    mistakeChance: 0.006,
  },
  medium: {
    label: 'Medium',
    description: 'Like a regular player: about 20 s on Beginner, and rarely slips.',
    moveMs: 1350,
    mistakeChance: 0.002,
  },
  hard: {
    label: 'Hard',
    description: 'Like a strong player: about 12 s on Beginner, and never careless.',
    moveMs: 650,
    mistakeChance: 0,
  },
};
