import { GAME_MODES, gameModeLabel, isGameModeId, targetColumn } from './game-mode.model';

describe('game modes', () => {
  it('starts with Normal and has the four quest modes', () => {
    expect(GAME_MODES.map((m) => m.id)).toEqual(['normal', 'no-flags', 'fog', 'mirror', 'bouncy']);
  });

  it('knows its ids and names', () => {
    expect(isGameModeId('fog')).toBe(true);
    expect(isGameModeId('chaos')).toBe(false);
    expect(gameModeLabel('no-flags')).toBe('No flags');
  });

  it('Mirror sends a move to the cell mirrored from left to right', () => {
    expect(targetColumn('mirror', 9, 0)).toBe(8);
    expect(targetColumn('mirror', 9, 8)).toBe(0);
    expect(targetColumn('mirror', 9, 4)).toBe(4); // The middle stays.
    expect(targetColumn('mirror', 30, 2)).toBe(27);
  });

  it('every other mode leaves the column alone', () => {
    for (const mode of ['normal', 'no-flags', 'fog', 'bouncy'] as const) {
      expect(targetColumn(mode, 9, 2)).toBe(2);
    }
  });
});
