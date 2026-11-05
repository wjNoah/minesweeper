import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CellState } from '../../models/cell.model';
import { HintKind } from '../../services/solver';

const LONG_PRESS_MS = 400;
/** A finger moving further than this is scrolling, not pressing. */
const MOVE_TOLERANCE_PX = 10;

type CellView =
  'hidden' | 'flagged' | 'wrong-flag' | 'mine' | 'exploded' | 'hit' | 'number' | 'empty';

const HINT_LABELS: Record<HintKind, string> = {
  safe: 'safe to open',
  mine: 'this is a mine',
  'wrong-flag': 'this flag is wrong',
};

@Component({
  selector: 'app-cell',
  imports: [NgTemplateOutlet],
  templateUrl: './cell.html',
  styleUrl: './cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Position for the "whole board" block picture.
  host: { '[style.--row]': 'cell().row', '[style.--col]': 'cell().col' },
})
export class Cell {
  readonly cell = input.required<CellState>();
  /** True after a loss, so hidden mines and wrong flags are shown. */
  readonly lost = input(false);
  /** The one cell that is reachable with Tab (roving tabindex). */
  readonly focusable = input(false);
  /** Hidden neighbor of the number under the pointer or keyboard cursor. */
  readonly highlighted = input(false);
  /** Set when this cell is the current hint. */
  readonly hint = input<HintKind | null>(null);
  /** Show the user's own flag or mine picture instead of the built-in drawing. */
  readonly customFlag = input(false);
  readonly customMine = input(false);
  /** Vibrate when a long press flags the cell (on phones that support it). */
  readonly haptics = input(true);

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
    const { hasMine, isRevealed, isFlagged, isHit, adjacentMines } = this.cell();
    if (isHit) return 'hit';
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

  protected readonly label = computed(() => {
    const hint = this.hint();
    const suffix = hint ? `, hint: ${HINT_LABELS[hint]}` : '';
    return this.stateLabel() + suffix;
  });

  private readonly stateLabel = computed(() => {
    const { row, col, adjacentMines } = this.cell();
    const position = `row ${row + 1}, column ${col + 1}`;
    switch (this.view()) {
      case 'number':
        return `${position}, ${adjacentMines} ${adjacentMines === 1 ? 'mine' : 'mines'} nearby`;
      case 'wrong-flag':
        return `${position}, wrong flag`;
      case 'exploded':
        return `${position}, exploded mine`;
      case 'hit':
        return `${position}, mine hit`;
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
    if (this.haptics()) navigator.vibrate?.(30);
    this.secondary.emit();
  }
}
