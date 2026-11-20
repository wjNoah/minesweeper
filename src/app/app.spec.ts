import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { SettingsService } from './services/settings.service';

/** The whole app with its real components, driven the way a player would. */
describe('App', () => {
  let fixture: ComponentFixture<App>;
  let host: HTMLElement;

  const cell = (row: number, col: number) =>
    host.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLButtonElement;
  const stat = (name: string) =>
    [...host.querySelectorAll('.stats div')]
      .find((d) => d.querySelector('dt')?.textContent === name)
      ?.querySelector('dd')?.textContent;
  const button = (label: string) =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

  beforeEach(async () => {
    localStorage.clear();
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('has one clear main heading with the game’s full name', () => {
    expect(host.querySelectorAll('h1').length).toBe(1);
    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Minesweeper Duel');
  });

  it('explains the game in text that people and search engines can read', () => {
    const headings = [...host.querySelectorAll('app-about h2')].map((h) => h.textContent);
    expect(headings).toContain('How to play Minesweeper');
    expect(headings).toContain('Minesweeper 1v1 against a friend or a bot');
    expect(host.querySelector('app-about')?.textContent).toContain('first click is always safe');
  });

  it('shows a Beginner board ready to play', () => {
    expect(host.querySelectorAll('app-board button').length).toBe(81);
    expect(stat('Mines')).toBe('10');
    expect(stat('Time')).toBe('0:00');
  });

  it('a click opens cells and the first click is safe', async () => {
    cell(4, 4).click();
    await fixture.whenStable();
    expect(cell(4, 4).classList.contains('hidden')).toBe(false);
    expect(host.querySelector('app-board .exploded')).toBeNull();
  });

  it('in Flag mode a click places a flag, and the mine counter goes down', async () => {
    button('Flag')?.click();
    await fixture.whenStable();
    cell(0, 0).click();
    await fixture.whenStable();

    expect(cell(0, 0).querySelector('svg.flag')).not.toBeNull();
    expect(stat('Mines')).toBe('9');
  });

  it('choosing a difficulty changes the board', async () => {
    button('Expert')?.click();
    await fixture.whenStable();
    expect(host.querySelectorAll('app-board button').length).toBe(480);
    expect(stat('Mines')).toBe('99');
  });

  it('New game clears the board', async () => {
    cell(4, 4).click();
    await fixture.whenStable();
    button('New game')?.click();
    await fixture.whenStable();
    expect(cell(4, 4).classList.contains('hidden')).toBe(true);
  });

  it('lists every way to flag in the controls hint', () => {
    const hint = host.querySelector('app-controls-hint')?.textContent ?? '';
    for (const way of ['Flag', 'Shift', 'right-click', 'two-finger', 'long press']) {
      expect(hint).toContain(way);
    }
  });

  it('can show only the game, with nothing below the board, and remembers it', async () => {
    TestBed.inject(SettingsService).update({ showGuide: false });
    await fixture.whenStable();
    expect(host.querySelector('app-controls-hint')).toBeNull();
    expect(host.querySelector('app-about')).toBeNull();
    expect(host.querySelector('.page-foot')).toBeNull();
    expect(host.querySelector('app-board')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('minesweeper.settings') ?? '{}').showGuide).toBe(false);
  });

  it('the switch for it is in the settings', async () => {
    host.querySelector<HTMLButtonElement>('[aria-label="Settings"]')?.click();
    await fixture.whenStable();
    const row = [...host.querySelectorAll('app-settings-dialog label.row')].find((r) =>
      r.textContent?.includes('Show controls, info and feedback'),
    );
    row?.querySelector('input')?.click();
    await fixture.whenStable();
    expect(host.querySelector('app-about')).toBeNull();
  });

  it('has a Quests button that says how many are done and opens the list', async () => {
    const quests = host.querySelector<HTMLButtonElement>('[aria-label^="Quests"]');
    expect(quests?.getAttribute('aria-label')).toBe('Quests, 0 of 13 done');
    quests?.click();
    await fixture.whenStable();
    expect(host.querySelector<HTMLDialogElement>('app-quests-dialog dialog')?.open).toBe(true);
  });

  it('the Modes button opens the modes; No guessing is no longer in the settings', async () => {
    button('Modes')?.click();
    await fixture.whenStable();
    expect(host.querySelector<HTMLDialogElement>('app-modes-dialog dialog')?.open).toBe(true);
    const settingsSwitches = [...host.querySelectorAll('app-settings-dialog label.row .label')];
    expect(settingsSwitches.map((l) => l.textContent?.trim())).not.toContain('No guessing');
    expect(host.querySelector('app-modes-dialog')?.textContent).toContain('No guessing');
  });

  it('opens the feedback and 1v1 dialogs from their buttons', async () => {
    button('Send feedback')?.click();
    await fixture.whenStable();
    expect(host.querySelector<HTMLDialogElement>('app-feedback-dialog dialog')?.open).toBe(true);

    button('1v1')?.click();
    await fixture.whenStable();
    expect(host.querySelector<HTMLDialogElement>('app-match-dialog dialog')?.open).toBe(true);
  });
});
