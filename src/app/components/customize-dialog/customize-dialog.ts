import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BOARD_THEMES, TileImageMode } from '../../models/appearance.model';
import { CellState } from '../../models/cell.model';
import { CELL_SCALES, Settings, ThemeSetting } from '../../models/settings.model';
import { AppearanceService } from '../../services/appearance.service';
import { ImageError } from '../../services/image-resize';
import { SettingsService } from '../../services/settings.service';
import { Cell } from '../cell/cell';
import { PicturePicker } from '../picture-picker/picture-picker';

type PictureTarget = 'page' | 'tile' | 'flag' | 'mine';

const MODES: readonly { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const PREVIEW_BASE: CellState = {
  row: 0,
  col: 0,
  hasMine: false,
  isRevealed: false,
  isFlagged: false,
  isHit: false,
  adjacentMines: 0,
};

@Component({
  selector: 'app-customize-dialog',
  imports: [Cell, PicturePicker],
  templateUrl: './customize-dialog.html',
  styleUrl: './customize-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomizeDialog {
  protected readonly appearance = inject(AppearanceService);
  protected readonly settings = inject(SettingsService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly themes = BOARD_THEMES;
  protected readonly modes = MODES;
  protected readonly cellScales = CELL_SCALES;
  protected readonly tileModes: readonly { value: TileImageMode; label: string }[] = [
    { value: 'tile', label: 'Each block' },
    { value: 'board', label: 'Whole board' },
  ];

  /** Real cells for the preview, so it shows exactly what the board will show. */
  protected readonly previewFlag: CellState = { ...PREVIEW_BASE, hasMine: true, isFlagged: true };
  protected readonly previewMine: CellState = { ...PREVIEW_BASE, col: 1, hasMine: true };
  protected readonly previewExploded: CellState = {
    ...PREVIEW_BASE,
    col: 2,
    hasMine: true,
    isRevealed: true,
  };

  /** Which picture is being processed right now. */
  protected readonly busy = signal<PictureTarget | null>(null);
  protected readonly error = signal('');
  protected readonly confirmingReset = signal(false);
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.confirmTimer));
  }

  open(): void {
    this.error.set('');
    this.confirmingReset.set(false);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected setMode(theme: ThemeSetting): void {
    this.settings.update({ theme });
  }

  protected setCellScale(cellScale: Settings['cellScale']): void {
    this.settings.update({ cellScale });
  }

  /** Removes your pictures, so it asks to be clicked twice. */
  protected resetLook(): void {
    clearTimeout(this.confirmTimer);
    if (!this.confirmingReset()) {
      this.confirmingReset.set(true);
      this.confirmTimer = setTimeout(() => this.confirmingReset.set(false), 4000);
      return;
    }
    this.appearance.reset();
    this.settings.resetLook();
    this.error.set('');
    this.confirmingReset.set(false);
  }

  protected async onFileChosen(file: File, target: PictureTarget): Promise<void> {
    this.error.set('');
    this.busy.set(target);
    try {
      switch (target) {
        case 'page':
          await this.appearance.setPageImage(file);
          break;
        case 'tile':
          await this.appearance.setTileImage(file);
          break;
        case 'flag':
          await this.appearance.setFlagImage(file);
          break;
        case 'mine':
          await this.appearance.setMineImage(file);
          break;
      }
    } catch (error) {
      this.error.set(
        error instanceof ImageError ? error.message : 'Something went wrong with this picture.',
      );
    } finally {
      this.busy.set(null);
    }
  }
}
