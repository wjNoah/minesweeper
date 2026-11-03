/** The colors of each theme live in src/_board-themes.scss; this list is for the picker. */
export const BOARD_THEMES = [
  { id: 'classic', label: 'Classic' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'forest', label: 'Forest' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'slate', label: 'Slate' },
] as const;

export type BoardThemeId = (typeof BOARD_THEMES)[number]['id'];

/** 'tile': the picture is repeated on each block. 'board': one picture across the board. */
export type TileImageMode = 'tile' | 'board';

export interface AppearanceChoices {
  boardTheme: BoardThemeId;
  tileImageMode: TileImageMode;
}

export const DEFAULT_APPEARANCE: AppearanceChoices = {
  boardTheme: 'classic',
  tileImageMode: 'tile',
};

export function isBoardThemeId(value: unknown): value is BoardThemeId {
  return BOARD_THEMES.some((theme) => theme.id === value);
}

export function parseAppearance(value: unknown): AppearanceChoices {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_APPEARANCE };
  const stored = value as Record<string, unknown>;
  return {
    boardTheme: isBoardThemeId(stored['boardTheme'])
      ? stored['boardTheme']
      : DEFAULT_APPEARANCE.boardTheme,
    tileImageMode: stored['tileImageMode'] === 'board' ? 'board' : 'tile',
  };
}
