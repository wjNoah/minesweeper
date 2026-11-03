import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Board } from './components/board/board';
import { DifficultyPicker } from './components/difficulty-picker/difficulty-picker';
import { GameHeader } from './components/game-header/game-header';

@Component({
  selector: 'app-root',
  imports: [Board, DifficultyPicker, GameHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
