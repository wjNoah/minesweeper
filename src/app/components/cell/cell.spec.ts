import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CellState } from '../../models/cell.model';
import { Cell } from './cell';

const HIDDEN: CellState = {
  row: 2,
  col: 4,
  hasMine: false,
  isRevealed: false,
  isFlagged: false,
  isHit: false,
  adjacentMines: 0,
};
const FLAGGED: CellState = { ...HIDDEN, hasMine: true, isFlagged: true };

function create(cell: CellState, inputs: Record<string, unknown> = {}): ComponentFixture<Cell> {
  const fixture = TestBed.createComponent(Cell);
  fixture.componentRef.setInput('cell', cell);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture;
}

function render(cell: CellState, inputs: Record<string, unknown> = {}): HTMLElement {
  return create(cell, inputs).nativeElement as HTMLElement;
}

const labelOf = (cell: CellState, inputs: Record<string, unknown> = {}) =>
  render(cell, inputs).querySelector('button')?.getAttribute('aria-label');

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

  it('shows a mine that was hit under the time penalty as a mine, not as a flag', () => {
    const el = render({ ...FLAGGED, isHit: true });
    expect(el.querySelector('button')?.classList).toContain('hit');
    expect(el.querySelector('svg.mine')).not.toBeNull();
    expect(el.querySelector('svg.flag')).toBeNull();
  });

  it('shows the number on a revealed cell, and nothing on an empty one', () => {
    const number = render({ ...HIDDEN, isRevealed: true, adjacentMines: 3 });
    expect(number.textContent?.trim()).toBe('3');
    expect(number.querySelector('button')?.dataset['count']).toBe('3');

    expect(render({ ...HIDDEN, isRevealed: true }).textContent?.trim()).toBe('');
  });

  it('does not give away a hidden mine while the game is still running', () => {
    const el = render({ ...HIDDEN, hasMine: true });
    expect(el.querySelector('svg.mine')).toBeNull();
    expect(el.querySelector('button')?.classList).toContain('hidden');
  });
});

describe('Cell labels for screen readers', () => {
  it('says the position, counted from 1, and the state', () => {
    expect(labelOf(HIDDEN)).toBe('row 3, column 5, hidden');
    expect(labelOf(FLAGGED)).toBe('row 3, column 5, flagged');
    expect(labelOf({ ...HIDDEN, isRevealed: true })).toBe('row 3, column 5, empty');
  });

  it('says how many mines a number stands for, with the right plural', () => {
    expect(labelOf({ ...HIDDEN, isRevealed: true, adjacentMines: 1 })).toBe(
      'row 3, column 5, 1 mine nearby',
    );
    expect(labelOf({ ...HIDDEN, isRevealed: true, adjacentMines: 2 })).toBe(
      'row 3, column 5, 2 mines nearby',
    );
  });

  it('names the end-of-game states', () => {
    expect(labelOf({ ...FLAGGED, isFlagged: false, isRevealed: true })).toBe(
      'row 3, column 5, exploded mine',
    );
    expect(labelOf({ ...FLAGGED, hasMine: false }, { lost: true })).toBe(
      'row 3, column 5, wrong flag',
    );
    expect(labelOf({ ...FLAGGED, isHit: true })).toBe('row 3, column 5, mine hit');
  });

  it('adds what a hint means', () => {
    expect(labelOf(HIDDEN, { hint: 'safe' })).toBe('row 3, column 5, hidden, hint: safe to open');
  });
});

describe('Cell input', () => {
  let fixture: ComponentFixture<Cell>;
  let button: HTMLButtonElement;
  let primary: number;
  let secondary: number;
  let chord: number;
  const vibrate = vi.fn();

  function pointer(type: string, pointerType: string, clientX = 0, clientY = 0): void {
    button.dispatchEvent(
      Object.assign(new Event(type, { bubbles: true }), { pointerType, clientX, clientY }),
    );
  }

  function setUp(inputs: Record<string, unknown> = {}): void {
    fixture = create(HIDDEN, inputs);
    button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    primary = secondary = chord = 0;
    fixture.componentInstance.primary.subscribe(() => primary++);
    fixture.componentInstance.secondary.subscribe(() => secondary++);
    fixture.componentInstance.chord.subscribe(() => chord++);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vibrate.mockReset();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    setUp();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('a click is the primary action', () => {
    button.click();
    expect([primary, secondary]).toEqual([1, 0]);
  });

  it('Shift + click flags, without a right-click', () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect([primary, secondary]).toEqual([0, 1]);
  });

  it('a right-click or two-finger click flags and keeps the browser menu closed', () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    expect(secondary).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('a double-click chords', () => {
    button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(chord).toBe(1);
  });

  describe('long press on touch screens', () => {
    it('flags after about 400 ms, with a small vibration', () => {
      pointer('pointerdown', 'touch');
      vi.advanceTimersByTime(399);
      expect(secondary).toBe(0);
      vi.advanceTimersByTime(1);
      expect(secondary).toBe(1);
      expect(vibrate).toHaveBeenCalledTimes(1);
    });

    it('does not vibrate when that setting is off', () => {
      setUp({ haptics: false });
      pointer('pointerdown', 'touch');
      vi.advanceTimersByTime(400);
      expect(secondary).toBe(1);
      expect(vibrate).not.toHaveBeenCalled();
    });

    it('does not also reveal the cell when the finger lifts', () => {
      pointer('pointerdown', 'touch');
      vi.advanceTimersByTime(400);
      pointer('pointerup', 'touch');
      button.click();
      expect([primary, secondary]).toEqual([0, 1]);

      // The very next tap is a normal tap again.
      pointer('pointerdown', 'touch');
      pointer('pointerup', 'touch');
      button.click();
      expect(primary).toBe(1);
    });

    it('a short tap is a normal tap', () => {
      pointer('pointerdown', 'touch');
      vi.advanceTimersByTime(100);
      pointer('pointerup', 'touch');
      vi.advanceTimersByTime(1000);
      button.click();
      expect([primary, secondary]).toEqual([1, 0]);
    });

    it('a finger that moves is scrolling, so it does not flag', () => {
      pointer('pointerdown', 'touch', 50, 50);
      pointer('pointermove', 'touch', 50, 70);
      vi.advanceTimersByTime(1000);
      expect(secondary).toBe(0);
    });

    it('a slightly shaking finger still counts as a press', () => {
      pointer('pointerdown', 'touch', 50, 50);
      pointer('pointermove', 'touch', 53, 54);
      vi.advanceTimersByTime(400);
      expect(secondary).toBe(1);
    });

    it('holding the mouse button is not a long press', () => {
      pointer('pointerdown', 'mouse');
      vi.advanceTimersByTime(1000);
      expect(secondary).toBe(0);
    });
  });
});
