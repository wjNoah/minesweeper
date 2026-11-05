import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
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

  /** Guest chose "Join a room" and is typing the code. */
  protected readonly joining = signal(false);
  /** Kept while connecting, so a mistyped code can be fixed instead of typed again. */
  protected readonly codeDraft = signal('');
  protected readonly copied = signal(false);
  protected readonly canShare = typeof navigator.share === 'function';
  protected readonly botLevels = BOT_LEVEL_IDS;
  protected readonly botSkill = computed(() => BOT_LEVELS[this.match.botLevel()]);
  /** Against the bot there is no connection to set up: it is "connected" right away. */
  protected readonly view = computed(() =>
    this.match.isBot() ? 'connected' : this.connection.state(),
  );
  protected readonly canEditRules = computed(() => this.match.isHost() && !this.match.isRacing());
  /** Screen readers read "K7XPM" as a word; "K 7 X P M" is read letter by letter. */
  protected readonly spelledCode = computed(
    () => `Room code ${[...this.connection.roomCode()].join(' ')}`,
  );
  /** Everything after choosing Create or Join can step back to that choice. */
  protected readonly canGoBack = computed(
    () => this.joining() || ['waiting', 'connecting'].includes(this.connection.state()),
  );

  constructor() {
    // The guest's dialog closes by itself when the host starts the round.
    effect(() => {
      if (this.match.phase() === 'countdown') this.close();
    });
    // Once in a room, the join form is done: after the match the dialog starts fresh.
    effect(() => {
      if (this.connection.state() === 'connected') {
        this.joining.set(false);
        this.codeDraft.set('');
        // The host may have closed the dialog while waiting: show that the friend is here.
        const dialog = this.dialog().nativeElement;
        if (!dialog.open && untracked(this.match.phase) === 'lobby') dialog.showModal();
      }
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
    this.connection.host();
  }

  protected playBot(): void {
    this.joining.set(false);
    this.match.playBot();
  }

  protected botLevelLabel(level: BotLevel): string {
    return BOT_LEVELS[level].label;
  }

  protected join(code: string): void {
    this.connection.join(code);
  }

  protected backToStart(): void {
    this.joining.set(false);
    this.connection.close();
  }

  protected async copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // The clipboard needs https. The code is short, so it can still be read off the screen.
    }
  }

  protected share(code: string): void {
    const text = `Join my Minesweeper 1v1 room with the code ${code}`;
    navigator.share({ text, url: location.origin }).catch(() => undefined);
  }

  protected setNoGuess(event: Event): void {
    this.match.setRules({ noGuess: (event.target as HTMLInputElement).checked });
  }

  protected startRound(): void {
    this.match.startRound();
  }
}
