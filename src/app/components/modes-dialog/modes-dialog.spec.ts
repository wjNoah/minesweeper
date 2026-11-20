import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameService } from '../../services/game.service';
import { QUESTS_STORAGE_KEY } from '../../services/quest.service';
import { SettingsService } from '../../services/settings.service';
import { ModesDialog } from './modes-dialog';

describe('ModesDialog', () => {
  let fixture: ComponentFixture<ModesDialog>;
  let host: HTMLElement;

  const mode = (label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('.mode')].find(
      (m) => m.querySelector('.name')?.textContent === label,
    );

  function create(): void {
    fixture = TestBed.createComponent(ModesDialog);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => localStorage.clear());

  it('offers Normal and shows the locked modes with their quest', () => {
    create();
    expect(mode('Normal')?.getAttribute('aria-pressed')).toBe('true');
    expect(mode('Fog')?.classList).toContain('locked');
    expect(mode('Fog')?.getAttribute('aria-disabled')).toBe('true');
    expect(mode('Fog')?.querySelector('.lock')?.textContent).toContain('Expert');
    expect(mode('No flags')?.querySelector('.lock')?.textContent).toContain('Moving up');
  });

  it('a locked mode cannot be chosen', () => {
    create();
    mode('Fog')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(GameService).gameMode()).toBe('normal');
  });

  it('an unlocked mode can be chosen and is marked', () => {
    localStorage.setItem(
      QUESTS_STORAGE_KEY,
      JSON.stringify({ 'intermediate-win': { progress: 1, completedAt: 1 } }),
    );
    create();
    expect(mode('Mirror')?.classList).not.toContain('locked');
    mode('Mirror')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(GameService).gameMode()).toBe('mirror');
    expect(mode('Mirror')?.getAttribute('aria-pressed')).toBe('true');
    expect(mode('Normal')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('has the No guessing switch, which used to be in the settings', () => {
    create();
    const toggle = host.querySelector<HTMLInputElement>('input[role="switch"]');
    toggle?.click();
    expect(TestBed.inject(SettingsService).settings().noGuess).toBe(true);
  });
});
