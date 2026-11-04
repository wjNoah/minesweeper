import { RandomFn } from './board-logic';

/**
 * Letters and digits that can't be mixed up when read aloud or typed:
 * no 0/O and no 1/I/L. The relay (relay/src/index.ts) accepts the same ones.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

/** A random room code such as "K7XPM". About 28 million are possible. */
export function createRoomCode(random: RandomFn = secureRandom): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Cleans up what a player typed ("k7x pm" → "K7XPM"). Returns null if it can't be a code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((char) => ROOM_CODE_ALPHABET.includes(char)) ? code : null;
}

/** Unpredictable, so nobody can guess the code of a room that is about to be created. */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
