/**
 * Ways to play a solo game. Normal is always there; the others are unlocked by quests
 * (see the rewards in quest.model.ts). 1v1 rounds always use Normal.
 */
export type GameModeId = 'normal' | 'no-flags' | 'fog' | 'mirror' | 'bouncy';

export const GAME_MODES: readonly { id: GameModeId; label: string; description: string }[] = [
  { id: 'normal', label: 'Normal', description: 'Classic Minesweeper' },
  {
    id: 'no-flags',
    label: 'No flags',
    description: 'Flags are switched off. Keep every mine in your head',
  },
  {
    id: 'fog',
    label: 'Fog',
    description: 'Numbers fade soon after they open. Point at a cell to see its number again',
  },
  {
    id: 'mirror',
    label: 'Mirror',
    description: 'Every click lands on the mirrored cell, from left to right',
  },
  {
    id: 'bouncy',
    label: 'Bouncy flags',
    description: 'Flags wiggle, and now and then one hops to a cell next to it. Check them',
  },
];

export function isGameModeId(value: unknown): value is GameModeId {
  return GAME_MODES.some((mode) => mode.id === value);
}

export function gameModeLabel(mode: GameModeId): string {
  return GAME_MODES.find((m) => m.id === mode)?.label ?? mode;
}

/** The column a move lands on: in Mirror, the one mirrored from left to right. */
export function targetColumn(mode: GameModeId, cols: number, col: number): number {
  return mode === 'mirror' ? cols - 1 - col : col;
}
