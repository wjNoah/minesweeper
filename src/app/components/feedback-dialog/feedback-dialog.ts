import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FEEDBACK_KINDS,
  feedbackError,
  FeedbackKind,
  MAX_EMAIL_CHARS,
  MAX_FEEDBACK_CHARS,
} from '../../models/feedback.model';
import { FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-feedback-dialog',
  templateUrl: './feedback-dialog.html',
  styleUrl: './feedback-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackDialog {
  protected readonly feedback = inject(FeedbackService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly kinds = FEEDBACK_KINDS;
  protected readonly maxMessage = MAX_FEEDBACK_CHARS;
  protected readonly maxEmail = MAX_EMAIL_CHARS;

  protected readonly kind = signal<FeedbackKind>('other');
  /** Kept when the dialog closes or sending fails, so nothing typed is lost. */
  protected readonly message = signal('');
  protected readonly email = signal('');
  protected readonly inputError = signal('');

  open(): void {
    // After a "thanks" the form starts fresh; after an error the text is still there.
    if (this.feedback.status() === 'sent') this.feedback.reset();
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected async submit(event: Event, botField: string): Promise<void> {
    event.preventDefault();
    const entry = {
      kind: this.kind(),
      message: this.message(),
      email: this.email(),
      botField,
    };
    const error = feedbackError(entry);
    this.inputError.set(error ?? '');
    if (error) return;

    if (await this.feedback.send(entry)) {
      this.kind.set('other');
      this.message.set('');
      this.email.set('');
    }
  }
}
