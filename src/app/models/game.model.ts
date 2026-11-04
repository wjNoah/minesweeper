/**
 * 'ready' means no cell has been revealed yet, so no mines are placed.
 * 'stopped' ends a 1v1 round early because the result was already decided.
 */
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost' | 'stopped';

export type PresetId = 'beginner' | 'intermediate' | 'expert';
export type DifficultyId = PresetId | 'custom';

export interface GameConfig {
  rows: number;
  cols: number;
  mines: number;
}

export interface Preset extends GameConfig {
  id: PresetId;
  label: string;
}

export const PRESETS: readonly Preset[] = [
  { id: 'beginner', label: 'Beginner', rows: 9, cols: 9, mines: 10 },
  { id: 'intermediate', label: 'Intermediate', rows: 16, cols: 16, mines: 40 },
  { id: 'expert', label: 'Expert', rows: 16, cols: 30, mines: 99 },
];

export const CUSTOM_LIMITS = { minSize: 5, maxRows: 30, maxCols: 40 };

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Keeps a custom board playable: sensible size and at least one safe cell. */
export function normalizeConfig(config: GameConfig): GameConfig {
  const rows = clamp(config.rows, CUSTOM_LIMITS.minSize, CUSTOM_LIMITS.maxRows);
  const cols = clamp(config.cols, CUSTOM_LIMITS.minSize, CUSTOM_LIMITS.maxCols);
  const mines = clamp(config.mines, 1, rows * cols - 1);
  return { rows, cols, mines };
}
