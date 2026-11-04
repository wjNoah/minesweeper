import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BOARD_THEMES, TileImageMode } from '../../models/appearance.model';
import { AppearanceService } from '../../services/appearance.service';
import { ImageError } from '../../services/image-resize';
import { PicturePicker } from '../picture-picker/picture-picker';

type PictureTarget = 'page' | 'tile';

@Component({
  selector: 'app-customize-dialog',
  imports: [PicturePicker],
  templateUrl: './customize-dialog.html',
  styleUrl: './customize-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomizeDialog {
  protected readonly appearance = inject(AppearanceService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly themes = BOARD_THEMES;
  protected readonly tileModes: readonly { value: TileImageMode; label: string }[] = [
    { value: 'tile', label: 'Each block' },
    { value: 'board', label: 'Whole board' },
  ];

  /** Which picture is being processed right now. */
  protected readonly busy = signal<PictureTarget | null>(null);
  protected readonly error = signal('');

  open(): void {
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected async onFileChosen(file: File, target: PictureTarget): Promise<void> {
    this.error.set('');
    this.busy.set(target);
    try {
      if (target === 'page') {
        await this.appearance.setPageImage(file);
      } else {
        await this.appearance.setTileImage(file);
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
