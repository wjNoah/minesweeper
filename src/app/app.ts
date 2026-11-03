import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Board } from './components/board/board';
import { ControlsHint } from './components/controls-hint/controls-hint';
import { DifficultyPicker } from './components/difficulty-picker/difficulty-picker';
import { GameHeader } from './components/game-header/game-header';
import { MatchBar } from './components/match-bar/match-bar';
import { MatchDialog } from './components/match-dialog/match-dialog';
import { SettingsDialog } from './components/settings-dialog/settings-dialog';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  imports: [
    Board,
    ControlsHint,
    DifficultyPicker,
    GameHeader,
    MatchBar,
    MatchDialog,
    SettingsDialog,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly settings = inject(SettingsService);
}
