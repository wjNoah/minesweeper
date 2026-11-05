import { effect, Injectable, signal } from '@angular/core';
import {
  AppearanceChoices,
  BoardThemeId,
  DEFAULT_APPEARANCE,
  parseAppearance,
  TileImageMode,
} from '../models/appearance.model';
import { ImageError, resizeImage } from './image-resize';

export const APPEARANCE_KEY = 'minesweeper.appearance';
export const PAGE_IMAGE_KEY = 'minesweeper.pageImage';
export const TILE_IMAGE_KEY = 'minesweeper.tileImage';
export const FLAG_IMAGE_KEY = 'minesweeper.flagImage';
export const MINE_IMAGE_KEY = 'minesweeper.mineImage';

/** Flag and mine pictures are small icons, so a modest size is plenty. */
const ICON_MAX_SIDE = 160;

/** Board theme and the user's own pictures. Everything stays in this browser. */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  readonly choices = signal<AppearanceChoices>(parseAppearance(readJson(APPEARANCE_KEY)));
  readonly pageImage = signal<string | null>(read(PAGE_IMAGE_KEY));
  readonly tileImage = signal<string | null>(read(TILE_IMAGE_KEY));
  readonly flagImage = signal<string | null>(read(FLAG_IMAGE_KEY));
  readonly mineImage = signal<string | null>(read(MINE_IMAGE_KEY));

  constructor() {
    effect(() => {
      const { boardTheme, tileImageMode } = this.choices();
      const root = document.documentElement;
      root.dataset['boardTheme'] = boardTheme;
      setImage(root, '--page-image', 'pageImage', this.pageImage(), 'on');
      setImage(root, '--tile-image', 'tileImage', this.tileImage(), tileImageMode);
      setImage(root, '--flag-image', 'flagImage', this.flagImage(), 'on');
      setImage(root, '--mine-image', 'mineImage', this.mineImage(), 'on');
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

  /** Flag and mine: small, and transparent pictures stay transparent. */
  async setFlagImage(file: File): Promise<void> {
    const image = await resizeImage(file, ICON_MAX_SIDE, true);
    save(FLAG_IMAGE_KEY, image);
    this.flagImage.set(image);
  }

  async setMineImage(file: File): Promise<void> {
    const image = await resizeImage(file, ICON_MAX_SIDE, true);
    save(MINE_IMAGE_KEY, image);
    this.mineImage.set(image);
  }

  removeFlagImage(): void {
    remove(FLAG_IMAGE_KEY);
    this.flagImage.set(null);
  }

  removeMineImage(): void {
    remove(MINE_IMAGE_KEY);
    this.mineImage.set(null);
  }

  removePageImage(): void {
    remove(PAGE_IMAGE_KEY);
    this.pageImage.set(null);
  }

  removeTileImage(): void {
    remove(TILE_IMAGE_KEY);
    this.tileImage.set(null);
  }

  /** Back to the default theme and removes all pictures. */
  reset(): void {
    remove(APPEARANCE_KEY);
    this.choices.set({ ...DEFAULT_APPEARANCE });
    this.removePageImage();
    this.removeTileImage();
    this.removeFlagImage();
    this.removeMineImage();
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

/**
 * Only plain base64 PNG, JPEG or WebP pictures are accepted. The value ends up inside a CSS
 * url("..."), so anything else (a quote, a space, an SVG) could break out of it. The same
 * check is repeated in public/early-theme.js, which runs before the page is drawn.
 */
export function isSafeImage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

/** Storage can be blocked. Removing a picture still applies for this visit. */
function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}

function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return isSafeImage(value) ? value : null;
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
