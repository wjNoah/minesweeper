import { effect, Injectable, signal } from '@angular/core';
import {
  AppearanceChoices,
  BoardThemeId,
  parseAppearance,
  TileImageMode,
} from '../models/appearance.model';
import { ImageError, resizeImage } from './image-resize';

export const APPEARANCE_KEY = 'minesweeper.appearance';
export const PAGE_IMAGE_KEY = 'minesweeper.pageImage';
export const TILE_IMAGE_KEY = 'minesweeper.tileImage';

/** Board theme and the user's own pictures. Everything stays in this browser. */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  readonly choices = signal<AppearanceChoices>(parseAppearance(readJson(APPEARANCE_KEY)));
  readonly pageImage = signal<string | null>(read(PAGE_IMAGE_KEY));
  readonly tileImage = signal<string | null>(read(TILE_IMAGE_KEY));

  constructor() {
    effect(() => {
      const { boardTheme, tileImageMode } = this.choices();
      const root = document.documentElement;
      root.dataset['boardTheme'] = boardTheme;
      setImage(root, '--page-image', 'pageImage', this.pageImage(), 'on');
      setImage(root, '--tile-image', 'tileImage', this.tileImage(), tileImageMode);
    });
  }

  setBoardTheme(boardTheme: BoardThemeId): void {
    this.updateChoices({ boardTheme });
  }

  setTileImageMode(tileImageMode: TileImageMode): void {
    this.updateChoices({ tileImageMode });
  }

  /** Background: up to 1920 px, JPEG. Throws ImageError with a message for the user. */
  async setPageImage(file: File): Promise<void> {
    const image = await resizeImage(file, 1920);
    save(PAGE_IMAGE_KEY, image);
    this.pageImage.set(image);
  }

  /** Blocks: smaller, and transparent pictures stay transparent. */
  async setTileImage(file: File): Promise<void> {
    const image = await resizeImage(file, 768, true);
    save(TILE_IMAGE_KEY, image);
    this.tileImage.set(image);
  }

  removePageImage(): void {
    localStorage.removeItem(PAGE_IMAGE_KEY);
    this.pageImage.set(null);
  }

  removeTileImage(): void {
    localStorage.removeItem(TILE_IMAGE_KEY);
    this.tileImage.set(null);
  }

  private updateChoices(changes: Partial<AppearanceChoices>): void {
    this.choices.update((choices) => ({ ...choices, ...changes }));
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(this.choices()));
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
  }
}

/** Sets the CSS variable and a data attribute (so CSS knows a picture is active). */
function setImage(
  root: HTMLElement,
  property: string,
  attribute: string,
  image: string | null,
  attributeValue: string,
): void {
  if (image) {
    root.style.setProperty(property, `url("${image}")`);
    root.dataset[attribute] = attributeValue;
  } else {
    root.style.removeProperty(property);
    delete root.dataset[attribute];
  }
}

function save(key: string, image: string): void {
  try {
    localStorage.setItem(key, image);
  } catch {
    throw new ImageError('This picture is too large to save in the browser. Try a smaller one.');
  }
}

function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return value?.startsWith('data:image/') ? value : null;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
