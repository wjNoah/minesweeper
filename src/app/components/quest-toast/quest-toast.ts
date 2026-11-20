import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { rewardLabels } from '../../models/quest.model';
import { QuestService } from '../../services/quest.service';

/** "Quest complete" for a few seconds after a quest is finished. */
@Component({
  selector: 'app-quest-toast',
  templateUrl: './quest-toast.html',
  styleUrl: './quest-toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestToast {
  protected readonly quests = inject(QuestService);
  /** The player wants to see all quests. */
  readonly openQuests = output<void>();

  /** A list, so that a new announcement makes a new element and its animation plays again. */
  protected readonly announcements = computed(() => {
    const announcement = this.quests.announcement();
    return announcement ? [announcement] : [];
  });

  /** What the finished quests unlocked, like "the Neon Nights theme". */
  protected readonly rewards = computed(() =>
    (this.quests.announcement()?.quests ?? []).flatMap((quest) => rewardLabels(quest)),
  );

  protected capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected show(): void {
    this.quests.dismissAnnouncement();
    this.openQuests.emit();
  }
}
