import { TestBed } from '@angular/core/testing';
import { CellState } from '../../models/cell.model';
import { Cell } from './cell';

const FLAGGED: CellState = {
  row: 0,
  col: 0,
  hasMine: true,
  isRevealed: false,
  isFlagged: true,
  adjacentMines: 0,
};

function render(cell: CellState, inputs: Record<string, unknown> = {}): HTMLElement {
  const fixture = TestBed.createComponent(Cell);
  fixture.componentRef.setInput('cell', cell);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Cell icons', () => {
  it('draws the built-in flag by default', () => {
    const el = render(FLAGGED);
    expect(el.querySelector('svg.flag')).not.toBeNull();
    expect(el.querySelector('.flag-picture')).toBeNull();
  });

  it('shows the custom flag picture instead of the drawing', () => {
    const el = render(FLAGGED, { customFlag: true });
    expect(el.querySelector('.flag-picture')).not.toBeNull();
    expect(el.querySelector('svg.flag')).toBeNull();
  });

  it('shows the custom mine on a lost board and on the exploded mine', () => {
    const hidden = render({ ...FLAGGED, isFlagged: false }, { customMine: true, lost: true });
    expect(hidden.querySelector('.mine-picture')).not.toBeNull();

    const exploded = render(
      { ...FLAGGED, isFlagged: false, isRevealed: true },
      { customMine: true },
    );
    expect(exploded.querySelector('.mine-picture')).not.toBeNull();
  });

  it('keeps the wrong-flag cross on top of a custom flag', () => {
    const wrong: CellState = { ...FLAGGED, hasMine: false };
    const el = render(wrong, { customFlag: true, lost: true });
    expect(el.querySelector('.flag-picture')).not.toBeNull();
    expect(el.querySelector('svg.cross')).not.toBeNull();
  });
});
