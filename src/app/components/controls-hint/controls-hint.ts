import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { keyLabel } from '../../models/settings.model';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-controls-hint',
  templateUrl: './controls-hint.html',
  styleUrl: './controls-hint.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlsHint {
  private readonly settings = inject(SettingsService);
  protected readonly chordOnClick = computed(() => this.settings.settings().chordOnClick);

  /** Labels of the current key bindings, so the hint matches the settings. */
  protected readonly keys = computed(() => {
    const { flag, reveal, newGame, flagMode, hint } = this.settings.settings().keys;
    return {
      hint: keyLabel(hint),
      flag: keyLabel(flag),
      reveal: keyLabel(reveal),
      newGame: keyLabel(newGame),
      flagMode: keyLabel(flagMode),
    };
  });
}
