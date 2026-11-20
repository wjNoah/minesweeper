import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { BoardThemeId } from '../models/appearance.model';
import { GameModeId } from '../models/game-mode.model';
import {
  applyQuestEvent,
  parseQuestStates,
  Quest,
  QuestEvent,
  questForMode,
  questForTheme,
  questState,
  QUESTS,
  QuestStates,
} from '../models/quest.model';

export const QUESTS_STORAGE_KEY = 'minesweeper.quests';
/** How long "Quest complete" stays on screen. */
const ANNOUNCE_MS = 4000;

export interface QuestAnnouncement {
  /** New for every announcement, so a second one shows again even with the same text. */
  id: number;
  quests: Quest[];
}

/** Keeps quest progress, saved in this browser, and announces finished quests. */
@Injectable({ providedIn: 'root' })
export class QuestService {
  private readonly states = signal<QuestStates>(load());

  readonly list = computed(() =>
    QUESTS.map((quest) => ({ quest, ...questState(this.states(), quest.id) })),
  );
  readonly completedCount = computed(
    () => this.list().filter((entry) => entry.completedAt !== null).length,
  );
  readonly total = QUESTS.length;
  readonly announcement = signal<QuestAnnouncement | null>(null);

  /** Replaceable in tests. */
  now: () => number = Date.now;

  private announceTimer: ReturnType<typeof setTimeout> | undefined;
  private announceCount = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.announceTimer));
  }

  /** Themes everyone has, plus those whose quest is done. */
  isThemeUnlocked(theme: BoardThemeId): boolean {
    const quest = questForTheme(theme);
    return !quest || questState(this.states(), quest.id).completedAt !== null;
  }

  /** Normal, plus the modes whose quest is done. */
  isModeUnlocked(mode: GameModeId): boolean {
    const quest = questForMode(mode);
    return !quest || questState(this.states(), quest.id).completedAt !== null;
  }

  record(event: QuestEvent): void {
    const { states, completed } = applyQuestEvent(this.states(), event, this.now());
    if (states === this.states()) return;
    this.states.set(states);
    save(states);
    if (completed.length > 0) this.announce(completed);
  }

  dismissAnnouncement(): void {
    clearTimeout(this.announceTimer);
    this.announcement.set(null);
  }

  private announce(quests: Quest[]): void {
    clearTimeout(this.announceTimer);
    this.announcement.set({ id: ++this.announceCount, quests });
    this.announceTimer = setTimeout(() => this.announcement.set(null), ANNOUNCE_MS);
  }
}

function load(): QuestStates {
  try {
    return parseQuestStates(JSON.parse(localStorage.getItem(QUESTS_STORAGE_KEY) ?? 'null'));
  } catch {
    return {};
  }
}

function save(states: QuestStates): void {
  try {
    localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Storage full or blocked: progress still counts for this visit.
  }
}
