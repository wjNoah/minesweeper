import { Injectable, signal } from '@angular/core';
import { MatchMessage, parseMatchMessage } from '../models/match.model';
import { MatchTransport } from './match-transport';
import { decodeDescription, encodeDescription, InvalidCodeError } from './signaling';

/**
 * idle → preparing (creating a code) → waiting (code shown, waiting for the
 * other code) → connecting → connected. failed and closed are end states.
 */
export type ConnectionState =
  'idle' | 'preparing' | 'waiting' | 'connecting' | 'connected' | 'failed' | 'closed';

export type Role = 'host' | 'guest';

const ICE_GATHERING_TIMEOUT_MS = 4000;
const CONNECT_TIMEOUT_MS = 15000;
const NETWORK_ERROR =
  'Could not connect. Check that both devices are on the same Wi-Fi or hotspot. ' +
  'Some school and public networks block devices from talking to each other.';

/**
 * A direct browser-to-browser connection (WebRTC data channel). No server
 * and no STUN: only addresses in the local network are used, so both devices
 * must be on the same Wi-Fi or hotspot.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService implements MatchTransport {
  readonly state = signal<ConnectionState>('idle');
  readonly role = signal<Role | null>(null);
  /** The code to send to the other player: an invite (host) or a reply (guest). */
  readonly localCode = signal('');
  readonly error = signal('');

  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners = new Set<(message: MatchMessage) => void>();

  /** Host step 1: create the invite code. */
  async host(): Promise<void> {
    try {
      const peer = this.start('host');
      this.attachChannel(peer.createDataChannel('match', { ordered: true }));
      await peer.setLocalDescription(await peer.createOffer());
      await this.publishLocalDescription(peer);
    } catch (error) {
      this.fail(error);
    }
  }

  /** Guest: read the invite and create the reply code. */
  async join(inviteCode: string): Promise<void> {
    try {
      const offer = await decodeDescription(inviteCode, 'offer');
      const peer = this.start('guest');
      peer.ondatachannel = (event) => this.attachChannel(event.channel);
      await peer.setRemoteDescription(offer);
      await peer.setLocalDescription(await peer.createAnswer());
      await this.publishLocalDescription(peer);
      this.startConnectTimer();
    } catch (error) {
      this.fail(error);
    }
  }

  /** Host step 2: read the guest's reply. The connection opens by itself after this. */
  async acceptReply(replyCode: string): Promise<void> {
    if (!this.peer || this.role() !== 'host') return;
    try {
      const answer = await decodeDescription(replyCode, 'answer');
      this.state.set('connecting');
      await this.peer.setRemoteDescription(answer);
      this.startConnectTimer();
    } catch (error) {
      // A wrong code is a typing mistake, so let the host try again.
      if (error instanceof InvalidCodeError) {
        this.error.set(error.message);
        this.state.set('waiting');
      } else {
        this.fail(error);
      }
    }
  }

  send(message: MatchMessage): void {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(message));
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
  }

  private start(role: Role): RTCPeerConnection {
    this.cleanUp();
    this.role.set(role);
    this.error.set('');
    this.localCode.set('');
    this.state.set('preparing');

    const peer = new RTCPeerConnection({ iceServers: [] });
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') this.fail(new Error(NETWORK_ERROR));
    };
    this.peer = peer;
    return peer;
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => {
      clearTimeout(this.connectTimer);
      this.state.set('connected');
    };
    channel.onclose = () => {
      if (this.state() === 'connected') this.state.set('closed');
    };
    channel.onmessage = (event: MessageEvent) => {
      // The other device is not trusted: wrong, oversized or odd messages are dropped.
      const parsed = parseMatchMessage(event.data);
      if (!parsed) return;
      if (parsed.type === 'leave') {
        this.state.set('closed');
        return;
      }
      this.listeners.forEach((listener) => listener(parsed));
    };
  }

  /**
   * The code must contain the network addresses (ICE candidates), because it
   * is the only thing exchanged. So wait until the browser has found them.
   */
  private async publishLocalDescription(peer: RTCPeerConnection): Promise<void> {
    await waitForIceGathering(peer);
    if (!peer.localDescription) throw new Error('No local description');
    this.localCode.set(await encodeDescription(peer.localDescription));
    this.state.set('waiting');
  }

  private startConnectTimer(): void {
    clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      if (this.state() !== 'connected') this.fail(new Error(NETWORK_ERROR));
    }, CONNECT_TIMEOUT_MS);
  }

  private fail(error: unknown): void {
    this.cleanUp();
    this.error.set(error instanceof Error && error.message ? error.message : NETWORK_ERROR);
    this.state.set('failed');
  }

  private cleanUp(): void {
    clearTimeout(this.connectTimer);
    if (this.channel) {
      this.channel.onclose = null;
      this.channel.close();
    }
    this.peer?.close();
    this.channel = null;
    this.peer = null;
  }
}

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ICE_GATHERING_TIMEOUT_MS);
    function done(): void {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', check);
      resolve();
    }
    function check(): void {
      if (peer.iceGatheringState === 'complete') done();
    }
    peer.addEventListener('icegatheringstatechange', check);
  });
}
