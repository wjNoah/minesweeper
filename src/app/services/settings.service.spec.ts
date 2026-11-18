import { TestBed } from '@angular/core/testing';
import { SETTINGS_STORAGE_KEY, SettingsService } from './settings.service';

describe('SettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('saves changes to localStorage and applies the theme', () => {
    const service = TestBed.inject(SettingsService);
    service.update({ theme: 'dark', cellScale: 1.25 });
    TestBed.tick();

    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.theme).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--cell-scale')).toBe('1.25');
  });

  it('loads saved settings', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ chordOnClick: false }));
    expect(TestBed.inject(SettingsService).settings().chordOnClick).toBe(false);
  });

  it('the system theme removes the forced theme from the page', () => {
    const service = TestBed.inject(SettingsService);
    service.update({ theme: 'dark' });
    TestBed.tick();
    service.update({ theme: 'system' });
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('starts with the defaults when the saved settings are broken', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');
    expect(TestBed.inject(SettingsService).settings().keys.flag).toBe('f');
  });

  it('settings still apply for this visit when storage is full or blocked', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const service = TestBed.inject(SettingsService);
    service.update({ theme: 'dark' });
    expect(() => TestBed.tick()).not.toThrow();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    setItem.mockRestore();
  });

  it('toggleTheme switches between light and dark', () => {
    const service = TestBed.inject(SettingsService);
    service.update({ theme: 'light' });
    service.toggleTheme();
    expect(service.settings().theme).toBe('dark');
    service.toggleTheme();
    expect(service.settings().theme).toBe('light');
  });

  it('reset restores the defaults', () => {
    const service = TestBed.inject(SettingsService);
    service.setKey('flag', 'q');
    service.reset();
    expect(service.settings().keys.flag).toBe('f');
  });

  it('reset keeps the look, which belongs to the customize dialog', () => {
    const service = TestBed.inject(SettingsService);
    service.update({ theme: 'dark', cellScale: 1.5, haptics: false });
    service.reset();

    expect(service.settings().haptics).toBe(true);
    expect(service.settings().theme).toBe('dark');
    expect(service.settings().cellScale).toBe(1.5);
  });

  it('resetLook restores the theme and cell size only', () => {
    const service = TestBed.inject(SettingsService);
    service.update({ theme: 'dark', cellScale: 1.5, haptics: false });
    service.resetLook();

    expect(service.settings().theme).toBe('system');
    expect(service.settings().cellScale).toBe(1);
    expect(service.settings().haptics).toBe(false);
  });
});
