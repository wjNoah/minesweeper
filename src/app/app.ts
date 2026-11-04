import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Board } from './components/board/board';
import { ControlsHint } from './components/controls-hint/controls-hint';
import { CustomizeDialog } from './components/customize-dialog/customize-dialog';
import { DifficultyPicker } from './components/difficulty-picker/difficulty-picker';
import { GameHeader } from './components/game-header/game-header';
import { MatchBar } from './components/match-bar/match-bar';
import { MatchDialog } from './components/match-dialog/match-dialog';
import { SettingsDialog } from './components/settings-dialog/settings-dialog';
import { AppearanceService } from './services/appearance.service';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  imports: [
    Board,
    ControlsHint,
    CustomizeDialog,
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
  // Created here so the saved board theme and pictures apply right at startup.
  protected readonly appearance = inject(AppearanceService);
}
