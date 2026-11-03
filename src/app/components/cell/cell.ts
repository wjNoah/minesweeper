import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CellState } from '../../models/cell.model';

const LONG_PRESS_MS = 400;
/** A finger moving further than this is scrolling, not pressing. */
const MOVE_TOLERANCE_PX = 10;

type CellView = 'hidden' | 'flagged' | 'wrong-flag' | 'mine' | 'exploded' | 'number' | 'empty';

const SYMBOLS: Partial<Record<CellView, string>> = {
  flagged: '🚩',
  'wrong-flag': '❌',
  mine: '💣',
  exploded: '💥',
};

@Component({
  selector: 'app-cell',
  templateUrl: './cell.html',
  styleUrl: './cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cell {
  readonly cell = input.required<CellState>();
  /** True after a loss, so hidden mines and wrong flags are shown. */
  readonly lost = input(false);
  /** The one cell that is reachable with Tab (roving tabindex). */
  readonly focusable = input(false);

  /** Click or tap. */
  readonly primary = output<void>();
  /** Right-click, two-finger click, Shift+Click or long press. */
  readonly secondary = output<void>();
  readonly chord = output<void>();
  readonly hovered = output<void>();

  protected readonly pressing = signal(false);
  private pressTimer: ReturnType<typeof setTimeout> | undefined;
  private pressStartX = 0;
  private pressStartY = 0;
  private suppressNextClick = false;

  protected readonly view = computed<CellView>(() => {
    const { hasMine, isRevealed, isFlagged, adjacentMines } = this.cell();
    if (isRevealed) {
      if (hasMine) return 'exploded';
      return adjacentMines > 0 ? 'number' : 'empty';
    }
    if (this.lost()) {
      if (isFlagged && !hasMine) return 'wrong-flag';
      if (hasMine && !isFlagged) return 'mine';
    }
    return isFlagged ? 'flagged' : 'hidden';
  });

  protected readonly symbol = computed(() => {
    const view = this.view();
    return view === 'number' ? String(this.cell().adjacentMines) : (SYMBOLS[view] ?? '');
  });

  protected readonly label = computed(() => {
    const { row, col, adjacentMines } = this.cell();
    const position = `row ${row + 1}, column ${col + 1}`;
    switch (this.view()) {
      case 'number':
        return `${position}, ${adjacentMines} ${adjacentMines === 1 ? 'mine' : 'mines'} nearby`;
      case 'wrong-flag':
        return `${position}, wrong flag`;
      case 'exploded':
        return `${position}, exploded mine`;
      default:
        return `${position}, ${this.view()}`;
    }
  });

  protected onClick(event: MouseEvent): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (event.shiftKey) {
      this.secondary.emit();
    } else {
      this.primary.emit();
    }
  }

  protected onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (this.suppressNextClick) return; // The long press already flagged this cell.
    if (this.pressTimer !== undefined) {
      // Some touch browsers fire contextmenu before our timer, treat it as the long press.
      this.completeLongPress();
      return;
    }
    this.secondary.emit();
  }

  protected onPointerDown(event: PointerEvent): void {
    this.suppressNextClick = false;
    if (event.pointerType !== 'touch') return;

    this.cancelPress();
    this.pressStartX = event.clientX;
    this.pressStartY = event.clientY;
    this.pressing.set(true);
    this.pressTimer = setTimeout(() => this.completeLongPress(), LONG_PRESS_MS);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.pressTimer === undefined) return;
    const distance = Math.hypot(event.clientX - this.pressStartX, event.clientY - this.pressStartY);
    if (distance > MOVE_TOLERANCE_PX) this.cancelPress();
  }

  protected cancelPress(): void {
    clearTimeout(this.pressTimer);
    this.pressTimer = undefined;
    this.pressing.set(false);
  }

  private completeLongPress(): void {
    this.cancelPress();
    // The browser still sends a click when the finger lifts, which must not reveal the cell.
    this.suppressNextClick = true;
    navigator.vibrate?.(30);
    this.secondary.emit();
  }
}
