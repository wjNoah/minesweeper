import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { GameService } from '../../services/game.service';
import { Cell } from '../cell/cell';

interface Position {
  row: number;
  col: number;
}

const ARROW_MOVES: Record<string, Position> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

@Component({
  selector: 'app-board',
  imports: [Cell],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class Board {
  protected readonly game = inject(GameService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly cursorPosition = signal<Position>({ row: 0, col: 0 });
  /** Keyboard cursor, kept inside the board when the size changes. It is also where Tab lands. */
  private readonly cursor = computed(() => {
    const { rows, cols } = this.game.config();
    const { row, col } = this.cursorPosition();
    return { row: Math.min(row, rows - 1), col: Math.min(col, cols - 1) };
  });
  /** Cell under the mouse, so F and Space work while hovering. */
  private readonly hovered = signal<Position | null>(null);

  protected isCursor(row: number, col: number): boolean {
    const cursor = this.cursor();
    return cursor.row === row && cursor.col === col;
  }

  protected onHover(row: number, col: number): void {
    this.hovered.set({ row, col });
  }

  protected onPointerLeave(): void {
    this.hovered.set(null);
  }

  protected onPrimary(row: number, col: number): void {
    this.cursorPosition.set({ row, col });
    this.game.primaryAction(row, col);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('input, select, textarea')) return;

    const key = event.key.toLowerCase();
    if (key === 'r') {
      this.game.newGame();
      return;
    }

    const focusInBoard = this.host.nativeElement.contains(document.activeElement);
    const noFocus = document.activeElement === document.body;
    const active = this.hovered() ?? (focusInBoard ? this.cursor() : null);

    if (key === 'f' && active) {
      this.game.toggleFlag(active.row, active.col);
    } else if ((key === 'enter' || key === ' ') && active && (focusInBoard || noFocus)) {
      // Stop the browser from also clicking the focused button or scrolling the page.
      event.preventDefault();
      this.game.revealOrChord(active.row, active.col);
    } else if (event.key in ARROW_MOVES && focusInBoard) {
      event.preventDefault();
      this.moveCursor(ARROW_MOVES[event.key]);
    }
  }

  private moveCursor(step: Position): void {
    const { rows, cols } = this.game.config();
    const { row, col } = this.cursor();
    const next = {
      row: Math.min(rows - 1, Math.max(0, row + step.row)),
      col: Math.min(cols - 1, Math.max(0, col + step.col)),
    };
    this.cursorPosition.set(next);
    // Keyboard takes over from the mouse until the pointer enters another cell.
    this.hovered.set(null);
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(`[data-row="${next.row}"][data-col="${next.col}"]`)
      ?.focus();
  }
}
