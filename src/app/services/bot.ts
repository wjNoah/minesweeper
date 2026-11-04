import { BotSkill } from '../models/bot.model';
import { MineRule } from '../models/match.model';
import {
  coverHitMines,
  Grid,
  isLost,
  isWon,
  RandomFn,
  revealCell,
  toggleFlag,
} from './board-logic';
import { findHint } from './solver';

/**
 * reveal: a cell logic proves is safe. flag: a cell logic proves is a mine.
 * guess: no proven move exists, so the bot picks a hidden cell at random.
 * slip: a careless click on a random hidden cell (only weaker bots do this).
 */
export type BotMoveKind = 'reveal' | 'flag' | 'guess' | 'slip';

export interface BotMove {
  kind: BotMoveKind;
  row: number;
  col: number;
}

export interface BotState {
  board: Grid;
  minesHit: number;
  /** Set once the bot's round is over. */
  result: 'cleared' | 'exploded' | null;
}

/**
 * Chooses the bot's next move. It plays like a careful person: it uses the same
 * solver as the Hint button, so it only knows what is visible on its own board.
 */
export function chooseBotMove(board: Grid, skill: BotSkill, random: RandomFn): BotMove {
  const hidden = board.flat().filter((cell) => !cell.isRevealed && !cell.isFlagged);
  const randomCell = (kind: BotMoveKind): BotMove => {
    const cell = hidden[Math.floor(random() * hidden.length)];
    return { kind, row: cell.row, col: cell.col };
  };

  if (random() < skill.mistakeChance) return randomCell('slip');

  const hint = findHint(board);
  if (!hint) return randomCell('guess');
  // 'mine' and 'wrong-flag' hints are both a flag click (place or remove).
  return { kind: hint.kind === 'safe' ? 'reveal' : 'flag', row: hint.row, col: hint.col };
}

/** Plays a move on the bot's board, with the same mine rules as the person has. */
export function applyBotMove(state: BotState, move: BotMove, rule: MineRule): BotState {
  if (move.kind === 'flag') {
    return { ...state, board: toggleFlag(state.board, move.row, move.col) };
  }

  let board = revealCell(state.board, move.row, move.col);
  let minesHit = state.minesHit;
  if (isLost(board)) {
    if (rule === 'defeat') return { board, minesHit, result: 'exploded' };
    // Time penalty: the mine is flagged and the bot plays on.
    const covered = coverHitMines(board);
    board = covered.grid;
    minesHit += covered.hit;
  }
  return { board, minesHit, result: isWon(board) ? 'cleared' : null };
}

/** How long the bot takes for a move, with some variation so it does not feel mechanical. */
export function botMoveDelay(move: BotMove, skill: BotSkill, random: RandomFn): number {
  const factor = move.kind === 'flag' ? 0.6 : move.kind === 'guess' ? 1.6 : 1;
  return Math.round(skill.moveMs * factor * (0.6 + random() * 0.8));
}

export function revealedSafeCells(board: Grid): number {
  return board.flat().filter((cell) => cell.isRevealed && !cell.hasMine).length;
}
