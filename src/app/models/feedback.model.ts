export type FeedbackKind = 'bug' | 'idea' | 'other';

export const FEEDBACK_KINDS: readonly { id: FeedbackKind; label: string }[] = [
  { id: 'bug', label: 'Bug' },
  { id: 'idea', label: 'Idea' },
  { id: 'other', label: 'Other' },
];

export const MAX_FEEDBACK_CHARS = 2000;
export const MAX_EMAIL_CHARS = 254;

export interface Feedback {
  kind: FeedbackKind;
  message: string;
  /** Optional: only for people who would like a reply. */
  email: string;
  /** A field people never see. Bots fill it in, so Netlify can sort them out as spam. */
  botField: string;
}

/** Returns what is wrong for the player to read, or null when the feedback can be sent. */
export function feedbackError({ message, email }: Feedback): string | null {
  if (message.trim().length === 0) return 'Please write a short message.';
  if (message.length > MAX_FEEDBACK_CHARS) {
    return `Please keep it under ${MAX_FEEDBACK_CHARS} characters.`;
  }
  const address = email.trim();
  if (
    address.length > MAX_EMAIL_CHARS ||
    (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
  ) {
    return 'This email address looks wrong. It is optional, so you can also leave it empty.';
  }
  return null;
}

/**
 * The form as Netlify expects it. The names must match the hidden form in index.html,
 * because Netlify only keeps the fields it found there when it deployed the site.
 */
export function encodeFeedback({ kind, message, email, botField }: Feedback): string {
  return new URLSearchParams({
    'form-name': 'feedback',
    kind,
    message: message.trim(),
    email: email.trim(),
    'bot-field': botField,
  }).toString();
}
