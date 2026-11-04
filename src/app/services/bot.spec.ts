import { BOT_LEVELS, BotSkill } from '../models/bot.model';
import { computeAdjacentCounts, createEmptyBoard, Grid, revealCell } from './board-logic';
import { applyBotMove, botMoveDelay, BotMove, BotState, chooseBotMove } from './bot';
import { generateNoGuessBoard } from './solver';

/** Builds a grid from rows of text: '*' is a mine, '.' is empty. */
function gridFromLayout(layout: string[]): Grid {
  const grid = createEmptyBoard(layout.length, layout[0].length);
  layout.forEach((line, row) =>
    [...line].forEach((char, col) => (grid[row][col].hasMine = char === '*')),
  );
  return computeAdjacentCounts(grid);
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

const careful: BotSkill = { ...BOT_LEVELS.hard, mistakeChance: 0 };

/** Plays a whole round and returns the moves and the summed thinking time. */
function playOut(
  start: BotState,
  skill: BotSkill,
  rule: 'defeat' | 'penalty',
  random: () => number,
) {
  let state = start;
  const moves: BotMove[] = [];
  let timeMs = 0;
  for (let i = 0; i < 3000 && !state.result; i++) {
    const move = chooseBotMove(state.board, skill, random);
    moves.push(move);
    timeMs += botMoveDelay(move, skill, random);
    state = applyBotMove(state, move, rule);
  }
  return { state, moves, timeMs };
}

function noGuessStart(seed: number): BotState {
  const { grid } = generateNoGuessBoard(createEmptyBoard(9, 9), 10, 4, 4, seededRandom(seed));
  return { board: revealCell(grid, 4, 4), minesHit: 0, result: null };
}

describe('the bot', () => {
  it('solves a no-guessing board with logic only, never touching a mine', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { state, moves } = playOut(noGuessStart(seed), careful, 'defeat', seededRandom(seed));
      expect(state.result).toBe('cleared');
      expect(state.minesHit).toBe(0);
      expect(moves.every((m) => m.kind === 'reveal' || m.kind === 'flag')).toBe(true);
    }
  });

  it('guesses only when no move can be proven', () => {
    // After opening the top-left, both bottom cells look the same: a real 50/50.
    const board = revealCell(gridFromLayout(['..', '..', '*.']), 0, 0);
    const move = chooseBotMove(board, careful, () => 0.5);
    expect(move.kind).toBe('guess');
    expect(board[move.row][move.col].isRevealed).toBe(false);
  });

  it('weaker bots can slip and click a random hidden cell', () => {
    const board = revealCell(gridFromLayout(['*..', '...', '...']), 2, 2);
    const move = chooseBotMove(board, { ...careful, mistakeChance: 1 }, () => 0);
    expect(move.kind).toBe('slip');
  });

  it('follows the defeat rule: a mine ends its round', () => {
    const board = revealCell(gridFromLayout(['*..', '...', '...']), 2, 2);
    const state = applyBotMove(
      { board, minesHit: 0, result: null },
      { kind: 'slip', row: 0, col: 0 },
      'defeat',
    );
    expect(state.result).toBe('exploded');
  });

  it('follows the penalty rule: a mine is flagged, counted, and the bot plays on', () => {
    const board = revealCell(gridFromLayout(['*..', '...', '..*']), 0, 2);
    const state = applyBotMove(
      { board, minesHit: 0, result: null },
      { kind: 'slip', row: 0, col: 0 },
      'penalty',
    );
    expect(state.result).toBeNull();
    expect(state.minesHit).toBe(1);
    expect(state.board[0][0].isFlagged).toBe(true);
  });

  it('flags quickly and hesitates before a guess', () => {
    const at = (kind: BotMove['kind']) =>
      botMoveDelay({ kind, row: 0, col: 0 }, careful, () => 0.5);
    expect(at('flag')).toBeLessThan(at('reveal'));
    expect(at('guess')).toBeGreaterThan(at('reveal'));
  });

  it('gets faster from easy to hard on the same board', () => {
    const time = (skill: BotSkill) =>
      playOut(noGuessStart(7), { ...skill, mistakeChance: 0 }, 'penalty', seededRandom(7)).timeMs;
    const easy = time(BOT_LEVELS.easy);
    const medium = time(BOT_LEVELS.medium);
    const hard = time(BOT_LEVELS.hard);
    expect(easy).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(hard);
  });
});
