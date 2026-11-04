import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { Finish, formatRaceTime } from '../../models/match.model';
import { ConnectionService } from '../../services/connection.service';
import { GameService } from '../../services/game.service';
import { MatchService } from '../../services/match.service';

const HEADLINES = { won: 'You won', lost: 'You lost', draw: 'Draw', pending: '' } as const;

@Component({
  selector: 'app-match-bar',
  templateUrl: './match-bar.html',
  styleUrl: './match-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchBar {
  protected readonly match = inject(MatchService);
  protected readonly game = inject(GameService);
  protected readonly connection = inject(ConnectionService);

  /** Opens the 1v1 dialog, for example to change the rules between rounds. */
  readonly openRules = output<void>();

  protected readonly myPercent = computed(() => {
    const revealed = this.game
      .board()
      .flat()
      .filter((cell) => cell.isRevealed && !cell.hasMine).length;
    return this.percent(revealed);
  });

  protected readonly opponentName = computed(() => (this.match.isBot() ? 'Bot' : 'Opponent'));

  protected readonly opponentPercent = computed(() => this.percent(this.match.opponent().revealed));

  protected readonly headline = computed(() => HEADLINES[this.match.outcome()]);

  protected readonly penaltyNote = computed(() => {
    const seconds = this.game.penaltySeconds();
    return seconds > 0 ? `+${seconds} s per mine` : 'A mine ends the round';
  });

  /** Describes how a player's round ended, from my point of view. */
  protected describe(finish: Finish | null, isMe: boolean): string {
    if (!finish) return 'still playing';
    switch (finish.kind) {
      case 'cleared':
        return `cleared in ${formatRaceTime(finish.totalMs)}`;
      case 'exploded':
        return 'hit a mine';
      case 'stopped':
        if (this.match.rules().mineRule === 'defeat') return "didn't finish";
        return isMe ? 'passed their time' : 'passed your time';
    }
  }

  protected minesLabel(count: number): string {
    return count === 1 ? '1 mine hit' : `${count} mines hit`;
  }

  private percent(revealed: number): number {
    const total = this.match.safeCells();
    return total > 0 ? Math.round((100 * revealed) / total) : 0;
  }
}
