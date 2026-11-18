import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchMessage } from '../../models/match.model';
import { ConnectionService, ConnectionState, Role } from '../../services/connection.service';
import { MatchService } from '../../services/match.service';
import { MatchDialog } from './match-dialog';

class FakeConnection {
  readonly state = signal<ConnectionState>('idle');
  readonly role = signal<Role | null>(null);
  readonly roomCode = signal('');
  readonly error = signal('');
  readonly reconnecting = signal(false);
  readonly isAvailable = true;
  readonly joined: string[] = [];
  hosted = 0;
  private listener: ((message: MatchMessage) => void) | null = null;

  host(): void {
    this.hosted++;
    this.role.set('host');
    this.roomCode.set('K7XPM');
    this.state.set('waiting');
  }
  join(code: string): void {
    this.joined.push(code);
    this.role.set('guest');
    this.state.set('connecting');
  }
  send(): void {}
  onMessage(listener: (message: MatchMessage) => void): () => void {
    this.listener = listener;
    return () => (this.listener = null);
  }
  close(): void {
    this.state.set('idle');
    this.role.set(null);
  }
}

describe('MatchDialog', () => {
  let connection: FakeConnection;
  let fixture: ComponentFixture<MatchDialog>;
  let host: HTMLElement;
  let dialog: HTMLDialogElement;

  const button = (label: string) =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
  const refresh = () => {
    TestBed.tick();
    fixture.detectChanges();
  };
  const click = (label: string) => {
    button(label)?.click();
    refresh();
  };

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // The test browser (jsdom) has no modal dialogs, so these only set the open state.
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };

    connection = new FakeConnection();
    TestBed.configureTestingModule({
      providers: [{ provide: ConnectionService, useValue: connection }],
    });
    fixture = TestBed.createComponent(MatchDialog);
    refresh();
    host = fixture.nativeElement as HTMLElement;
    dialog = host.querySelector('dialog') as HTMLDialogElement;
  });

  afterEach(() => vi.useRealTimers());

  function connectAsHost(): void {
    fixture.componentInstance.open();
    click('Create a room');
    connection.state.set('connected');
    refresh();
  }

  it('offers a room, joining and the bot', () => {
    fixture.componentInstance.open();
    refresh();
    expect(button('Create a room')).toBeDefined();
    expect(button('Join a room')).toBeDefined();
    expect(button('Play against a bot')).toBeDefined();
  });

  it('shows the room code to the host, spelled out for screen readers', () => {
    fixture.componentInstance.open();
    click('Create a room');

    expect(connection.hosted).toBe(1);
    const code = host.querySelector('.room-code');
    expect(code?.textContent?.trim()).toBe('K7XPM');
    expect(code?.getAttribute('aria-label')).toBe('Room code K 7 X P M');
  });

  it('says so while the host is getting back into the room', () => {
    fixture.componentInstance.open();
    click('Create a room');
    connection.reconnecting.set(true);
    refresh();
    expect(host.querySelector('.status')?.textContent).toContain('getting back into the room');
  });

  it('passes the typed code on, with the Join button and with Enter', () => {
    fixture.componentInstance.open();
    click('Join a room');
    const input = host.querySelector('#room-code-input') as HTMLInputElement;
    input.value = 'k7xpm';
    input.dispatchEvent(new Event('input'));

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(connection.joined).toEqual(['k7xpm']);

    connection.state.set('failed');
    connection.error.set('There is no room with this code.');
    refresh();
    button('Join')?.click();
    expect(connection.joined).toEqual(['k7xpm', 'k7xpm']);
  });

  it('keeps a mistyped code and shows the error, so it can be fixed', () => {
    fixture.componentInstance.open();
    click('Join a room');
    const input = host.querySelector('#room-code-input') as HTMLInputElement;
    input.value = 'K7XPN';
    input.dispatchEvent(new Event('input'));
    button('Join')?.click();
    refresh();
    expect(host.querySelector('#room-code-input')).toBeNull(); // Connecting…

    connection.state.set('failed');
    connection.error.set('There is no room with this code.');
    refresh();
    expect(host.querySelector('.error')?.textContent).toContain('no room with this code');
    expect((host.querySelector('#room-code-input') as HTMLInputElement).value).toBe('K7XPN');
  });

  it('shows the start screen again after a match, not the join form', () => {
    fixture.componentInstance.open();
    click('Join a room');
    connection.state.set('connected');
    refresh();
    connection.close();
    refresh();

    expect(host.querySelector('#room-code-input')).toBeNull();
    expect(button('Create a room')).toBeDefined();
  });

  it('opens by itself when the friend joins while the host had closed it', () => {
    fixture.componentInstance.open();
    click('Create a room');
    fixture.componentInstance.close();
    expect(dialog.open).toBe(false);

    connection.state.set('connected');
    refresh();
    expect(dialog.open).toBe(true);
    expect(host.querySelector('.connected')?.textContent).toContain('Connected');
  });

  it('stays closed when the host closes it again after that', () => {
    connectAsHost();
    fixture.componentInstance.close();
    refresh();
    expect(dialog.open).toBe(false);
  });

  it('the host can change the rules, the guest only sees them', () => {
    connectAsHost();
    expect(button('Expert')?.disabled).toBe(false);
    click('Expert');
    expect(TestBed.inject(MatchService).rules().preset).toBe('expert');

    connection.role.set('guest');
    refresh();
    expect(button('Beginner')?.disabled).toBe(true);
    expect(host.querySelector('section .hint')?.textContent).toContain('host chooses');
  });

  it('closes when a round starts and locks everything if it is reopened during the race', () => {
    connectAsHost();
    click('Start round');
    expect(dialog.open).toBe(false);

    fixture.componentInstance.open();
    refresh();
    expect(button('Start round')?.disabled).toBe(true);
    expect(button('Expert')?.disabled).toBe(true);
    expect(host.querySelector('input[role="switch"]')).toHaveProperty('disabled', true);
    expect(host.querySelector('section .hint')?.textContent).toContain('A round is running');
  });

  it('the bot needs no connection and has its own strength setting', () => {
    fixture.componentInstance.open();
    click('Play against a bot');

    expect(TestBed.inject(MatchService).isBot()).toBe(true);
    expect(host.querySelector('.connected')).toBeNull();
    click('Hard');
    expect(TestBed.inject(MatchService).botLevel()).toBe('hard');
    expect(button('Start round')?.disabled).toBe(false);
  });
});
