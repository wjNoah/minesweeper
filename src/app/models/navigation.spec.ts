import { cursorStep } from './navigation';

describe('cursorStep', () => {
  it('moves with the arrow keys', () => {
    expect(cursorStep({ key: 'ArrowUp', code: 'ArrowUp' })).toEqual({ row: -1, col: 0 });
    expect(cursorStep({ key: 'ArrowDown', code: 'ArrowDown' })).toEqual({ row: 1, col: 0 });
    expect(cursorStep({ key: 'ArrowLeft', code: 'ArrowLeft' })).toEqual({ row: 0, col: -1 });
    expect(cursorStep({ key: 'ArrowRight', code: 'ArrowRight' })).toEqual({ row: 0, col: 1 });
  });

  it('moves with W A S D', () => {
    expect(cursorStep({ key: 'w', code: 'KeyW' })).toEqual({ row: -1, col: 0 });
    expect(cursorStep({ key: 's', code: 'KeyS' })).toEqual({ row: 1, col: 0 });
    expect(cursorStep({ key: 'a', code: 'KeyA' })).toEqual({ row: 0, col: -1 });
    expect(cursorStep({ key: 'd', code: 'KeyD' })).toEqual({ row: 0, col: 1 });
  });

  it('works with Caps Lock or Shift, because it reads the physical key', () => {
    expect(cursorStep({ key: 'W', code: 'KeyW' })).toEqual({ row: -1, col: 0 });
  });

  it('uses the physical key on other layouts (AZERTY: the key at W types Z)', () => {
    expect(cursorStep({ key: 'z', code: 'KeyW' })).toEqual({ row: -1, col: 0 });
    expect(cursorStep({ key: 'w', code: 'KeyZ' })).toBeNull();
  });

  it('ignores every other key, including inherited object names', () => {
    expect(cursorStep({ key: 'f', code: 'KeyF' })).toBeNull();
    expect(cursorStep({ key: 'Enter', code: 'Enter' })).toBeNull();
    expect(cursorStep({ key: 'constructor', code: 'constructor' })).toBeNull();
  });
});
