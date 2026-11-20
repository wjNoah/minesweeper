import { TestBed } from '@angular/core/testing';
import { QuestEvent } from '../models/quest.model';
import { QUESTS_STORAGE_KEY, QuestService } from './quest.service';

const win: QuestEvent = {
  type: 'game-won',
  difficulty: 'beginner',
  seconds: 60,
  noGuess: false,
  hintsUsed: 0,
  flagsPlaced: 3,
  chords: 0,
};

describe('QuestService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('saves progress, so it is still there after a reload', () => {
    TestBed.inject(QuestService).record(win);
    const stored = JSON.parse(localStorage.getItem(QUESTS_STORAGE_KEY) ?? '{}');
    expect(stored['ten-wins'].progress).toBe(1);
  });

  it('loads saved progress', () => {
    localStorage.setItem(
      QUESTS_STORAGE_KEY,
      JSON.stringify({ 'first-win': { progress: 1, completedAt: 5 } }),
    );
    const quests = TestBed.inject(QuestService);
    expect(quests.completedCount()).toBe(1);
    expect(quests.list().find((e) => e.quest.id === 'first-win')?.completedAt).toBe(5);
  });

  it('starts fresh when the saved data is broken', () => {
    localStorage.setItem(QUESTS_STORAGE_KEY, '{not json');
    expect(TestBed.inject(QuestService).completedCount()).toBe(0);
  });

  it('announces finished quests for a few seconds', () => {
    const quests = TestBed.inject(QuestService);
    quests.record(win);
    expect(quests.announcement()?.quests.map((q) => q.id)).toContain('first-win');

    vi.advanceTimersByTime(4000);
    expect(quests.announcement()).toBeNull();
  });

  it('does not announce progress that finished nothing', () => {
    const quests = TestBed.inject(QuestService);
    quests.record(win);
    quests.dismissAnnouncement();
    quests.record(win); // Second win: progress, but no quest done.
    expect(quests.announcement()).toBeNull();
  });

  it('a quest theme is locked until its quest is done; the original themes never are', () => {
    const quests = TestBed.inject(QuestService);
    expect(quests.isThemeUnlocked('ocean')).toBe(true);
    expect(quests.isThemeUnlocked('blueprint')).toBe(false);

    quests.record(win); // First sweep unlocks Blueprint.
    expect(quests.isThemeUnlocked('blueprint')).toBe(true);
    expect(quests.isThemeUnlocked('neon')).toBe(false);
  });

  it('modes are locked until their quest is done; Normal never is', () => {
    const quests = TestBed.inject(QuestService);
    expect(quests.isModeUnlocked('normal')).toBe(true);
    expect(quests.isModeUnlocked('no-flags')).toBe(false);
    quests.record({ ...win, difficulty: 'intermediate' });
    expect(quests.isModeUnlocked('no-flags')).toBe(true);
    expect(quests.isModeUnlocked('mirror')).toBe(true);
    expect(quests.isModeUnlocked('fog')).toBe(false);
  });

  it('keeps counting for this visit when storage is full or blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const quests = TestBed.inject(QuestService);
    expect(() => quests.record(win)).not.toThrow();
    expect(quests.completedCount()).toBeGreaterThan(0);
  });
});
