import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedbackDialog } from './feedback-dialog';

describe('FeedbackDialog', () => {
  let fixture: ComponentFixture<FeedbackDialog>;
  let host: HTMLElement;
  const fetchMock = vi.fn<typeof fetch>();

  const textarea = () => host.querySelector('textarea') as HTMLTextAreaElement;
  const email = () => host.querySelector('input[type="email"]') as HTMLInputElement;
  const botField = () => host.querySelector('input[name="bot-field"]') as HTMLInputElement;
  const footerButtons = () =>
    [...host.querySelectorAll('.foot button')].map((b) => b.textContent?.trim());
  const sentBody = () => new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body));

  function type(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    host
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    fixture = TestBed.createComponent(FeedbackDialog);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('stops an empty message before anything is sent', async () => {
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.querySelector('.error')?.textContent).toContain('short message');
  });

  it('stops a wrong email before anything is sent', async () => {
    type(textarea(), 'Nice game');
    type(email(), 'nope');
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.querySelector('.error')?.textContent).toContain('email address');
  });

  it('sends what the player chose and typed', async () => {
    [...host.querySelectorAll('.segmented button')]
      .find((b) => b.textContent?.includes('Bug'))
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    type(textarea(), 'The timer jumps');
    type(email(), 'me@example.at');
    await submit();

    expect(sentBody().get('kind')).toBe('bug');
    expect(sentBody().get('message')).toBe('The timer jumps');
    expect(sentBody().get('email')).toBe('me@example.at');
    expect(sentBody().get('bot-field')).toBe('');
  });

  it('passes the hidden trap field on, so Netlify can recognize a bot', async () => {
    type(textarea(), 'Buy my stuff');
    botField().value = 'bot was here';
    await submit();
    expect(sentBody().get('bot-field')).toBe('bot was here');
  });

  it('thanks the player, and the form is empty the next time', async () => {
    type(textarea(), 'Nice game');
    type(email(), 'me@example.at');
    await submit();
    expect(host.querySelector('.thanks')?.textContent).toContain('Thanks');
    expect(footerButtons()).toEqual(['Done']);

    fixture.componentInstance.open();
    fixture.detectChanges();
    expect(host.querySelector('.thanks')).toBeNull();
    expect(textarea().value).toBe('');
    expect(email().value).toBe('');
  });

  it('keeps the text when sending fails, so it can be sent again', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    type(textarea(), 'A long and careful message');
    await submit();

    expect(host.querySelector('.error')?.textContent).toContain('could not be sent');
    expect(textarea().value).toBe('A long and careful message');
    expect(footerButtons()).toContain('Send');
  });

  it('keeps unsent text when the dialog is closed and opened again', () => {
    fixture.componentInstance.open();
    type(textarea(), 'Half a thought');
    fixture.componentInstance.close();
    fixture.componentInstance.open();
    fixture.detectChanges();
    expect(textarea().value).toBe('Half a thought');
  });

  it('cannot be sent twice while sending', async () => {
    let finish = (_: Response) => {};
    fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    type(textarea(), 'Nice game');
    host
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    const send = host.querySelector('.foot .primary') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    expect(send.textContent).toContain('Sending');

    finish(new Response('', { status: 200 }));
    await fixture.whenStable();
  });
});
