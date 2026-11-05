export interface CellState {
  row: number;
  col: number;
  hasMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  /** 1v1 time penalty: this mine was clicked. It stays marked and can't be unflagged. */
  isHit: boolean;
  adjacentMines: number;
}
