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

  /** Best time for the current difficulty. Custom boards have none. */
  protected readonly bestLabel = computed(() => {
    const difficulty = this.game.difficulty();
    const best = difficulty === 'custom' ? undefined : this.bestTimes.times()[difficulty];
    return best === undefined ? '–' : this.formatTime(best);
  });

  protected readonly boardSize = computed(() => {
    const { rows, cols, mines } = this.game.config();
    return `${cols} × ${rows} board, ${mines} mines`;
  });

  protected formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
