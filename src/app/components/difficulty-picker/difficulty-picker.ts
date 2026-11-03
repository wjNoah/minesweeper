import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CUSTOM_LIMITS, PRESETS } from '../../models/game.model';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-difficulty-picker',
  templateUrl: './difficulty-picker.html',
  styleUrl: './difficulty-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyPicker {
  protected readonly game = inject(GameService);
  protected readonly presets = PRESETS;
  protected readonly limits = CUSTOM_LIMITS;

  protected applyCustom(rows: number, cols: number, mines: number): void {
    this.game.setDifficulty('custom', { rows, cols, mines });
  }
}
