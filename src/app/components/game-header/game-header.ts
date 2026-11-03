import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameService } from '../../services/game.service';

const FACES = { ready: '🙂', playing: '🙂', won: '😎', lost: '😵' } as const;

@Component({
  selector: 'app-game-header',
  templateUrl: './game-header.html',
  styleUrl: './game-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameHeader {
  protected readonly game = inject(GameService);
  protected readonly face = computed(() => FACES[this.game.status()]);

  protected pad(value: number): string {
    const clamped = Math.max(-99, Math.min(999, value));
    return clamped < 0 ? '-' + String(-clamped).padStart(2, '0') : String(clamped).padStart(3, '0');
  }
}
