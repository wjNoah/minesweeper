import { createRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET } from './room-code';

describe('room codes', () => {
  it('creates 5 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 100; i++) {
      const code = createRoomCode();
      expect(code).toMatch(/^[A-Z2-9]{5}$/);
      expect([...code].every((char) => ROOM_CODE_ALPHABET.includes(char))).toBe(true);
    }
  });

  it('never uses characters that look alike', () => {
    for (const char of '01ILO') expect(ROOM_CODE_ALPHABET).not.toContain(char);
  });

  it('covers the whole alphabet with the given random function', () => {
    expect(createRoomCode(() => 0)).toBe('AAAAA');
    expect(createRoomCode(() => 0.9999)).toBe('99999');
  });

  it('accepts what people type: lower case, spaces and dashes', () => {
    expect(normalizeRoomCode('k7xpm')).toBe('K7XPM');
    expect(normalizeRoomCode(' K7X-PM ')).toBe('K7XPM');
    expect(normalizeRoomCode('k7x pm')).toBe('K7XPM');
  });

  it('rejects anything that cannot be a code', () => {
    expect(normalizeRoomCode('')).toBeNull();
    expect(normalizeRoomCode('K7XP')).toBeNull();
    expect(normalizeRoomCode('K7XPMM')).toBeNull();
    expect(normalizeRoomCode('K0XPM')).toBeNull();
    expect(normalizeRoomCode('K7XP/')).toBeNull();
  });
});
