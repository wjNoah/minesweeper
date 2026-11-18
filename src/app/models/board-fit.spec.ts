import { fitCellSize, MAX_FITTED_CELL_PX } from './board-fit';

const beginner = { rows: 9, cols: 9 };
const expert = { rows: 16, cols: 30 };

describe('fitCellSize', () => {
  it('fills the tighter direction exactly', () => {
    // 9 cells of 50px, 8 gaps of 3px and 26px of frame: 450 + 24 + 26 = 500.
    expect(fitCellSize({ width: 2000, height: 500 }, beginner, 26, 32)).toBe(50);
    expect(fitCellSize({ width: 500, height: 2000 }, beginner, 26, 32)).toBe(50);
  });

  it('rounds down, so the board never overflows by a pixel', () => {
    // 51px cells would need 509px.
    expect(fitCellSize({ width: 2000, height: 508 }, beginner, 26, 32)).toBe(50);
  });

  it('uses the rows and the columns of the board', () => {
    // Expert is wide: 30 columns decide on a wide window that is not wide enough.
    expect(fitCellSize({ width: 1200, height: 900 }, expert, 26, 32)).toBe(36);
  });

  it('never goes below the normal size; the board scrolls instead', () => {
    expect(fitCellSize({ width: 375, height: 600 }, expert, 14, 32)).toBe(32);
  });

  it('stops growing at a sensible size on a huge screen', () => {
    expect(fitCellSize({ width: 4000, height: 3000 }, beginner, 26, 32)).toBe(MAX_FITTED_CELL_PX);
  });

  it('keeps the player’s larger cell size even above that limit', () => {
    expect(fitCellSize({ width: 4000, height: 3000 }, beginner, 26, 80)).toBe(80);
  });
});
