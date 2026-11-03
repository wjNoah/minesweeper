# Minesweeper (Angular starter)

Empty starter, no game logic yet.

    npm install
    npm start      # http://localhost:4200
    npm test

Structure:
- src/app/models/cell.model.ts      cell data shape
- src/app/services/game.service.ts  game state (signals), logic goes here
- src/app/components/board          renders the grid
- src/app/components/cell           single cell
