import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BestTimesService } from '../../services/best-times.service';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-game-header',
  templateUrl: './game-header.html',
  styleUrl: './game-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameHeader {
  protected readonly game = inject(GameService);
  private readonly bestTimes = inject(BestTimesService);

  /** Best time for the current difficulty and mode. Custom boards have none. */
  protected readonly bestLabel = computed(() => {
    const key = this.game.bestTimeKey();
    const best = key ? this.bestTimes.times()[key] : undefined;
    return best === undefined ? '–' : this.formatTime(best);
  });

  protected readonly boardSize = computed(() => {
    const { rows, cols, mines } = this.game.config();
    const mode = this.game.isNoGuess() ? ', no guessing' : '';
    return `${cols} × ${rows} board, ${mines} mines${mode}`;
  });

  protected formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
