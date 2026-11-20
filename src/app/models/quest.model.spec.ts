import { BOARD_THEMES } from './appearance.model';
import {
  applyQuestEvent,
  parseQuestStates,
  QuestEvent,
  questState,
  questForTheme,
  QUESTS,
  QuestStates,
  questForMode,
  rewardLabels,
} from './quest.model';

const won = (changes: Partial<Extract<QuestEvent, { type: 'game-won' }>> = {}): QuestEvent => ({
  type: 'game-won',
  difficulty: 'beginner',
  seconds: 60,
  noGuess: false,
  hintsUsed: 0,
  flagsPlaced: 5,
  chords: 0,
  ...changes,
});
const lost = (changes: Partial<Extract<QuestEvent, { type: 'game-lost' }>> = {}): QuestEvent => ({
  type: 'game-lost',
  difficulty: 'beginner',
  chords: 0,
  ...changes,
});

/** Plays events in order and returns the final states. */
function play(...events: QuestEvent[]): QuestStates {
  return events.reduce((states, event) => applyQuestEvent(states, event, 1000).states, {});
}

const progressOf = (states: QuestStates, id: string) => questState(states, id).progress;
const isDone = (states: QuestStates, id: string) => questState(states, id).completedAt !== null;

describe('quests', () => {
  it('have unique ids and sensible goals', () => {
    const ids = QUESTS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(QUESTS.every((q) => Number.isInteger(q.goal) && q.goal > 0)).toBe(true);
  });

  it('a first win completes "First sweep" and is announced once', () => {
    const first = applyQuestEvent({}, won(), 1000);
    expect(first.completed.map((q) => q.id)).toContain('first-win');
    expect(isDone(first.states, 'first-win')).toBe(true);
    expect(questState(first.states, 'first-win').completedAt).toBe(1000);

    const second = applyQuestEvent(first.states, won(), 2000);
    expect(second.completed.map((q) => q.id)).not.toContain('first-win');
    expect(questState(second.states, 'first-win').completedAt).toBe(1000);
  });

  it('wins on custom boards do not count', () => {
    const states = play(won({ difficulty: 'custom', seconds: 1, flagsPlaced: 0 }));
    expect(states).toEqual({});
  });

  it('counts wins towards a goal and stops at the goal', () => {
    const nine = play(...Array.from({ length: 9 }, () => won()));
    expect(progressOf(nine, 'ten-wins')).toBe(9);
    expect(isDone(nine, 'ten-wins')).toBe(false);

    const twelve = play(...Array.from({ length: 12 }, () => won()));
    expect(progressOf(twelve, 'ten-wins')).toBe(10);
    expect(isDone(twelve, 'ten-wins')).toBe(true);
  });

  it('the difficulty quests need that difficulty', () => {
    expect(isDone(play(won()), 'intermediate-win')).toBe(false);
    expect(isDone(play(won({ difficulty: 'intermediate' })), 'intermediate-win')).toBe(true);
    expect(isDone(play(won({ difficulty: 'expert' })), 'expert-win')).toBe(true);
  });

  it('"Quick hands" needs Beginner, under 30 seconds, and no hint', () => {
    expect(isDone(play(won({ seconds: 29 })), 'quick-beginner')).toBe(true);
    expect(isDone(play(won({ seconds: 30 })), 'quick-beginner')).toBe(false);
    expect(isDone(play(won({ seconds: 20, hintsUsed: 1 })), 'quick-beginner')).toBe(false);
    expect(isDone(play(won({ seconds: 20, difficulty: 'expert' })), 'quick-beginner')).toBe(false);
  });

  it('"Pure logic" needs a no-guessing board and no hint', () => {
    expect(isDone(play(won({ noGuess: true })), 'pure-logic')).toBe(true);
    expect(isDone(play(won({ noGuess: false })), 'pure-logic')).toBe(false);
    expect(isDone(play(won({ noGuess: true, hintsUsed: 2 })), 'pure-logic')).toBe(false);
  });

  it('"No flags needed" counts only wins without a single flag', () => {
    expect(isDone(play(won({ flagsPlaced: 1 })), 'no-flags')).toBe(false);
    expect(isDone(play(won({ flagsPlaced: 0 })), 'no-flags')).toBe(true);
  });

  describe('"Hot streak"', () => {
    it('needs wins in a row; a loss starts again', () => {
      const broken = play(won(), won(), lost(), won());
      expect(progressOf(broken, 'streak')).toBe(1);
      expect(isDone(play(won(), lost(), won(), won(), won()), 'streak')).toBe(true);
    });

    it('a loss on a custom board does not break it', () => {
      expect(progressOf(play(won(), lost({ difficulty: 'custom' }), won()), 'streak')).toBe(2);
    });

    it('stays done after a later loss', () => {
      expect(isDone(play(won(), won(), won(), lost()), 'streak')).toBe(true);
    });
  });

  it('"Chord player" adds up chords from won and lost games', () => {
    const states = play(won({ chords: 20 }), lost({ chords: 25 }));
    expect(progressOf(states, 'chords')).toBe(45);
    expect(isDone(play(won({ chords: 30 }), won({ chords: 30 })), 'chords')).toBe(true);
  });

  it('never stores more progress than the goal, even from one big game', () => {
    expect(progressOf(play(won({ chords: 80 })), 'chords')).toBe(50);
  });

  it('"Regular" counts finished games, won or lost', () => {
    expect(progressOf(play(won(), lost(), lost()), 'regular')).toBe(3);
  });

  it('1v1 quests know the bot from a friend and the bot’s strength', () => {
    const bot = (botLevel: 'easy' | 'hard'): QuestEvent => ({
      type: 'match-won',
      opponent: 'bot',
      botLevel,
    });
    const easy = play(bot('easy'));
    expect(isDone(easy, 'beat-bot')).toBe(true);
    expect(isDone(easy, 'beat-hard-bot')).toBe(false);
    expect(isDone(easy, 'beat-friend')).toBe(false);
    expect(isDone(play(bot('hard')), 'beat-hard-bot')).toBe(true);

    const friend = play({ type: 'match-won', opponent: 'friend', botLevel: null });
    expect(isDone(friend, 'beat-friend')).toBe(true);
    expect(isDone(friend, 'beat-bot')).toBe(false);
  });

  it('1v1 wins do not count as normal wins', () => {
    const states = play({ type: 'match-won', opponent: 'bot', botLevel: 'easy' });
    expect(progressOf(states, 'first-win')).toBe(0);
  });

  it('returns the same states when nothing changed, so nothing is saved', () => {
    const states: QuestStates = {};
    expect(applyQuestEvent(states, won({ difficulty: 'custom' }), 1).states).toBe(states);
  });
});

describe('quest rewards', () => {
  const themeIds = BOARD_THEMES.map((t) => t.id) as string[];
  const quest = (id: string) => QUESTS.find((q) => q.id === id)!;

  it('unlock only the new themes; the original six stay free for everyone', () => {
    const locked = BOARD_THEMES.filter((t) => questForTheme(t.id)).map((t) => t.id);
    expect(locked).toEqual([
      'blueprint',
      'candy',
      'neon',
      'terminal',
      'lava',
      'cat',
      'arcade',
      'chalkboard',
      'notebook',
      'royal',
      'galaxy',
    ]);
    for (const free of ['classic', 'ocean', 'forest', 'sunset', 'lavender', 'slate'] as const) {
      expect(questForTheme(free)).toBeUndefined();
    }
  });

  it('every theme reward is a real theme, and nothing is the reward of two quests', () => {
    const rewards = QUESTS.flatMap((q) => q.rewards ?? []);
    const themes = rewards.flatMap((r) => (r.kind === 'theme' ? [r.theme] : []));
    expect(themes.every((theme) => themeIds.includes(theme))).toBe(true);
    const keys = rewards.map((r) => (r.kind === 'theme' ? r.theme : r.mode));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every quest unlocks something', () => {
    expect(QUESTS.filter((q) => !q.rewards?.length).map((q) => q.id)).toEqual([]);
  });

  it('the cat theme comes from winning without a flag', () => {
    expect(questForTheme('cat')?.id).toBe('no-flags');
  });

  it('the harder difficulties unlock the game modes; Normal is always there', () => {
    expect(questForMode('no-flags')?.id).toBe('intermediate-win');
    expect(questForMode('mirror')?.id).toBe('intermediate-win');
    expect(questForMode('fog')?.id).toBe('expert-win');
    expect(questForMode('bouncy')?.id).toBe('regular');
    expect(questForMode('normal')).toBeUndefined();
  });

  it('names every reward for the quest list and the message', () => {
    expect(rewardLabels(quest('streak'))).toEqual(['the Neon Nights theme']);
    expect(rewardLabels(quest('intermediate-win'))).toEqual([
      'the No flags mode',
      'the Mirror mode',
    ]);
    expect(rewardLabels(quest('regular'))).toEqual(['the Royal theme', 'the Bouncy flags mode']);
  });
});

describe('parseQuestStates', () => {
  it('reads stored progress', () => {
    const states = parseQuestStates({
      'ten-wins': { progress: 4, completedAt: null },
      'first-win': { progress: 1, completedAt: 1234 },
    });
    expect(states).toEqual({
      'ten-wins': { progress: 4, completedAt: null },
      'first-win': { progress: 1, completedAt: 1234 },
    });
  });

  it('drops unknown quests and broken values, and caps progress at the goal', () => {
    const states = parseQuestStates({
      'made-up': { progress: 3, completedAt: null },
      'ten-wins': { progress: -2, completedAt: null },
      regular: { progress: 2.5, completedAt: null },
      chords: { progress: 999, completedAt: null },
      streak: 'yes',
    });
    expect(states).toEqual({ chords: { progress: 50, completedAt: null } });
  });

  it('starts empty for missing or broken data', () => {
    expect(parseQuestStates(null)).toEqual({});
    expect(parseQuestStates('done')).toEqual({});
  });
});
