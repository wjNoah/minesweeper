import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APPEARANCE_KEY, AppearanceService } from '../../services/appearance.service';
import { QUESTS_STORAGE_KEY } from '../../services/quest.service';
import { CustomizeDialog } from './customize-dialog';

describe('CustomizeDialog themes', () => {
  let fixture: ComponentFixture<CustomizeDialog>;
  let host: HTMLElement;

  const theme = (id: string) =>
    host.querySelector<HTMLButtonElement>(`.theme[data-board-theme="${id}"]`);

  function create(): void {
    fixture = TestBed.createComponent(CustomizeDialog);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => localStorage.clear());

  it('shows all seventeen themes, eleven of them locked at first', () => {
    create();
    expect(host.querySelectorAll('.theme').length).toBe(17);
    expect(host.querySelectorAll('.theme.locked').length).toBe(11);
  });

  it('marks a quest theme as locked and names the quest, also for screen readers', () => {
    create();
    const neon = theme('neon');
    expect(neon?.classList).toContain('locked');
    expect(neon?.getAttribute('aria-disabled')).toBe('true');
    expect(neon?.querySelector('.lock')?.textContent?.trim()).toBe('Hot streak');
    expect(neon?.getAttribute('aria-label')).toBe(
      'Neon Nights, locked. Quest: Win 3 games in a row. A loss starts the count again',
    );
  });

  it('the original themes are never locked', () => {
    create();
    expect(theme('ocean')?.classList).not.toContain('locked');
    expect(theme('ocean')?.getAttribute('aria-label')).toBeNull();
  });

  it('clicking a locked theme changes nothing', () => {
    create();
    theme('neon')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(AppearanceService).activeTheme()).toBe('classic');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBeNull();
  });

  it('an unlocked quest theme can be chosen', () => {
    localStorage.setItem(
      QUESTS_STORAGE_KEY,
      JSON.stringify({ streak: { progress: 3, completedAt: 5 } }),
    );
    create();
    expect(theme('neon')?.classList).not.toContain('locked');
    theme('neon')?.click();
    fixture.detectChanges();
    expect(theme('neon')?.getAttribute('aria-pressed')).toBe('true');
  });
});
