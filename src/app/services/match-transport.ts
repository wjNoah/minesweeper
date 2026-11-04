import { Signal } from '@angular/core';
import { MatchMessage } from '../models/match.model';
import { ConnectionState, Role } from './connection.service';

/**
 * How the match service talks to its opponent. Two kinds exist: ConnectionService
 * (another person over the network) and BotOpponent (the computer, on this device).
 * The match logic does not care which one it is talking to.
 */
export interface MatchTransport {
  readonly state: Signal<ConnectionState>;
  readonly role: Signal<Role | null>;
  send(message: MatchMessage): void;
  onMessage(listener: (message: MatchMessage) => void): () => void;
  close(): void;
}
