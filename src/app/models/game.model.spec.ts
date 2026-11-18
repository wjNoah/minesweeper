import { CUSTOM_LIMITS, normalizeConfig, PRESETS } from './game.model';

describe('PRESETS', () => {
  it('has the classic sizes', () => {
    expect(PRESETS.map(({ rows, cols, mines }) => [rows, cols, mines])).toEqual([
      [9, 9, 10],
      [16, 16, 40],
      [16, 30, 99],
    ]);
  });
});

describe('normalizeConfig', () => {
  it('keeps a valid custom board', () => {
    expect(normalizeConfig({ rows: 12, cols: 20, mines: 30 })).toEqual({
      rows: 12,
      cols: 20,
      mines: 30,
    });
  });

  it('limits the size in both directions', () => {
    const small = normalizeConfig({ rows: 1, cols: 1, mines: 1 });
    expect([small.rows, small.cols]).toEqual([CUSTOM_LIMITS.minSize, CUSTOM_LIMITS.minSize]);

    const big = normalizeConfig({ rows: 999, cols: 999, mines: 1 });
    expect([big.rows, big.cols]).toEqual([CUSTOM_LIMITS.maxRows, CUSTOM_LIMITS.maxCols]);
  });

  it('always leaves one safe cell, because the first click must be safe', () => {
    expect(normalizeConfig({ rows: 5, cols: 5, mines: 25 }).mines).toBe(24);
  });

  it('needs at least one mine', () => {
    expect(normalizeConfig({ rows: 5, cols: 5, mines: 0 }).mines).toBe(1);
  });

  it('rounds fractions and turns an empty field into the minimum', () => {
    expect(normalizeConfig({ rows: 9.4, cols: 9.6, mines: 10 })).toEqual({
      rows: 9,
      cols: 10,
      mines: 10,
    });
    expect(normalizeConfig({ rows: NaN, cols: NaN, mines: NaN })).toEqual({
      rows: 5,
      cols: 5,
      mines: 1,
    });
  });
});
