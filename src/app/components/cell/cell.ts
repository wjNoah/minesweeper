import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CellState } from '../../models/cell.model';

@Component({
  selector: 'app-cell',
  templateUrl: './cell.html',
  styleUrl: './cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cell {
  readonly cell = input.required<CellState>();
  readonly reveal = output<void>();

  protected readonly label = computed(() => {
    const { row, col, isRevealed, adjacentMines } = this.cell();
    const position = `row ${row + 1}, column ${col + 1}`;
    if (!isRevealed) return `${position}, hidden`;
    return adjacentMines === 0 ? `${position}, empty` : `${position}, ${adjacentMines}`;
  });
}
