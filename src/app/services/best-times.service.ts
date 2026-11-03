import { Injectable, signal } from '@angular/core';
import { PRESETS, PresetId } from '../models/game.model';

/** No-guess games have their own records, since they never end in a forced guess. */
export type BestTimeKey = PresetId | `${PresetId}-ng`;
export type BestTimes = Partial<Record<BestTimeKey, number>>;

const STORAGE_KEY = 'minesweeper.bestTimes';

@Injectable({ providedIn: 'root' })
export class BestTimesService {
  readonly times = signal<BestTimes>(loadBestTimes());

  /** Saves the time if it beats the current best. Returns true for a new record. */
  record(key: BestTimeKey, seconds: number): boolean {
    const best = this.times()[key];
    if (best !== undefined && best <= seconds) return false;

    this.times.update((times) => ({ ...times, [key]: seconds }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.times()));
    } catch {
      // Storage can be full or blocked (private mode). The record still counts for this session.
    }
    return true;
  }

  clear(): void {
    this.times.set({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing stored, or storage blocked.
    }
  }
}

function loadBestTimes(): BestTimes {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};

    const stored = parsed as Record<string, unknown>;
    const times: BestTimes = {};
    const keys = PRESETS.flatMap(({ id }): BestTimeKey[] => [id, `${id}-ng`]);
    for (const key of keys) {
      const value = stored[key];
      if (typeof value === 'number' && value >= 0) times[key] = value;
    }
    return times;
  } catch {
    return {};
  }
}
