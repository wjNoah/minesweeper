import { DEFAULT_APPEARANCE, isBoardThemeId, parseAppearance } from './appearance.model';

describe('parseAppearance', () => {
  it('returns the defaults for missing or broken data', () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance('ocean')).toEqual(DEFAULT_APPEARANCE);
  });

  it('keeps valid choices and replaces unknown ones', () => {
    expect(parseAppearance({ boardTheme: 'forest', tileImageMode: 'board' })).toEqual({
      boardTheme: 'forest',
      tileImageMode: 'board',
    });
    expect(parseAppearance({ boardTheme: 'disco', tileImageMode: 'huge' })).toEqual(
      DEFAULT_APPEARANCE,
    );
  });

  it('knows the theme ids', () => {
    expect(isBoardThemeId('slate')).toBe(true);
    expect(isBoardThemeId('disco')).toBe(false);
  });
});
