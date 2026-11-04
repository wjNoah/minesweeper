import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Thumbnail plus "Choose / Change / Remove" buttons for one picture. */
@Component({
  selector: 'app-picture-picker',
  templateUrl: './picture-picker.html',
  styleUrl: './picture-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PicturePicker {
  /** Used in labels, for example "background picture". */
  readonly label = input.required<string>();
  readonly image = input<string | null>(null);
  readonly busy = input(false);

  readonly chosen = output<File>();
  readonly removed = output<void>();

  protected onChange(event: Event): void {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    // Reset, so choosing the same file again still counts as a change.
    field.value = '';
    if (file) this.chosen.emit(file);
  }
}
