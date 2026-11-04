export interface Position {
  row: number;
  col: number;
}

const UP: Position = { row: -1, col: 0 };
const DOWN: Position = { row: 1, col: 0 };
const LEFT: Position = { row: 0, col: -1 };
const RIGHT: Position = { row: 0, col: 1 };

const ARROWS = new Map<string, Position>([
  ['ArrowUp', UP],
  ['ArrowDown', DOWN],
  ['ArrowLeft', LEFT],
  ['ArrowRight', RIGHT],
]);

// KeyboardEvent.code is the physical key, so W A S D stay in the same place on any layout.
const WASD = new Map<string, Position>([
  ['KeyW', UP],
  ['KeyS', DOWN],
  ['KeyA', LEFT],
  ['KeyD', RIGHT],
]);

/** How a key press moves the keyboard cursor: arrow keys or W A S D. Null for other keys. */
export function cursorStep(event: Pick<KeyboardEvent, 'key' | 'code'>): Position | null {
  return ARROWS.get(event.key) ?? WASD.get(event.code) ?? null;
}
