import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { getNeighbors } from '../../services/board-logic';
import { HintKind } from '../../services/solver';
import { GameService } from '../../services/game.service';
import { SettingsService } from '../../services/settings.service';
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
  protected readonly settings = inject(SettingsService);
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
  private readonly focusInBoard = signal(false);

  /** Hidden neighbors of the number under the pointer or keyboard cursor, as "row,col". */
  private readonly highlighted = computed(() => {
    const none = new Set<string>();
    if (!this.settings.settings().highlightNeighbors || this.game.isOver()) return none;

    const position = this.hovered() ?? (this.focusInBoard() ? this.cursor() : null);
    const board = this.game.board();
    const cell = position && board[position.row]?.[position.col];
    if (!cell || !cell.isRevealed || cell.adjacentMines === 0) return none;

    const hidden = getNeighbors(board, cell.row, cell.col).filter(
      (n) => !n.isRevealed && !n.isFlagged,
    );
    return new Set(hidden.map((n) => `${n.row},${n.col}`));
  });

  constructor() {
    // Move the keyboard cursor to a new hint and scroll it into view (large boards on phones).
    effect(() => {
      const hint = this.game.hint();
      if (!hint) return;
      this.cursorPosition.set({ row: hint.row, col: hint.col });
      const button = this.cellButton(hint.row, hint.col);
      button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (untracked(this.focusInBoard)) button?.focus();
    });
  }

  protected isCursor(row: number, col: number): boolean {
    const cursor = this.cursor();
    return cursor.row === row && cursor.col === col;
  }

  protected hintFor(row: number, col: number): HintKind | null {
    const hint = this.game.hint();
    return hint && hint.row === row && hint.col === col ? hint.kind : null;
  }

  protected isHighlighted(row: number, col: number): boolean {
    return this.highlighted().has(`${row},${col}`);
  }

  protected onFocusChange(): void {
    // focusout fires before focus lands on the next cell, so check on the next frame.
    requestAnimationFrame(() =>
      this.focusInBoard.set(this.host.nativeElement.contains(document.activeElement)),
    );
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
    if (target?.closest('input, select, textarea, dialog')) return;

    const keys = this.settings.settings().keys;
    const key = event.key.toLowerCase();
    const focusInBoard = this.host.nativeElement.contains(document.activeElement);
    const noFocus = document.activeElement === document.body;
    // Space on another focused button (like New game) should just press that button.
    if (key === ' ' && !focusInBoard && target?.closest('button, a')) return;

    const active = this.hovered() ?? (focusInBoard ? this.cursor() : null);

    const inMatch = this.game.mode() === 'match';
    if (key === keys.newGame && !inMatch) {
      this.game.newGame();
    } else if (key === keys.hint && !inMatch) {
      this.game.showHint();
    } else if (key === keys.flagMode) {
      this.game.setFlagMode(!this.game.flagMode());
    } else if (key === keys.flag && active) {
      this.game.toggleFlag(active.row, active.col);
    } else if ((key === 'enter' || key === keys.reveal) && active && (focusInBoard || noFocus)) {
      // Stop the browser from also clicking the focused button or scrolling the page.
      event.preventDefault();
      this.game.revealOrChord(active.row, active.col);
    } else if (event.key in ARROW_MOVES && focusInBoard) {
      event.preventDefault();
      this.moveCursor(ARROW_MOVES[event.key]);
    } else {
      return;
    }
    if (key === ' ') event.preventDefault();
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
    this.cellButton(next.row, next.col)?.focus();
  }

  private cellButton(row: number, col: number): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>(
      `[data-row="${row}"][data-col="${col}"]`,
    );
  }
}
