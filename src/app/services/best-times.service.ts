import { Injectable, signal } from '@angular/core';
import { PRESETS, PresetId } from '../models/game.model';

export type BestTimes = Partial<Record<PresetId, number>>;

const STORAGE_KEY = 'minesweeper.bestTimes';

@Injectable({ providedIn: 'root' })
export class BestTimesService {
  readonly times = signal<BestTimes>(loadBestTimes());

  /** Saves the time if it beats the current best. Returns true for a new record. */
  record(preset: PresetId, seconds: number): boolean {
    const best = this.times()[preset];
    if (best !== undefined && best <= seconds) return false;

    this.times.update((times) => ({ ...times, [preset]: seconds }));
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
    for (const { id } of PRESETS) {
      const value = stored[id];
      if (typeof value === 'number' && value >= 0) times[id] = value;
    }
    return times;
  } catch {
    return {};
  }
}
