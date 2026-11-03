import { Injectable, signal } from '@angular/core';
import { CellState } from '../models/cell.model';

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly board = signal<CellState[][]>([]);

  // TODO: board generation, reveal, flag, win/lose logic
}
