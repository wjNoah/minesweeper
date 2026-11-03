import { TestBed } from '@angular/core/testing';
import {
  APPEARANCE_KEY,
  AppearanceService,
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
    root.style.removeProperty('--page-image');
    root.style.removeProperty('--tile-image');
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
});
