import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameService } from '../../services/game.service';
import { Cell } from '../cell/cell';

@Component({
  selector: 'app-board',
  imports: [Cell],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  protected readonly game = inject(GameService);
}
