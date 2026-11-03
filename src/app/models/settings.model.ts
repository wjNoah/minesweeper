export type ThemeSetting = 'system' | 'light' | 'dark';
export type CellScale = 1 | 1.25 | 1.5;
export type KeyAction = 'flag' | 'reveal' | 'newGame' | 'flagMode' | 'hint';
export type KeyBindings = Record<KeyAction, string>;

export interface Settings {
  theme: ThemeSetting;
  cellScale: CellScale;
  /** First click opens an area (clicked cell and neighbors are mine-free), not just one cell. */
  safeArea: boolean;
  /** Only deal boards that can be solved by logic alone from the first click. */
  noGuess: boolean;
  /** A single click on a number chords. Double-click always chords. */
  chordOnClick: boolean;
  /** Mark the hidden neighbors of the number under the pointer or keyboard cursor. */
  highlightNeighbors: boolean;
  haptics: boolean;
  /** Values are KeyboardEvent.key in lower case, so they follow the user's keyboard layout. */
  keys: KeyBindings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  cellScale: 1,
  safeArea: true,
  noGuess: false,
  chordOnClick: true,
  highlightNeighbors: true,
  haptics: true,
  keys: { flag: 'f', reveal: ' ', newGame: 'r', flagMode: 'm', hint: 'h' },
};

export const KEY_ACTIONS: readonly { id: KeyAction; label: string }[] = [
  { id: 'reveal', label: 'Reveal or open neighbors' },
  { id: 'flag', label: 'Flag' },
  { id: 'flagMode', label: 'Switch Reveal / Flag' },
  { id: 'hint', label: 'Hint' },
  { id: 'newGame', label: 'New game' },
];

export const CELL_SCALES: readonly { value: CellScale; label: string }[] = [
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Large' },
  { value: 1.5, label: 'Extra large' },
];

/** Keys with a fixed meaning (moving, Enter to reveal, leaving the board or a dialog). */
const RESERVED_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', 'tab', 'escape'];

/** Only single characters (letters, digits, symbols, Space) can be bound. */
export function isBindableKey(key: string): boolean {
  return key.length === 1 && !RESERVED_KEYS.includes(key.toLowerCase());
}

/** Binds a key to an action. If another action used that key, the two swap keys. */
export function rebindKey(keys: KeyBindings, action: KeyAction, key: string): KeyBindings {
  const normalized = key.toLowerCase();
  const next = { ...keys, [action]: normalized };
  const other = (Object.keys(keys) as KeyAction[]).find(
    (id) => id !== action && keys[id] === normalized,
  );
  if (other) next[other] = keys[action];
  return next;
}

export function keyLabel(key: string): string {
  return key === ' ' ? 'Space' : key.toUpperCase();
}

/** Reads stored settings. Anything missing or invalid falls back to the default. */
export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return structuredClone(DEFAULT_SETTINGS);
  const stored = value as Record<string, unknown>;
  const pick = <T>(key: string, valid: readonly T[], fallback: T): T =>
    valid.includes(stored[key] as T) ? (stored[key] as T) : fallback;
  const bool = (key: keyof Settings & string, fallback: boolean): boolean => {
    const value = stored[key];
    return typeof value === 'boolean' ? value : fallback;
  };

  return {
    theme: pick<ThemeSetting>('theme', ['system', 'light', 'dark'], DEFAULT_SETTINGS.theme),
    cellScale: pick<CellScale>(
      'cellScale',
      CELL_SCALES.map((s) => s.value),
      DEFAULT_SETTINGS.cellScale,
    ),
    safeArea: bool('safeArea', DEFAULT_SETTINGS.safeArea),
    noGuess: bool('noGuess', DEFAULT_SETTINGS.noGuess),
    chordOnClick: bool('chordOnClick', DEFAULT_SETTINGS.chordOnClick),
    highlightNeighbors: bool('highlightNeighbors', DEFAULT_SETTINGS.highlightNeighbors),
    haptics: bool('haptics', DEFAULT_SETTINGS.haptics),
    keys: parseKeys(stored['keys']),
  };
}

function parseKeys(value: unknown): KeyBindings {
  const keys = { ...DEFAULT_SETTINGS.keys };
  if (typeof value !== 'object' || value === null) return keys;
  const stored = value as Record<string, unknown>;
  for (const { id } of KEY_ACTIONS) {
    const key = stored[id];
    if (typeof key === 'string' && isBindableKey(key)) keys[id] = key.toLowerCase();
  }
  // Two actions on one key would make one of them unreachable.
  const unique = new Set(Object.values(keys));
  return unique.size === KEY_ACTIONS.length ? keys : { ...DEFAULT_SETTINGS.keys };
}
