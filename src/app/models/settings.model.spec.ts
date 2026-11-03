import {
  DEFAULT_SETTINGS,
  isBindableKey,
  keyLabel,
  parseSettings,
  rebindKey,
} from './settings.model';

describe('parseSettings', () => {
  it('returns the defaults for missing or broken data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and replaces invalid ones', () => {
    const settings = parseSettings({ theme: 'dark', cellScale: 7, haptics: false, safeArea: 'no' });
    expect(settings.theme).toBe('dark');
    expect(settings.cellScale).toBe(1);
    expect(settings.haptics).toBe(false);
    expect(settings.safeArea).toBe(true);
  });

  it('falls back to default keys when two actions share a key', () => {
    const settings = parseSettings({
      keys: { flag: 'x', reveal: 'x', newGame: 'r', flagMode: 'm' },
    });
    expect(settings.keys).toEqual(DEFAULT_SETTINGS.keys);
  });

  it('ignores reserved keys in stored bindings', () => {
    const settings = parseSettings({ keys: { flag: 'Enter' } });
    expect(settings.keys.flag).toBe('f');
  });
});

describe('rebindKey', () => {
  it('binds a new key in lower case', () => {
    expect(rebindKey(DEFAULT_SETTINGS.keys, 'flag', 'X').flag).toBe('x');
  });

  it('swaps keys when the new key belongs to another action', () => {
    const keys = rebindKey(DEFAULT_SETTINGS.keys, 'flag', 'r');
    expect(keys.flag).toBe('r');
    expect(keys.newGame).toBe('f');
  });
});

describe('isBindableKey and keyLabel', () => {
  it('allows single characters and Space, but not fixed keys', () => {
    expect(isBindableKey('q')).toBe(true);
    expect(isBindableKey(' ')).toBe(true);
    expect(isBindableKey('ArrowUp')).toBe(false);
    expect(isBindableKey('Enter')).toBe(false);
    expect(isBindableKey('Shift')).toBe(false);
  });

  it('shows readable labels', () => {
    expect(keyLabel(' ')).toBe('Space');
    expect(keyLabel('f')).toBe('F');
  });
});
