import { Component, input } from '@angular/core';
import { CellState } from '../../models/cell.model';

@Component({
  selector: 'app-cell',
  templateUrl: './cell.html',
  styleUrl: './cell.scss',
})
export class Cell {
  readonly cell = input.required<CellState>();
}
