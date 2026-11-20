import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computeAdjacentCounts, createEmptyBoard, Grid } from '../../services/board-logic';
import { GameService } from '../../services/game.service';
import { SettingsService } from '../../services/settings.service';
import { Board } from './board';

/** '*' is a mine, '.' is empty. */
function gridFromLayout(layout: string[]): Grid {
  const grid = createEmptyBoard(layout.length, layout[0].length);
  layout.forEach((line, row) =>
    [...line].forEach((char, col) => (grid[row][col].hasMine = char === '*')),
  );
  return computeAdjacentCounts(grid);
}

describe('Board', () => {
  let fixture: ComponentFixture<Board>;
  let game: GameService;
  let host: HTMLElement;

  const cell = (row: number, col: number) =>
    host.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLButtonElement;
  const focused = () => {
    const active = document.activeElement as HTMLElement;
    return [Number(active.dataset['row']), Number(active.dataset['col'])];
  };

  /** Presses a key on whatever has focus, as a real keyboard does. */
  function press(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      code: options.code ?? '',
      bubbles: true,
      cancelable: true,
      ...options,
    });
    (document.activeElement ?? document.body).dispatchEvent(event);
    refresh();
    return event;
  }

  function refresh(): void {
    TestBed.tick();
    fixture.detectChanges();
  }

  function focusCell(row: number, col: number): void {
    cell(row, col).focus();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    // Not available in the test browser (jsdom).
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0)),
    );
    Element.prototype.scrollIntoView = () => undefined;

    fixture = TestBed.createComponent(Board);
    game = TestBed.inject(GameService);
    game.setDifficulty('beginner');
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host); // Focus only works on elements in the page.
  });

  afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
  });

  it('shows a real button for every cell', () => {
    expect(host.querySelectorAll('button').length).toBe(81);
    game.setDifficulty('expert');
    refresh();
    expect(host.querySelectorAll('button').length).toBe(480);
  });

  it('can be reached with Tab through exactly one cell', () => {
    const reachable = [...host.querySelectorAll('button')].filter((b) => b.tabIndex === 0);
    expect(reachable.length).toBe(1);
  });

  it('keeps the browser menu closed for a right-click anywhere on the board', () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    host.querySelector('.board')?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('a click reveals the cell', () => {
    cell(4, 4).click();
    fixture.detectChanges();
    expect(game.board()[4][4].isRevealed).toBe(true);
  });

  describe('filling the screen', () => {
    const settings = () => TestBed.inject(SettingsService);
    const cellSize = () =>
      (fixture.nativeElement as HTMLElement).style.getPropertyValue('--cell-size');

    /** The test browser has no layout, so this gives the page a size. */
    function pageSize(width: number, height: number): void {
      Object.defineProperty(host.parentElement, 'clientWidth', {
        value: width,
        configurable: true,
      });
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(height);
    }

    async function settle(): Promise<void> {
      refresh();
      await new Promise((resolve) => setTimeout(resolve));
      refresh();
    }

    afterEach(() => vi.restoreAllMocks());

    it('keeps the normal cell size while the controls and info are shown', async () => {
      pageSize(1200, 900);
      await settle();
      expect(cellSize()).toBe('');
    });

    it('grows the cells to fill the space when only the game is shown', async () => {
      pageSize(1200, 900);
      settings().update({ showGuide: false });
      await settle();
      // The height decides: 900px, 24px of board frame and 8 gaps, shared by 9 rows.
      expect(cellSize()).toBe('72px');

      pageSize(1200, 500);
      window.dispatchEvent(new Event('resize'));
      await settle();
      expect(cellSize()).toBe('50px');
    });

    it('goes back to the normal size when the controls are shown again', async () => {
      pageSize(1200, 900);
      settings().update({ showGuide: false });
      await settle();
      settings().update({ showGuide: true });
      await settle();
      expect(cellSize()).toBe('');
    });
  });

  describe('modes', () => {
    beforeEach(() => {
      // Mirror and Fog are unlocked by the Intermediate and Expert quests.
      localStorage.setItem(
        'minesweeper.quests',
        JSON.stringify({
          'intermediate-win': { progress: 1, completedAt: 1 },
          'expert-win': { progress: 1, completedAt: 1 },
        }),
      );
    });

    function useMode(mode: 'mirror' | 'fog'): void {
      // The quest progress above is read when the services start, so start them now.
      TestBed.resetTestingModule();
      fixture = TestBed.createComponent(Board);
      game = TestBed.inject(GameService);
      game.setDifficulty('beginner');
      game.setGameMode(mode);
      refresh();
      host.remove();
      host = fixture.nativeElement as HTMLElement;
      document.body.appendChild(host);
    }

    it('Mirror: a click opens the mirrored cell, and the clicked one stays closed', () => {
      useMode('mirror');
      // Fixed mines next to both cells, so each is a number and opens alone.
      game.board.set(
        gridFromLayout([
          '.........',
          '.........',
          '.........',
          '........*',
          '*........',
          '.........',
          '.........',
          '.........',
          '.........',
        ]),
      );
      game.status.set('playing');
      refresh();
      cell(4, 1).click();
      refresh();
      expect(game.board()[4][7].isRevealed).toBe(true);
      expect(game.board()[4][1].isRevealed).toBe(false);
    });

    it('Mirror: a right-click and the F key flag the mirrored cell too', () => {
      useMode('mirror');
      cell(0, 0).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      expect(game.board()[0][8].isFlagged).toBe(true);

      focusCell(2, 2);
      press('f');
      expect(game.board()[2][6].isFlagged).toBe(true);
    });

    it('tells the cells which mode is played, so Fog can fade the numbers', () => {
      useMode('fog');
      expect(host.querySelector('.board')?.getAttribute('data-game-mode')).toBe('fog');
    });
  });

  describe('keyboard play', () => {
    it('moves the focus with the arrow keys', () => {
      focusCell(4, 4);
      press('ArrowUp', { code: 'ArrowUp' });
      expect(focused()).toEqual([3, 4]);
      press('ArrowRight', { code: 'ArrowRight' });
      expect(focused()).toEqual([3, 5]);
      press('ArrowDown', { code: 'ArrowDown' });
      expect(focused()).toEqual([4, 5]);
      press('ArrowLeft', { code: 'ArrowLeft' });
      expect(focused()).toEqual([4, 4]);
    });

    it('moves the focus with W A S D', () => {
      focusCell(4, 4);
      press('w', { code: 'KeyW' });
      expect(focused()).toEqual([3, 4]);
      press('d', { code: 'KeyD' });
      expect(focused()).toEqual([3, 5]);
    });

    it('stops at the edge of the board', () => {
      focusCell(0, 0);
      press('ArrowUp', { code: 'ArrowUp' });
      press('ArrowLeft', { code: 'ArrowLeft' });
      expect(focused()).toEqual([0, 0]);

      // The cursor really stayed on the board: one step back moves one cell.
      press('ArrowDown', { code: 'ArrowDown' });
      press('ArrowRight', { code: 'ArrowRight' });
      expect(focused()).toEqual([1, 1]);

      focusCell(8, 8);
      press('ArrowDown', { code: 'ArrowDown' });
      press('ArrowRight', { code: 'ArrowRight' });
      expect(focused()).toEqual([8, 8]);
    });

    it('moves the Tab stop along, so Tab returns to the same cell', () => {
      focusCell(4, 4);
      press('ArrowUp', { code: 'ArrowUp' });
      expect(cell(3, 4).tabIndex).toBe(0);
      expect(cell(4, 4).tabIndex).toBe(-1);
    });

    it('Enter and Space reveal, without also clicking the button or scrolling', () => {
      focusCell(4, 4);
      expect(press('Enter').defaultPrevented).toBe(true);
      expect(game.board()[4][4].isRevealed).toBe(true);

      game.newGame();
      refresh();
      focusCell(1, 1);
      expect(press(' ').defaultPrevented).toBe(true);
      expect(game.board()[1][1].isRevealed).toBe(true);
    });

    it('Space on a revealed number chords', () => {
      game.board.set(gridFromLayout(['*..', '...', '...']));
      game.status.set('playing');
      game.reveal(0, 1);
      game.toggleFlag(0, 0);
      refresh();
      focusCell(0, 1);
      press(' ');
      expect(game.board()[1][1].isRevealed).toBe(true);
    });

    it('F flags the focused cell, and pressing it again removes the flag', () => {
      focusCell(2, 3);
      press('f');
      expect(game.board()[2][3].isFlagged).toBe(true);
      press('f');
      expect(game.board()[2][3].isFlagged).toBe(false);
    });

    it('F flags the cell under the pointer, without clicking anything', () => {
      cell(5, 5).dispatchEvent(new Event('pointerenter'));
      press('f');
      expect(game.board()[5][5].isFlagged).toBe(true);
    });

    it('F does nothing when no cell is focused or pointed at', () => {
      press('f');
      expect(
        game
          .board()
          .flat()
          .some((c) => c.isFlagged),
      ).toBe(false);
    });

    it('R restarts and M switches the flag mode', () => {
      game.reveal(4, 4);
      press('r');
      expect(game.status()).toBe('ready');

      press('m');
      expect(game.flagMode()).toBe(true);
      press('m');
      expect(game.flagMode()).toBe(false);
    });

    it('a held key does not repeat a flag or a reveal, but moving does repeat', () => {
      focusCell(4, 4);
      press('f');
      press('f', { repeat: true });
      press('f', { repeat: true });
      expect(game.board()[4][4].isFlagged).toBe(true);

      press('ArrowUp', { code: 'ArrowUp' });
      press('ArrowUp', { code: 'ArrowUp', repeat: true });
      expect(focused()).toEqual([2, 4]);
    });

    it('a held Enter does not click the focused button by itself', () => {
      focusCell(4, 4);
      expect(press('Enter', { repeat: true }).defaultPrevented).toBe(true);
      expect(game.board()[4][4].isRevealed).toBe(false);
    });

    it('ignores keys with Ctrl or Cmd, like Cmd + R to reload the page', () => {
      game.reveal(4, 4);
      press('r', { metaKey: true });
      expect(game.status()).toBe('playing');
    });

    it('ignores typing in a text field or a dialog', () => {
      game.reveal(4, 4);
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      press('r');
      input.remove();
      expect(game.status()).toBe('playing');
    });

    it('in a match, R and H do nothing, so nobody can restart or get a hint', () => {
      game.prepareMatch('beginner', 'defeat', 10);
      game.startMatchRound(gridFromLayout(Array(9).fill('*........')), { row: 4, col: 4 });
      refresh();

      press('r');
      expect(game.status()).toBe('playing');
      press('h');
      expect(game.hint()).toBeNull();
    });
  });
});
