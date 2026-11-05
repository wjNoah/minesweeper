import { TestBed } from '@angular/core/testing';
import { MatchMessage } from '../models/match.model';
import { ConnectionService } from './connection.service';

/** Stands in for the browser's WebSocket: tests play the relay's part. */
class FakeSocket {
  static readonly OPEN = 1;
  static all: FakeSocket[] = [];

  readyState = 0;
  readonly sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  closedByClient = false;

  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closedByClient = true;
  }

  // What the relay does:
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(data: string): void {
    this.onmessage?.({ data });
  }
  closeFromServer(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

describe('ConnectionService', () => {
  let connection: ConnectionService;
  const latest = () => FakeSocket.all[FakeSocket.all.length - 1];

  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    connection = TestBed.inject(ConnectionService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('host creates a room, waits, and is connected when the guest joins', () => {
    connection.host();
    expect(latest().url).toMatch(/\/room\/[A-Z2-9]{5}\?create=[A-Z2-9]{24}$/);
    expect(latest().url).toContain(connection.roomCode());
    expect(connection.state()).toBe('connecting');

    latest().open();
    expect(connection.state()).toBe('waiting');

    latest().receive('paired');
    expect(connection.state()).toBe('connected');
    expect(connection.role()).toBe('host');
  });

  it('guest joins with a typed code and becomes connected once paired', () => {
    connection.join(' k7x-pm ');
    expect(latest().url).toMatch(/\/room\/K7XPM$/);
    latest().open();
    expect(connection.state()).toBe('connecting');
    latest().receive('paired');
    expect(connection.state()).toBe('connected');
    expect(connection.role()).toBe('guest');
  });

  it('refuses a code that cannot exist without contacting the server', () => {
    connection.join('K7X');
    expect(FakeSocket.all.length).toBe(0);
    expect(connection.state()).toBe('failed');
    expect(connection.error()).toContain('5 letters');
  });

  it('sends game messages as JSON and passes on valid ones only', () => {
    const received: MatchMessage[] = [];
    connection.onMessage((message) => received.push(message));
    connection.join('K7XPM');
    latest().open();
    latest().receive('paired');

    connection.send({ type: 'rematch' });
    expect(latest().sent).toContain('{"type":"rematch"}');

    latest().receive('{"type":"rematch"}');
    latest().receive('{"type":"progress","round":1,"revealed":-5,"minesHit":0}');
    latest().receive('not json');
    latest().receive('pong');
    expect(received).toEqual([{ type: 'rematch' }]);
  });

  it('sends nothing before both players are in the room', () => {
    connection.host();
    latest().open();
    connection.send({ type: 'rematch' });
    expect(latest().sent).toEqual([]);
  });

  it('explains why the relay refused to join', () => {
    connection.join('K7XPM');
    latest().open();
    latest().closeFromServer(4004);
    expect(connection.state()).toBe('failed');
    expect(connection.error()).toContain('no room with this code');

    connection.join('K7XPM');
    latest().open();
    latest().closeFromServer(4010);
    expect(connection.error()).toContain('two players');

    connection.join('K7XPM');
    latest().closeFromServer(4503);
    expect(connection.error()).toContain('daily limit');
  });

  it('says the server is unreachable when the connection never opened', () => {
    connection.host();
    latest().closeFromServer(1006);
    expect(connection.state()).toBe('failed');
    expect(connection.error()).toContain('Could not reach the game server');
  });

  it('tries a new code when the random one is already in use', () => {
    connection.host();
    const first = latest();
    first.open();
    first.closeFromServer(4009);
    expect(FakeSocket.all.length).toBe(2);
    expect(latest().url).toContain('?create');
    expect(latest().url).not.toBe(first.url);
  });

  it('is closed when the opponent leaves', () => {
    connection.join('K7XPM');
    latest().open();
    latest().receive('paired');
    latest().closeFromServer(4000);
    expect(connection.state()).toBe('closed');
  });

  it('sends a leave message and closes the socket when leaving', () => {
    connection.join('K7XPM');
    const socket = latest();
    socket.open();
    socket.receive('paired');
    connection.close();
    expect(socket.sent).toContain('{"type":"leave"}');
    expect(socket.closedByClient).toBe(true);
    expect(connection.state()).toBe('idle');
  });

  it('keeps the connection alive with pings', () => {
    connection.host();
    latest().open();
    vi.advanceTimersByTime(15_000);
    expect(latest().sent).toEqual(['ping']);
  });

  it('notices a silently dead connection during a match', () => {
    connection.join('K7XPM');
    latest().open();
    latest().receive('paired');

    vi.advanceTimersByTime(30_000);
    expect(connection.state()).toBe('connected'); // Two pings unanswered: maybe just slow.
    vi.advanceTimersByTime(15_000);
    expect(connection.state()).toBe('closed');
    expect(latest().closedByClient).toBe(true);
  });

  it('stays connected as long as pings are answered', () => {
    connection.join('K7XPM');
    latest().open();
    latest().receive('paired');
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(15_000);
      latest().receive('pong');
    }
    expect(connection.state()).toBe('connected');
  });

  it('gives up on an attempt that hangs (for example behind a firewall)', () => {
    connection.join('K7XPM');
    vi.advanceTimersByTime(15_000);
    expect(connection.state()).toBe('failed');
    expect(connection.error()).toContain('Could not reach the game server');
  });

  it('gives up when the relay opens but never pairs the guest', () => {
    connection.join('K7XPM');
    latest().open();
    vi.advanceTimersByTime(15_000);
    expect(connection.state()).toBe('failed');
  });

  describe('waiting host who loses the connection', () => {
    it('returns to the same room with the same code and key', () => {
      connection.host();
      const first = latest();
      first.open();
      const code = connection.roomCode();

      first.closeFromServer(1006);
      expect(connection.state()).toBe('waiting');
      expect(connection.reconnecting()).toBe(true);
      expect(connection.roomCode()).toBe(code);

      vi.advanceTimersByTime(2000);
      expect(latest()).not.toBe(first);
      expect(latest().url).toBe(first.url);

      latest().open();
      expect(connection.reconnecting()).toBe(false);
      latest().receive('paired');
      expect(connection.state()).toBe('connected');
    });

    it('keeps trying, and the 15-minute limit still ends it', () => {
      connection.host();
      latest().open();
      latest().closeFromServer(1006);
      vi.advanceTimersByTime(2000);
      latest().closeFromServer(1006); // Still offline.
      vi.advanceTimersByTime(2000);
      expect(connection.state()).toBe('waiting');
      expect(FakeSocket.all.length).toBe(3);

      vi.advanceTimersByTime(15 * 60_000);
      expect(connection.state()).toBe('failed');
      expect(connection.error()).toContain('nobody joined');
    });

    it('stops trying after the host goes back', () => {
      connection.host();
      latest().open();
      latest().closeFromServer(1006);
      connection.close();
      vi.advanceTimersByTime(60_000);
      expect(FakeSocket.all.length).toBe(1);
      expect(connection.state()).toBe('idle');
      expect(connection.reconnecting()).toBe(false);
    });
  });

  it('an old connection attempt cannot affect a new one', () => {
    connection.join('K7XPM');
    connection.join('ABCDE');
    expect(FakeSocket.all[0].closedByClient).toBe(true);
    vi.advanceTimersByTime(14_000);
    latest().open();
    latest().receive('paired');
    vi.advanceTimersByTime(5_000);
    expect(connection.state()).toBe('connected');
  });

  it('closes a room that nobody joined for 15 minutes', () => {
    connection.host();
    const socket = latest();
    socket.open();
    vi.advanceTimersByTime(15 * 60_000);
    expect(connection.state()).toBe('failed');
    expect(connection.error()).toContain('nobody joined');
    expect(socket.closedByClient).toBe(true);
  });
});
