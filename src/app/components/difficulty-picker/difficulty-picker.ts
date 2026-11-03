import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CUSTOM_LIMITS, PRESETS, PresetId } from '../../models/game.model';
import { BestTimesService } from '../../services/best-times.service';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-difficulty-picker',
  templateUrl: './difficulty-picker.html',
  styleUrl: './difficulty-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyPicker {
  protected readonly game = inject(GameService);
  protected readonly bestTimes = inject(BestTimesService);
  protected readonly presets = PRESETS;
  protected readonly limits = CUSTOM_LIMITS;

  protected bestLabel(id: PresetId): string {
    const best = this.bestTimes.times()[id];
    return best === undefined ? '–' : `${best} s`;
  }

  protected applyCustom(rows: number, cols: number, mines: number): void {
    this.game.setDifficulty('custom', { rows, cols, mines });
  }
}
