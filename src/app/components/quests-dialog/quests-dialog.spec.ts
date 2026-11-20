import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QUESTS_STORAGE_KEY } from '../../services/quest.service';
import { QuestsDialog } from './quests-dialog';

describe('QuestsDialog', () => {
  let fixture: ComponentFixture<QuestsDialog>;
  let host: HTMLElement;

  const titles = () => [...host.querySelectorAll('.quest .title')].map((t) => t.textContent);
  const questItem = (title: string) =>
    [...host.querySelectorAll('.quest')].find(
      (q) => q.querySelector('.title')?.textContent === title,
    );

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      QUESTS_STORAGE_KEY,
      JSON.stringify({
        'first-win': { progress: 1, completedAt: 5 },
        'ten-wins': { progress: 4, completedAt: null },
      }),
    );
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    fixture = TestBed.createComponent(QuestsDialog);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  it('says how many quests are done', () => {
    expect(host.querySelector('.summary')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '1 of 14 done',
    );
  });

  it('lists every quest, with the finished ones at the end', () => {
    expect(titles().length).toBe(14);
    expect(titles().at(-1)).toBe('First sweep');
    expect(titles()[0]).toBe('Getting the hang of it');
  });

  it('shows progress as a number and as a bar that screen readers can read', () => {
    const quest = questItem('Getting the hang of it');
    expect(quest?.querySelector('.state')?.textContent?.trim()).toBe('4 / 10');
    const bar = quest?.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('4');
    expect(bar?.getAttribute('aria-valuemax')).toBe('10');
    expect((quest?.querySelector('.fill') as HTMLElement).style.transform).toBe('scaleX(0.4)');
  });

  it('marks finished quests as done, without a progress bar', () => {
    const quest = questItem('First sweep');
    expect(quest?.classList).toContain('done');
    expect(quest?.querySelector('.state')?.textContent?.trim()).toBe('Done');
    expect(quest?.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('says what a quest unlocks, and that it is unlocked once done', () => {
    expect(questItem('Hot streak')?.querySelector('.reward')?.textContent?.trim()).toBe(
      'Unlocks the Neon Nights theme',
    );
    expect(questItem('First sweep')?.querySelector('.reward')?.textContent?.trim()).toBe(
      'Unlocked the Blueprint theme',
    );
    expect(questItem('Regular')?.querySelector('.reward')?.textContent?.trim()).toBe(
      'Unlocks the Royal theme and the Bouncy flags mode',
    );
    expect(questItem('Moving up')?.querySelector('.reward')?.textContent?.trim()).toBe(
      'Unlocks the No flags mode and the Mirror mode',
    );
  });

  it('opens and closes', () => {
    const dialog = host.querySelector('dialog') as HTMLDialogElement;
    fixture.componentInstance.open();
    expect(dialog.open).toBe(true);
  });
});
