import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestEvent } from '../../models/quest.model';
import { QuestService } from '../../services/quest.service';
import { QuestToast } from './quest-toast';

const win: QuestEvent = {
  type: 'game-won',
  difficulty: 'intermediate',
  seconds: 200,
  noGuess: false,
  hintsUsed: 1,
  flagsPlaced: 3,
  chords: 0,
};

describe('QuestToast', () => {
  let fixture: ComponentFixture<QuestToast>;
  let host: HTMLElement;
  let quests: QuestService;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    fixture = TestBed.createComponent(QuestToast);
    quests = TestBed.inject(QuestService);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => vi.useRealTimers());

  it('shows nothing until a quest is done', () => {
    expect(host.querySelector('.toast')).toBeNull();
    expect(host.querySelector('[role="status"]')).not.toBeNull();
  });

  it('names the finished quests, and goes away by itself', () => {
    quests.record(win);
    fixture.detectChanges();
    const toast = host.querySelector('.toast');
    expect(toast?.querySelector('.label')?.textContent?.trim()).toBe('Quests complete');
    expect(toast?.querySelector('.names')?.textContent).toContain('First sweep');
    expect(toast?.querySelector('.names')?.textContent).toContain('Moving up');

    expect(toast?.querySelector('.reward')?.textContent?.trim()).toBe(
      'The Blueprint theme unlocked',
    );

    vi.advanceTimersByTime(4000);
    fixture.detectChanges();
    expect(host.querySelector('.toast')).toBeNull();
  });

  it('a click opens the quest list', () => {
    let opened = 0;
    fixture.componentInstance.openQuests.subscribe(() => opened++);
    quests.record(win);
    fixture.detectChanges();
    (host.querySelector('.toast') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(opened).toBe(1);
    expect(host.querySelector('.toast')).toBeNull();
  });
});
