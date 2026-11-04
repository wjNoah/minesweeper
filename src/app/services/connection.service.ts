import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { MatchMessage, parseMatchMessage } from '../models/match.model';
import { MatchTransport } from './match-transport';
import { createRoomCode, normalizeRoomCode } from './room-code';

/**
 * idle → connecting → (host: waiting for the guest) → connected.
 * failed and closed are end states.
 */
export type ConnectionState = 'idle' | 'connecting' | 'waiting' | 'connected' | 'failed' | 'closed';

export type Role = 'host' | 'guest';

/** Close codes sent by the relay (relay/src/index.ts). */
const CLOSE = {
  opponentLeft: 4000,
  notFound: 4004,
  codeTaken: 4009,
  full: 4010,
  tooBig: 4013,
  tooMany: 4029,
  busy: 4503,
} as const;

/** What the relay sends (not a game message): both players are in the room. */
const PAIRED = 'paired';
/** Keeps the connection alive through Wi-Fi routers that drop silent connections. */
const PING_INTERVAL_MS = 30_000;
/** A host waiting longer than this has probably forgotten the room. */
const WAIT_LIMIT_MS = 15 * 60_000;
/** A new room code is tried this often if a code happens to be in use already. */
const MAX_CODE_ATTEMPTS = 3;

const MESSAGES = {
  unreachable:
    'Could not reach the game server. Check your internet connection and try again. ' +
    'If it keeps failing, online play may have reached its daily limit: try again later, ' +
    'or play against the bot.',
  busy: 'Online play has reached its daily limit. Try again later, or play against the bot.',
  invalidCode: 'A room code has 5 letters and numbers, like K7XPM.',
  notFound:
    'There is no room with this code. Check the code, or ask your friend to create a new room.',
  full: 'This room already has two players.',
  tooMany: 'The connection was closed because too many messages were sent.',
  expired: 'The room closed because nobody joined for 15 minutes.',
  lost: 'The connection to the game server was lost.',
};

/**
 * Connects to another person through the relay on Cloudflare. The host creates a
 * room with a random 5-letter code, the guest joins with that code, and from then
 * on the relay passes every message on to the other player.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService implements MatchTransport {
  readonly state = signal<ConnectionState>('idle');
  readonly role = signal<Role | null>(null);
  readonly roomCode = signal('');
  readonly error = signal('');
  /** False until the relay address is filled in (src/environments/environment.ts). */
  readonly isAvailable = environment.relayUrl !== '';

  private socket: WebSocket | null = null;
  private codeAttempts = 0;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private waitTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners = new Set<(message: MatchMessage) => void>();

  /** Creates a room and waits for a guest. */
  host(): void {
    this.codeAttempts = 1;
    this.open('host', createRoomCode());
  }

  join(input: string): void {
    const code = normalizeRoomCode(input);
    if (!code) {
      this.fail(MESSAGES.invalidCode);
      return;
    }
    this.open('guest', code);
  }

  send(message: MatchMessage): void {
    if (this.state() === 'connected' && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /** Calls the listener for every valid message. Returns a function that removes it. */
  onMessage(listener: (message: MatchMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.send({ type: 'leave' });
    this.cleanUp();
    this.state.set('idle');
    this.role.set(null);
    this.roomCode.set('');
    this.error.set('');
  }

  private open(role: Role, code: string): void {
    this.cleanUp();
    this.role.set(role);
    this.roomCode.set(code);
    this.error.set('');
    this.state.set('connecting');

    const query = role === 'host' ? '?create' : '';
    const socket = new WebSocket(`${environment.relayUrl}/room/${code}${query}`);
    let opened = false;
    this.socket = socket;

    socket.onopen = () => {
      opened = true;
      this.pingTimer = setInterval(() => socket.send('ping'), PING_INTERVAL_MS);
      if (role === 'host') {
        this.state.set('waiting');
        this.waitTimer = setTimeout(() => this.fail(MESSAGES.expired), WAIT_LIMIT_MS);
      }
    };
    socket.onmessage = (event: MessageEvent) => this.receive(event.data);
    socket.onclose = (event: CloseEvent) => this.onClosed(event.code, opened);
  }

  private receive(data: unknown): void {
    if (data === 'pong') return;
    if (data === PAIRED) {
      clearTimeout(this.waitTimer);
      this.state.set('connected');
      return;
    }
    // The other player is not trusted: wrong, oversized or odd messages are dropped.
    const message = parseMatchMessage(data);
    if (!message) return;
    if (message.type === 'leave') {
      this.cleanUp();
      this.state.set('closed');
      return;
    }
    this.listeners.forEach((listener) => listener(message));
  }

  /** Turns the relay's close code into what the player sees. */
  private onClosed(code: number, opened: boolean): void {
    const wasConnected = this.state() === 'connected';
    this.cleanUp();
    switch (code) {
      case CLOSE.codeTaken:
        // Someone else is using this code right now: quietly try another one.
        if (this.role() === 'host' && this.codeAttempts < MAX_CODE_ATTEMPTS) {
          this.codeAttempts++;
          this.open('host', createRoomCode());
        } else {
          this.fail(MESSAGES.unreachable);
        }
        return;
      case CLOSE.notFound:
        return this.fail(MESSAGES.notFound);
      case CLOSE.full:
        return this.fail(MESSAGES.full);
      case CLOSE.busy:
        return this.fail(MESSAGES.busy);
      case CLOSE.tooBig:
      case CLOSE.tooMany:
        return this.fail(MESSAGES.tooMany);
    }
    if (wasConnected) {
      this.state.set('closed');
    } else {
      this.fail(opened ? MESSAGES.lost : MESSAGES.unreachable);
    }
  }

  private fail(message: string): void {
    this.cleanUp();
    this.error.set(message);
    this.state.set('failed');
  }

  private cleanUp(): void {
    clearInterval(this.pingTimer);
    clearTimeout(this.waitTimer);
    if (this.socket) {
      // Detach first, so closing on purpose isn't reported as a lost connection.
      this.socket.onopen = this.socket.onmessage = this.socket.onclose = null;
      this.socket.close(1000);
      this.socket = null;
    }
  }
}
