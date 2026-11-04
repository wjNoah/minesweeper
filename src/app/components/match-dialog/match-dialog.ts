import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BOT_LEVEL_IDS, BOT_LEVELS, BotLevel } from '../../models/bot.model';
import { PRESETS } from '../../models/game.model';
import { MineRule, PENALTY_OPTIONS } from '../../models/match.model';
import { ConnectionService } from '../../services/connection.service';
import { MatchService } from '../../services/match.service';

@Component({
  selector: 'app-match-dialog',
  templateUrl: './match-dialog.html',
  styleUrl: './match-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchDialog {
  protected readonly connection = inject(ConnectionService);
  protected readonly match = inject(MatchService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly presets = PRESETS;
  protected readonly penaltyOptions = PENALTY_OPTIONS;
  protected readonly mineRules: readonly { value: MineRule; label: string }[] = [
    { value: 'defeat', label: 'Defeat' },
    { value: 'penalty', label: 'Time penalty' },
  ];

  /** Guest chose "Join" and is about to paste the invite code. */
  protected readonly joining = signal(false);
  protected readonly copied = signal(false);
  protected readonly canShare = typeof navigator.share === 'function';
  protected readonly botLevels = BOT_LEVEL_IDS;
  protected readonly botSkill = computed(() => BOT_LEVELS[this.match.botLevel()]);
  /** Against the bot there is no connection to set up: it is "connected" right away. */
  protected readonly view = computed(() =>
    this.match.isBot() ? 'connected' : this.connection.state(),
  );
  /** Everything after choosing Host or Join can step back to that choice. */
  protected readonly canGoBack = computed(
    () =>
      this.joining() || ['preparing', 'waiting', 'connecting'].includes(this.connection.state()),
  );

  constructor() {
    // The guest's dialog closes by itself when the host starts the round.
    effect(() => {
      if (this.match.phase() === 'countdown') this.close();
    });
  }

  open(): void {
    this.copied.set(false);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected host(): void {
    this.joining.set(false);
    void this.connection.host();
  }

  protected playBot(): void {
    this.joining.set(false);
    this.match.playBot();
  }

  protected botLevelLabel(level: BotLevel): string {
    return BOT_LEVELS[level].label;
  }

  protected join(code: string): void {
    void this.connection.join(code);
  }

  protected acceptReply(code: string): void {
    void this.connection.acceptReply(code);
  }

  protected backToStart(): void {
    this.joining.set(false);
    this.connection.close();
  }

  protected async copy(code: string, field: HTMLTextAreaElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // The clipboard API needs https. On http, select the text so it can be copied by hand.
      field.select();
    }
  }

  protected share(code: string): void {
    navigator.share({ text: code }).catch(() => undefined);
  }

  protected setNoGuess(event: Event): void {
    this.match.setRules({ noGuess: (event.target as HTMLInputElement).checked });
  }

  protected startRound(): void {
    this.match.startRound();
  }
}
