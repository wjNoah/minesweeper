import { TestBed } from '@angular/core/testing';
import { BestTimesService } from './best-times.service';

describe('BestTimesService', () => {
  beforeEach(() => localStorage.clear());

  it('loads saved times and ignores invalid entries', () => {
    localStorage.setItem(
      'minesweeper.bestTimes',
      JSON.stringify({ beginner: 12, expert: 'fast', unknown: 3 }),
    );
    const service = TestBed.inject(BestTimesService);
    expect(service.times()).toEqual({ beginner: 12 });
  });

  it('survives broken JSON in storage', () => {
    localStorage.setItem('minesweeper.bestTimes', '{not json');
    expect(TestBed.inject(BestTimesService).times()).toEqual({});
  });

  it('only records faster times', () => {
    const service = TestBed.inject(BestTimesService);
    expect(service.record('intermediate', 80)).toBe(true);
    expect(service.record('intermediate', 95)).toBe(false);
    expect(service.record('intermediate', 70)).toBe(true);
    expect(service.times().intermediate).toBe(70);
  });

  it('an equal time is not a new record', () => {
    const service = TestBed.inject(BestTimesService);
    service.record('beginner', 30);
    expect(service.record('beginner', 30)).toBe(false);
  });

  it('keeps a record for this visit when storage is full or blocked', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const service = TestBed.inject(BestTimesService);
    expect(service.record('expert', 200)).toBe(true);
    expect(service.times().expert).toBe(200);
    setItem.mockRestore();
  });

  it('clear forgets the records, also after a reload', () => {
    const service = TestBed.inject(BestTimesService);
    service.record('beginner', 30);
    service.clear();
    expect(service.times()).toEqual({});
    expect(localStorage.getItem('minesweeper.bestTimes')).toBeNull();
  });
});
