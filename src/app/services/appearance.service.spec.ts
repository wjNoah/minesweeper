import { TestBed } from '@angular/core/testing';
import {
  APPEARANCE_KEY,
  AppearanceService,
  FLAG_IMAGE_KEY,
  isSafeImage,
  MINE_IMAGE_KEY,
  PAGE_IMAGE_KEY,
  TILE_IMAGE_KEY,
} from './appearance.service';
import { ImageError } from './image-resize';

const TINY_IMAGE = 'data:image/png;base64,iVBORw0KGgo=';
const root = document.documentElement;

describe('AppearanceService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete root.dataset['boardTheme'];
    delete root.dataset['pageImage'];
    delete root.dataset['tileImage'];
    delete root.dataset['flagImage'];
    delete root.dataset['mineImage'];
    for (const name of ['--page-image', '--tile-image', '--flag-image', '--mine-image']) {
      root.style.removeProperty(name);
    }
  });

  it('applies and saves the board theme', () => {
    const service = TestBed.inject(AppearanceService);
    service.setBoardTheme('ocean');
    TestBed.tick();

    expect(root.dataset['boardTheme']).toBe('ocean');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}').boardTheme).toBe('ocean');
  });

  it('applies stored pictures at startup', () => {
    localStorage.setItem(PAGE_IMAGE_KEY, TINY_IMAGE);
    localStorage.setItem(TILE_IMAGE_KEY, TINY_IMAGE);
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ tileImageMode: 'board' }));
    TestBed.inject(AppearanceService);
    TestBed.tick();

    expect(root.dataset['pageImage']).toBe('on');
    expect(root.dataset['tileImage']).toBe('board');
    expect(root.style.getPropertyValue('--tile-image')).toContain(TINY_IMAGE);
  });

  it('ignores stored values that are not pictures', () => {
    localStorage.setItem(PAGE_IMAGE_KEY, 'javascript:alert(1)');
    expect(TestBed.inject(AppearanceService).pageImage()).toBeNull();
  });

  it('removes a picture from the page and from storage', () => {
    localStorage.setItem(PAGE_IMAGE_KEY, TINY_IMAGE);
    const service = TestBed.inject(AppearanceService);
    service.removePageImage();
    TestBed.tick();

    expect(localStorage.getItem(PAGE_IMAGE_KEY)).toBeNull();
    expect(root.dataset['pageImage']).toBeUndefined();
  });

  it('rejects files that are not images', async () => {
    const service = TestBed.inject(AppearanceService);
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await expect(service.setPageImage(file)).rejects.toBeInstanceOf(ImageError);
    expect(service.pageImage()).toBeNull();
  });

  it('applies stored flag and mine pictures as CSS variables', () => {
    localStorage.setItem(FLAG_IMAGE_KEY, TINY_IMAGE);
    localStorage.setItem(MINE_IMAGE_KEY, TINY_IMAGE);
    TestBed.inject(AppearanceService);
    TestBed.tick();

    expect(root.style.getPropertyValue('--flag-image')).toContain(TINY_IMAGE);
    expect(root.style.getPropertyValue('--mine-image')).toContain(TINY_IMAGE);
    expect(root.dataset['flagImage']).toBe('on');
  });

  it('removes the flag and mine pictures from the page and from storage', () => {
    localStorage.setItem(FLAG_IMAGE_KEY, TINY_IMAGE);
    localStorage.setItem(MINE_IMAGE_KEY, TINY_IMAGE);
    const service = TestBed.inject(AppearanceService);
    service.removeFlagImage();
    service.removeMineImage();
    TestBed.tick();

    expect(service.flagImage()).toBeNull();
    expect(localStorage.getItem(FLAG_IMAGE_KEY)).toBeNull();
    expect(localStorage.getItem(MINE_IMAGE_KEY)).toBeNull();
    expect(root.style.getPropertyValue('--flag-image')).toBe('');
  });

  it('rejects a flag file that is not an image', async () => {
    const service = TestBed.inject(AppearanceService);
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await expect(service.setFlagImage(file)).rejects.toBeInstanceOf(ImageError);
    expect(service.flagImage()).toBeNull();
  });

  it('reset restores the default theme and removes every picture', () => {
    for (const key of [PAGE_IMAGE_KEY, TILE_IMAGE_KEY, FLAG_IMAGE_KEY, MINE_IMAGE_KEY]) {
      localStorage.setItem(key, TINY_IMAGE);
    }
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ boardTheme: 'forest' }));
    const service = TestBed.inject(AppearanceService);
    service.reset();
    TestBed.tick();

    expect(service.choices().boardTheme).toBe('classic');
    expect(service.pageImage()).toBeNull();
    expect(service.mineImage()).toBeNull();
    expect(localStorage.getItem(APPEARANCE_KEY)).toBeNull();
    expect(localStorage.getItem(TILE_IMAGE_KEY)).toBeNull();
    expect(root.dataset['boardTheme']).toBe('classic');
    expect(root.dataset['pageImage']).toBeUndefined();
  });

  it('only accepts plain base64 png, jpeg and webp pictures', () => {
    expect(isSafeImage(TINY_IMAGE)).toBe(true);
    expect(isSafeImage('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
    expect(isSafeImage('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isSafeImage('data:image/png;base64,AAAA")};body{display:none}/*')).toBe(false);
    expect(isSafeImage('data:image/png;base64,AAAA AAAA')).toBe(false);
    expect(isSafeImage('data:image/png,<svg onload=alert(1)>')).toBe(false);
    expect(isSafeImage('https://example.com/a.png')).toBe(false);
    expect(isSafeImage('javascript:alert(1)')).toBe(false);
    expect(isSafeImage(null)).toBe(false);
    expect(isSafeImage(42)).toBe(false);
  });

  it('ignores a stored picture that could break out of the CSS url()', () => {
    localStorage.setItem(PAGE_IMAGE_KEY, 'data:image/png;base64,AAAA")};body{display:none}/*');
    expect(TestBed.inject(AppearanceService).pageImage()).toBeNull();
  });
});
