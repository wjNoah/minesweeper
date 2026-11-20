import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { Quest, rewardLabels } from '../../models/quest.model';
import { QuestService } from '../../services/quest.service';

@Component({
  selector: 'app-quests-dialog',
  templateUrl: './quests-dialog.html',
  styleUrl: './quests-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestsDialog {
  protected readonly quests = inject(QuestService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Open quests first, in their order; finished ones at the end. */
  protected readonly sorted = computed(() => {
    const list = this.quests.list();
    return [
      ...list.filter((entry) => entry.completedAt === null),
      ...list.filter((entry) => entry.completedAt !== null),
    ];
  });

  open(): void {
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  /** "the No flags mode and the Mirror mode", or empty for quests without a reward. */
  protected rewardText(quest: Quest): string {
    return rewardLabels(quest).join(' and ');
  }

  protected percent(progress: number, goal: number): number {
    return Math.round((100 * progress) / goal);
  }
}
