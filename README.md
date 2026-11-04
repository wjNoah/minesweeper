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

## Deploying (Netlify)

The settings live in [`netlify.toml`](netlify.toml), so the website form can stay at its defaults.

1. Push to GitHub and merge into `main` (Netlify builds the branch you choose, here `main`).
2. On Netlify: _Add new project_ → _Import from Git_ → pick the repository. Netlify reads
   `netlify.toml`: build command `npm run build`, publish folder `dist/minesweeper/browser`,
   Node 24.
3. Optional: _Domain management_ → _Add a domain_. HTTPS is set up automatically.

What the config does:

- **Security headers** on every file: a strict Content-Security-Policy (only the site's own files
  run or load, no inline scripts), no framing, no referrer, no camera/microphone/location,
  https only, `nosniff`.
- **Caching:** files with a hash in their name are cached for a year; `index.html` and
  `early-theme.js` are always checked for a new version.
- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the tests, the production
  build and `npm audit` on every pull request. Dependabot opens update pull requests weekly.

To try the production build locally: `npm run build`, then serve `dist/minesweeper/browser`.
The 1v1 mode needs two devices on the same network; on the deployed (https) site the Copy and
Share buttons for the invite codes work too.

## Security notes

The game has no server, no accounts and makes no network requests, so there is little to attack.
The few places that take outside data are checked:

- **1v1 codes** are limited in size, and only addresses inside the local network are accepted.
  A crafted code cannot make the browser contact anything on the internet.
- **1v1 messages** from the opponent must be whole numbers in a sane range and fit the board; the
  opponent cannot crash the game with bad positions. A modified browser can still lie about its
  time, which is fine for playing with friends.
- **Pictures** are limited to PNG, JPEG, WebP and GIF up to 15 MB (no SVG), are re-encoded in the
  browser, and are saved as plain base64 data that is checked again whenever it is read.
- **Everything is stored in the browser only** (`localStorage`): settings, best times, pictures.
- `npm run start:lan` opens the _development_ server to your network. Use it only on a network you
  trust, and not for the public site.
