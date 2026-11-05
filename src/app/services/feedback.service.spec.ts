import { TestBed } from '@angular/core/testing';
import {
  encodeFeedback,
  Feedback,
  feedbackError,
  MAX_FEEDBACK_CHARS,
} from '../models/feedback.model';
import { FeedbackService } from './feedback.service';

const FEEDBACK: Feedback = { kind: 'bug', message: 'It broke', email: '', botField: '' };

describe('feedback', () => {
  describe('feedbackError', () => {
    it('accepts a message without an email', () => {
      expect(feedbackError(FEEDBACK)).toBeNull();
    });

    it('needs a message', () => {
      expect(feedbackError({ ...FEEDBACK, message: '   ' })).toContain('short message');
    });

    it('limits the length', () => {
      const message = 'x'.repeat(MAX_FEEDBACK_CHARS + 1);
      expect(feedbackError({ ...FEEDBACK, message })).toContain('under');
    });

    it('checks an email only when one is given', () => {
      expect(feedbackError({ ...FEEDBACK, email: 'a@b.at' })).toBeNull();
      expect(feedbackError({ ...FEEDBACK, email: ' a@b.at ' })).toBeNull();
      expect(feedbackError({ ...FEEDBACK, email: 'nope' })).toContain('email');
      expect(feedbackError({ ...FEEDBACK, email: 'a b@c.at' })).toContain('email');
    });
  });

  it('encodes the fields Netlify expects, including special characters', () => {
    const body = new URLSearchParams(
      encodeFeedback({ kind: 'idea', message: ' 50% & more ', email: ' a@b.at ', botField: 'x' }),
    );
    expect(body.get('form-name')).toBe('feedback');
    expect(body.get('kind')).toBe('idea');
    expect(body.get('message')).toBe('50% & more');
    expect(body.get('email')).toBe('a@b.at');
    expect(body.get('bot-field')).toBe('x');
  });

  describe('FeedbackService', () => {
    let service: FeedbackService;
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
      service = TestBed.inject(FeedbackService);
    });

    afterEach(() => vi.unstubAllGlobals());

    it('posts the form to the site itself', async () => {
      fetchMock.mockResolvedValue(new Response('', { status: 200 }));
      expect(await service.send(FEEDBACK)).toBe(true);
      expect(service.status()).toBe('sent');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/');
      expect(init?.method).toBe('POST');
      expect(String(init?.body)).toContain('form-name=feedback');
    });

    it('reports a failure when the server refuses', async () => {
      fetchMock.mockResolvedValue(new Response('', { status: 404 }));
      expect(await service.send(FEEDBACK)).toBe(false);
      expect(service.status()).toBe('failed');
    });

    it('reports a failure when there is no connection', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      expect(await service.send(FEEDBACK)).toBe(false);
      expect(service.status()).toBe('failed');
    });

    it('does not send twice while sending', async () => {
      let finish = (_: Response) => {};
      fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const first = service.send(FEEDBACK);
      expect(await service.send(FEEDBACK)).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      finish(new Response('', { status: 200 }));
      expect(await first).toBe(true);
    });
  });
});
