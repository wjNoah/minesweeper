import { BOARD_THEMES, BoardThemeId } from './appearance.model';
import { BotLevel } from './bot.model';
import { GameModeId, gameModeLabel } from './game-mode.model';
import { DifficultyId } from './game.model';

/** Something that happened in the game. Quests only look at these facts. */
export type QuestEvent =
  | {
      type: 'game-won';
      difficulty: DifficultyId;
      seconds: number;
      noGuess: boolean;
      hintsUsed: number;
      flagsPlaced: number;
      chords: number;
    }
  | { type: 'game-lost'; difficulty: DifficultyId; chords: number }
  | { type: 'match-won'; opponent: 'bot' | 'friend'; botLevel: BotLevel | null };

/** What finishing a quest unlocks. */
export type QuestReward =
  { kind: 'theme'; theme: BoardThemeId } | { kind: 'mode'; mode: GameModeId };

export interface Quest {
  id: string;
  title: string;
  description: string;
  goal: number;
  rewards?: readonly QuestReward[];
  /** The new progress after an event. Most quests count up; a streak can fall back to 0. */
  advance: (progress: number, event: QuestEvent) => number;
}

export interface QuestState {
  progress: number;
  /** When the quest was completed (ms since 1970). Once done, it stays done. */
  completedAt: number | null;
}

export type QuestStates = Record<string, QuestState>;

type GameWon = Extract<QuestEvent, { type: 'game-won' }>;

/** Custom boards don't count, so a tiny board with one mine can't farm quests. */
const isRealWin = (event: QuestEvent): event is GameWon =>
  event.type === 'game-won' && event.difficulty !== 'custom';

/** Counts each event that matches by one. */
const countWhen =
  (matches: (event: QuestEvent) => boolean) =>
  (progress: number, event: QuestEvent): number =>
    matches(event) ? progress + 1 : progress;

export const QUESTS: readonly Quest[] = [
  {
    id: 'first-win',
    title: 'First sweep',
    description: 'Win a game on Beginner or harder',
    goal: 1,
    rewards: [{ kind: 'theme', theme: 'blueprint' }],
    advance: countWhen(isRealWin),
  },
  {
    id: 'ten-wins',
    title: 'Getting the hang of it',
    description: 'Win 10 games',
    goal: 10,
    rewards: [{ kind: 'theme', theme: 'candy' }],
    advance: countWhen(isRealWin),
  },
  {
    id: 'intermediate-win',
    title: 'Moving up',
    description: 'Win an Intermediate game',
    goal: 1,
    rewards: [
      { kind: 'mode', mode: 'no-flags' },
      { kind: 'mode', mode: 'mirror' },
    ],
    advance: countWhen((e) => isRealWin(e) && e.difficulty === 'intermediate'),
  },
  {
    id: 'expert-win',
    title: 'Expert',
    description: 'Win an Expert game',
    goal: 1,
    rewards: [{ kind: 'mode', mode: 'fog' }],
    advance: countWhen((e) => isRealWin(e) && e.difficulty === 'expert'),
  },
  {
    id: 'quick-beginner',
    title: 'Quick hands',
    description: 'Win Beginner in under 30 seconds without a hint',
    goal: 1,
    rewards: [{ kind: 'theme', theme: 'arcade' }],
    advance: countWhen(
      (e) => isRealWin(e) && e.difficulty === 'beginner' && e.seconds < 30 && e.hintsUsed === 0,
    ),
  },
  {
    id: 'pure-logic',
    title: 'Pure logic',
    description: 'Win a no-guessing game without a hint',
    goal: 1,
    rewards: [{ kind: 'theme', theme: 'chalkboard' }],
    advance: countWhen((e) => isRealWin(e) && e.noGuess && e.hintsUsed === 0),
  },
  {
    id: 'no-flags',
    title: 'No flags needed',
    description: 'Win a game without placing a single flag',
    goal: 1,
    rewards: [{ kind: 'theme', theme: 'cat' }],
    advance: countWhen((e) => isRealWin(e) && e.flagsPlaced === 0),
  },
  {
    id: 'streak',
    title: 'Hot streak',
    description: 'Win 3 games in a row. A loss starts the count again',
    goal: 3,
    rewards: [{ kind: 'theme', theme: 'neon' }],
    advance: (progress, event) => {
      if (isRealWin(event)) return progress + 1;
      if (event.type === 'game-lost' && event.difficulty !== 'custom') return 0;
      return progress;
    },
  },
  {
    id: 'chords',
    title: 'Chord player',
    description: 'Open cells by chording 50 times',
    goal: 50,
    rewards: [{ kind: 'theme', theme: 'notebook' }],
    advance: (progress, event) =>
      event.type === 'game-won' || event.type === 'game-lost' ? progress + event.chords : progress,
  },
  {
    id: 'regular',
    title: 'Regular',
    description: 'Finish 25 games, won or lost',
    goal: 25,
    rewards: [
      { kind: 'theme', theme: 'royal' },
      { kind: 'mode', mode: 'bouncy' },
    ],
    advance: countWhen(
      (e) => (e.type === 'game-won' || e.type === 'game-lost') && e.difficulty !== 'custom',
    ),
  },
  {
    id: 'beat-bot',
    title: 'Beat the bot',
    description: 'Win a 1v1 against the bot',
    goal: 1,
    rewards: [{ kind: 'theme', theme: 'terminal' }],
    advance: countWhen((e) => e.type === 'match-won' && e.opponent === 'bot'),
  },
  {
    id: 'beat-hard-bot',
    title: 'Machine breaker',
    description: 'Beat the bot on Hard',
    goal: 1,
    rewards: [{ kind: 'theme', theme: 'lava' }],
    advance: countWhen((e) => e.type === 'match-won' && e.botLevel === 'hard'),
  },
  {
    id: 'beat-friend',
    title: 'Duelist',
    description: 'Win a 1v1 against a friend',
    goal: 1,
    rewards: [{ kind: 'theme', theme: 'galaxy' }],
    advance: countWhen((e) => e.type === 'match-won' && e.opponent === 'friend'),
  },
];

/** "the Neon Nights theme" or "the Fog mode", for "Unlocks …" and "… unlocked". */
export function rewardLabels(quest: Quest): string[] {
  return (quest.rewards ?? []).map((reward) =>
    reward.kind === 'theme'
      ? `the ${BOARD_THEMES.find((t) => t.id === reward.theme)?.label ?? reward.theme} theme`
      : `the ${gameModeLabel(reward.mode)} mode`,
  );
}

/** The quest that unlocks a theme, or undefined for themes everyone has. */
export function questForTheme(theme: BoardThemeId): Quest | undefined {
  return QUESTS.find((quest) =>
    quest.rewards?.some((reward) => reward.kind === 'theme' && reward.theme === theme),
  );
}

/** The quest that unlocks a mode, or undefined for Normal. */
export function questForMode(mode: GameModeId): Quest | undefined {
  return QUESTS.find((quest) =>
    quest.rewards?.some((reward) => reward.kind === 'mode' && reward.mode === mode),
  );
}

export function questState(states: QuestStates, id: string): QuestState {
  return states[id] ?? { progress: 0, completedAt: null };
}

/**
 * Applies one event to every quest that is not done yet. Returns the new states and the
 * quests this event completed. Progress never goes past the goal, and done quests don't change.
 * When nothing changed, the same states object comes back.
 */
export function applyQuestEvent(
  states: QuestStates,
  event: QuestEvent,
  now: number,
): { states: QuestStates; completed: Quest[] } {
  let next = states;
  const completed: Quest[] = [];
  for (const quest of QUESTS) {
    const state = questState(states, quest.id);
    if (state.completedAt !== null) continue;

    const progress = Math.min(quest.goal, quest.advance(state.progress, event));
    if (progress === state.progress) continue;
    const done = progress >= quest.goal;
    next = { ...next, [quest.id]: { progress, completedAt: done ? now : null } };
    if (done) completed.push(quest);
  }
  return { states: next, completed };
}

/** Reads stored progress. Unknown quests and broken values are left out. */
export function parseQuestStates(value: unknown): QuestStates {
  if (typeof value !== 'object' || value === null) return {};
  const stored = value as Record<string, unknown>;
  const states: QuestStates = {};
  for (const quest of QUESTS) {
    const entry = stored[quest.id] as Record<string, unknown> | undefined;
    if (typeof entry !== 'object' || entry === null) continue;
    const { progress, completedAt } = entry;
    if (typeof progress !== 'number' || !Number.isInteger(progress) || progress < 0) continue;
    const doneAt = typeof completedAt === 'number' && completedAt > 0 ? completedAt : null;
    states[quest.id] = {
      progress: doneAt ? quest.goal : Math.min(progress, quest.goal),
      completedAt: doneAt,
    };
  }
  return states;
}
