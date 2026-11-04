import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  isBindableKey,
  KEY_ACTIONS,
  KeyAction,
  keyLabel,
  Settings,
} from '../../models/settings.model';
import { BestTimesService } from '../../services/best-times.service';
import { SettingsService } from '../../services/settings.service';

type ToggleKey = 'noGuess' | 'safeArea' | 'chordOnClick' | 'highlightNeighbors' | 'haptics';

const TOGGLES: readonly { key: ToggleKey; label: string; hint: string }[] = [
  {
    key: 'noGuess',
    label: 'No guessing',
    hint: 'Every board can be solved by logic alone. Best times are kept separately.',
  },
  {
    key: 'safeArea',
    label: 'Open an area on the first click',
    hint: 'Off: only the clicked cell is guaranteed to be safe.',
  },
  {
    key: 'chordOnClick',
    label: 'Click a number to open its neighbors',
    hint: 'Off: use double-click, Shift + click or the reveal key instead.',
  },
  {
    key: 'highlightNeighbors',
    label: 'Highlight neighbors of a number',
    hint: 'Shows which hidden cells a number touches.',
  },
  {
    key: 'haptics',
    label: 'Vibrate on long press',
    hint: 'On phones that support it.',
  },
];

@Component({
  selector: 'app-settings-dialog',
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialog {
  protected readonly settings = inject(SettingsService);
  private readonly bestTimes = inject(BestTimesService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly toggles = TOGGLES;
  protected readonly keyActions = KEY_ACTIONS;
  protected readonly keyLabel = keyLabel;

  /** The action waiting for its new key, if any. */
  protected readonly listeningFor = signal<KeyAction | null>(null);
  protected readonly keyError = signal('');
  protected readonly confirmingReset = signal(false);
  protected readonly statusMessage = signal('');
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.confirmTimer));
  }

  open(): void {
    this.statusMessage.set('');
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onClosed(): void {
    this.listeningFor.set(null);
    this.keyError.set('');
    this.confirmingReset.set(false);
  }

  /** A click on the dimmed area outside the panel lands on the dialog element itself. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected setToggle(key: ToggleKey, event: Event): void {
    const changes: Partial<Settings> = {};
    changes[key] = (event.target as HTMLInputElement).checked;
    this.settings.update(changes);
  }

  protected startListening(action: KeyAction): void {
    this.keyError.set('');
    this.listeningFor.set(this.listeningFor() === action ? null : action);
  }

  protected stopListening(): void {
    this.listeningFor.set(null);
  }

  protected onBindingKeydown(event: KeyboardEvent, action: KeyAction): void {
    if (this.listeningFor() !== action || event.key === 'Tab') return;
    // While listening, the key is the answer: it must not close the dialog or press the button.
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      this.listeningFor.set(null);
    } else if (isBindableKey(event.key)) {
      this.settings.setKey(action, event.key);
      this.listeningFor.set(null);
      this.keyError.set('');
    } else {
      this.keyError.set(`${event.key} has a fixed use. Choose a letter, digit, symbol or Space.`);
    }
  }

  protected resetBestTimes(): void {
    clearTimeout(this.confirmTimer);
    if (!this.confirmingReset()) {
      this.confirmingReset.set(true);
      this.confirmTimer = setTimeout(() => this.confirmingReset.set(false), 4000);
      return;
    }
    this.bestTimes.clear();
    this.confirmingReset.set(false);
    this.statusMessage.set('Best times deleted.');
  }

  protected restoreDefaults(): void {
    this.settings.reset();
    this.statusMessage.set('Settings restored to defaults.');
  }
}
