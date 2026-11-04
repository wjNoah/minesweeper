import { computed, effect, Injectable, signal } from '@angular/core';
import {
  DEFAULT_SETTINGS,
  KeyAction,
  parseSettings,
  rebindKey,
  Settings,
} from '../models/settings.model';

export const SETTINGS_STORAGE_KEY = 'minesweeper.settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<Settings>(loadSettings());

  private readonly systemDark = signal(prefersDark());
  /** The theme actually shown, with 'system' resolved. */
  readonly effectiveTheme = computed(() => {
    const theme = this.settings().theme;
    return theme === 'system' ? (this.systemDark() ? 'dark' : 'light') : theme;
  });

  constructor() {
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) =>
        this.systemDark.set(event.matches),
      );
    }

    effect(() => {
      const settings = this.settings();
      const root = document.documentElement;
      if (settings.theme === 'system') {
        delete root.dataset['theme'];
      } else {
        root.dataset['theme'] = settings.theme;
      }
      root.style.setProperty('--cell-scale', String(settings.cellScale));
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // Storage can be full or blocked. Settings still apply for this visit.
      }
    });
  }

  update(changes: Partial<Settings>): void {
    this.settings.update((settings) => ({ ...settings, ...changes }));
  }

  setKey(action: KeyAction, key: string): void {
    this.settings.update((settings) => ({
      ...settings,
      keys: rebindKey(settings.keys, action, key),
    }));
  }

  toggleTheme(): void {
    this.update({ theme: this.effectiveTheme() === 'dark' ? 'light' : 'dark' });
  }

  /** Restores gameplay options and keys. The look (theme, cell size) is reset in Customize. */
  reset(): void {
    this.settings.update(({ theme, cellScale }) => ({
      ...structuredClone(DEFAULT_SETTINGS),
      theme,
      cellScale,
    }));
  }

  resetLook(): void {
    this.update({ theme: DEFAULT_SETTINGS.theme, cellScale: DEFAULT_SETTINGS.cellScale });
  }
}

function loadSettings(): Settings {
  try {
    return parseSettings(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? 'null'));
  } catch {
    return parseSettings(null);
  }
}

function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}
