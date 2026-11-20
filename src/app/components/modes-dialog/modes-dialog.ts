import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { GAME_MODES, GameModeId } from '../../models/game-mode.model';
import { Quest, questForMode } from '../../models/quest.model';
import { GameService } from '../../services/game.service';
import { QuestService } from '../../services/quest.service';
import { SettingsService } from '../../services/settings.service';

/** Game modes and no-guessing boards: how the next game is played. */
@Component({
  selector: 'app-modes-dialog',
  templateUrl: './modes-dialog.html',
  styleUrl: './modes-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModesDialog {
  protected readonly game = inject(GameService);
  protected readonly settings = inject(SettingsService);
  private readonly quests = inject(QuestService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly modes = GAME_MODES;

  open(): void {
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  /** The quest a mode is still waiting for, or null when it can be played. */
  protected lockedBy(mode: GameModeId): Quest | null {
    return this.quests.isModeUnlocked(mode) ? null : (questForMode(mode) ?? null);
  }

  protected choose(mode: GameModeId): void {
    if (mode === this.game.gameMode() || this.lockedBy(mode)) return;
    this.game.setGameMode(mode);
  }

  protected setNoGuess(event: Event): void {
    this.settings.update({ noGuess: (event.target as HTMLInputElement).checked });
  }
}
