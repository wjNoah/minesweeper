# CLAUDE.md

## Project

Build a Minesweeper web game in the existing Angular starter project (Angular, TypeScript, SCSS, standalone components, signals). It's a school project, so the code should be clean, readable, and easy to explain in a presentation.

## Current structure

- `src/app/models/cell.model.ts`: `CellState` (row, col, hasMine, isRevealed, isFlagged, adjacentMines)
- `src/app/services/game.service.ts`: game state as signals, all game logic lives here
- `src/app/components/board`: renders the grid
- `src/app/components/cell`: renders one cell, emits user input

Keep this structure. Components stay dumb (display and emit events), the service holds the logic.

## Core features

Build in this order, one step at a time, and run the app and tests after each.

1. Board generation with mines and adjacent counts. The first click is always safe, and mines are placed after it.
2. Reveal a cell. Flood fill (iterative, not recursive) opens empty regions.
3. Flag and unflag a cell, with a remaining-mines counter.
4. Win and lose detection, plus a restart button.
5. Difficulty levels: beginner 9x9/10, intermediate 16x16/40, expert 30x16/99, and a custom size.
6. Timer that starts on the first reveal.
7. Best times per difficulty in localStorage.

## Input: must be fully playable on a laptop trackpad

Never require a right-click, a middle-click, or a hold as the only way to do something. Provide several input methods for every action:

- **Reveal:** click or tap.
- **Flag:** any of these must work:
  - a) Flag mode toggle button in the UI (when on, click places or removes flags). Show a clear active state.
  - b) Keyboard: press F (or Shift+Click) while hovering a cell.
  - c) Two-finger click or right-click (handle the `contextmenu` event and call `preventDefault` on the board).
  - d) Long press on touch screens (about 400 ms) with a small haptic or visual cue.
- **Chording** (click a revealed number to open its neighbors when the flag count matches): double-click, or press Space while hovering the number, or Shift+Click.
- **Keyboard play:** arrow keys move a focus cursor across the board, Enter/Space reveals, F flags, R restarts. The focused cell needs a visible outline.

Also:

- Use Pointer Events, not mouse-only events, and set `touch-action: manipulation` and `user-select: none` on the board to avoid accidental zoom or text selection.
- No drag gestures and no hover-only features. Cells are at least 32px, and larger on small screens.
- Show a short controls hint under the board listing all input methods.

## Tech requirements

- Signals for state, OnPush change detection, and the new control flow (`@if`, `@for` with `track`).
- Strict TypeScript, no `any`. Pure functions for board logic so they're easy to unit test.
- Unit tests (Jasmine/Karma as in the project) for: mine placement, first-click safety, adjacent counts, flood fill, flagging, chording, win and lose.
- Accessibility: buttons for cells, aria-labels (for example "row 3, column 5, flagged"), good color contrast, number colors that don't rely on color alone.
- Responsive layout that is playable at laptop size and on a phone. Support a dark mode through CSS variables.

## Style and process

- Small commits with clear messages, one per feature step.
- Short comments only where the logic isn't obvious (flood fill, first-click safety).
- Don't add libraries unless I ask. Plain Angular and SCSS only.
- At the end of each step, tell me what changed and how to try it manually.

## Nice-to-have (only after the core is done and I confirm)

- Hint button that uses a real solver
- Seeded daily board
- Sound and animations
- Deploy to GitHub Pages
