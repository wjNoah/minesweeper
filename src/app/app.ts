import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Board } from './components/board/board';
import { ControlsHint } from './components/controls-hint/controls-hint';
import { DifficultyPicker } from './components/difficulty-picker/difficulty-picker';
import { GameHeader } from './components/game-header/game-header';
import { SettingsDialog } from './components/settings-dialog/settings-dialog';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  imports: [Board, ControlsHint, DifficultyPicker, GameHeader, SettingsDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly settings = inject(SettingsService);
}
