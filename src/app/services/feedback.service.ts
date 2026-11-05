import { Injectable, signal } from '@angular/core';
import { encodeFeedback, Feedback } from '../models/feedback.model';

export type FeedbackStatus = 'idle' | 'sending' | 'sent' | 'failed';

/** A bad connection should end in an error the player can react to, not endless waiting. */
const SEND_TIMEOUT_MS = 15_000;

/** Sends feedback to Netlify Forms, which collects it for the site owner. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  readonly status = signal<FeedbackStatus>('idle');

  /** Returns true when the feedback arrived. */
  async send(feedback: Feedback): Promise<boolean> {
    if (this.status() === 'sending') return false;
    this.status.set('sending');
    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeFeedback(feedback),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      this.status.set(response.ok ? 'sent' : 'failed');
    } catch {
      this.status.set('failed');
    }
    return this.status() === 'sent';
  }

  reset(): void {
    if (this.status() !== 'sending') this.status.set('idle');
  }
}
