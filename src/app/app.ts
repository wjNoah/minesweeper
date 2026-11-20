import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { About } from './components/about/about';
import { Board } from './components/board/board';
import { ControlsHint } from './components/controls-hint/controls-hint';
import { CustomizeDialog } from './components/customize-dialog/customize-dialog';
import { FeedbackDialog } from './components/feedback-dialog/feedback-dialog';
import { DifficultyPicker } from './components/difficulty-picker/difficulty-picker';
import { GameHeader } from './components/game-header/game-header';
import { MatchBar } from './components/match-bar/match-bar';
import { ModesDialog } from './components/modes-dialog/modes-dialog';
import { QuestToast } from './components/quest-toast/quest-toast';
import { QuestsDialog } from './components/quests-dialog/quests-dialog';
import { MatchDialog } from './components/match-dialog/match-dialog';
import { SettingsDialog } from './components/settings-dialog/settings-dialog';
import { AppearanceService } from './services/appearance.service';
import { QuestService } from './services/quest.service';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  imports: [
    About,
    Board,
    ControlsHint,
    CustomizeDialog,
    DifficultyPicker,
    FeedbackDialog,
    GameHeader,
    MatchBar,
    MatchDialog,
    ModesDialog,
    QuestsDialog,
    QuestToast,
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
  protected readonly quests = inject(QuestService);
}
