# Minesweeper

Minesweeper in Angular (signals, standalone components, SCSS). Includes difficulty levels,
best times, no-guess boards, hints, settings with rebindable keys, a dark mode and a 1v1 mode
for two devices on the same network.

    npm install
    npm start          # http://localhost:4200
    npm run start:lan  # also reachable from other devices on the network (for 1v1)
    npm test

Structure:

- `src/app/models`: data shapes and pure rule functions (cell, game, settings, match)
- `src/app/services`: game state (signals) and logic: board, solver, settings, 1v1
- `src/app/components`: board, cell, header, dialogs and the 1v1 match bar

Docs:

- [1v1 mode: how to play, test and troubleshoot](docs/1v1.md)
