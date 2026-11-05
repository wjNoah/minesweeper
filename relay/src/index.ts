/**
 * The 1v1 relay. Two players connect to the same room by its 5-letter code, and every
 * message one of them sends is passed on to the other. The relay knows nothing about
 * Minesweeper: the game logic stays in the browsers.
 *
 * Each room is a Durable Object: one small instance per room code, which Cloudflare
 * starts where the first player connects. It uses the WebSocket Hibernation API, so
 * between messages the room sleeps and costs nothing.
 */
import { DurableObject } from 'cloudflare:workers';

interface Env {
  ROOMS: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
}

type Role = 'host' | 'guest';

/** Same letters as the game (src/app/services/room-code.ts): no 0/O, 1/I/L. */
const ROOM_PATH = /^\/room\/([ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5})$/;

/** Close codes the game understands (4000-4999 are free for apps to use). */
const CLOSE = {
  opponentLeft: 4000,
  notFound: 4004,
  codeTaken: 4009,
  full: 4010,
  tooBig: 4013,
  tooMany: 4029,
  busy: 4503,
} as const;

/** Real game messages are well under 1 KB. */
const MAX_MESSAGE_CHARS = 10_000;
/** The game sends at most about 2 messages a second, so this only stops scripts. */
const RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 60;

/** Sent to both players when the guest has joined. */
const PAIRED = 'paired';
/** The host's secret, which lets the same host come back to the room (see fetch below). */
const HOST_KEY = /^[A-Za-z0-9]{16,64}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const code = new URL(request.url).pathname.match(ROOM_PATH)?.[1];
    if (!code) return new Response('Minesweeper 1v1 relay', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    // Other websites may not use this relay. (Scripts can fake the origin, so the
    // limits in the room still apply.)
    if (!isAllowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      return await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
    } catch {
      // Most likely the free daily limit is used up. Tell the game so it can say so.
      return rejectSocket(CLOSE.busy, 'Server busy');
    }
  },
};

export class MatchRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered by Cloudflare without waking the room (and are free).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  override async fetch(request: Request): Promise<Response> {
    const hostKey = new URL(request.url).searchParams.get('create');
    const creating = hostKey !== null;
    const hosts = this.ctx.getWebSockets('host').filter((socket) => !playerOf(socket).replaced);
    const guests = this.ctx.getWebSockets('guest').length;

    // A phone drops the connection when the host switches to a chat app to send the code.
    // The old socket may still look alive here, so a host with the right key takes over.
    const previous = HOST_KEY.test(hostKey ?? '')
      ? hosts.find((socket) => playerOf(socket).key === hostKey)
      : undefined;
    if (previous) {
      previous.serializeAttachment({ ...playerOf(previous), replaced: true });
      closeQuietly(previous, CLOSE.opponentLeft, 'Replaced');
    } else {
      if (creating && hosts.length + guests > 0) return rejectSocket(CLOSE.codeTaken, 'Code taken');
      if (!creating && hosts.length === 0) return rejectSocket(CLOSE.notFound, 'Room not found');
      if (!creating && guests > 0) return rejectSocket(CLOSE.full, 'Room full');
    }

    const role: Role = creating ? 'host' : 'guest';
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment(newPlayer(hostKey ?? ''));
    if (role === 'guest' || guests > 0) {
      this.ctx
        .getWebSockets()
        .filter((socket) => !playerOf(socket).replaced)
        .forEach((socket) => sendQuietly(socket, PAIRED));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_CHARS) {
      socket.close(CLOSE.tooBig, 'Message too big');
      return;
    }
    if (!this.countMessage(socket)) {
      socket.close(CLOSE.tooMany, 'Too many messages');
      return;
    }
    this.others(socket).forEach((other) => sendQuietly(other, message));
  }

  /** One player left, so the match is over: close the room for the other one too. */
  override webSocketClose(socket: WebSocket): void {
    if (playerOf(socket).replaced) return; // The host is back on a new connection.
    this.others(socket).forEach((other) =>
      closeQuietly(other, CLOSE.opponentLeft, 'Opponent left'),
    );
  }

  override webSocketError(socket: WebSocket): void {
    this.webSocketClose(socket);
  }

  private others(socket: WebSocket): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((other) => other !== socket && !playerOf(other).replaced);
  }

  /**
   * Counts messages per player in 10-second windows. The count is stored on the
   * socket itself, because the room forgets everything else while it hibernates.
   */
  private countMessage(socket: WebSocket): boolean {
    const player = playerOf(socket);
    const fresh = Date.now() - player.start > RATE_WINDOW_MS;
    const count = fresh ? 1 : player.count + 1;
    socket.serializeAttachment({ ...player, count, start: fresh ? Date.now() : player.start });
    return count <= MAX_MESSAGES_PER_WINDOW;
  }
}

/** Stored on the socket, because it has to survive while the room hibernates. */
interface Player {
  /** The host's secret; empty for guests. */
  key: string;
  /** This host came back on a new connection, so this old socket no longer counts. */
  replaced: boolean;
  start: number;
  count: number;
}

function newPlayer(key: string): Player {
  return { key, replaced: false, start: Date.now(), count: 0 };
}

function playerOf(socket: WebSocket): Player {
  return socket.deserializeAttachment() as Player;
}

/** The other player can disconnect at any moment. That must not break this message. */
function sendQuietly(socket: WebSocket, message: string): void {
  try {
    socket.send(message);
  } catch {
    // Already closing: webSocketClose takes care of the room.
  }
}

function closeQuietly(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // Already closed.
  }
}

/**
 * A browser can't read the reason from a refused HTTP request, only from a closed
 * WebSocket. So accept the connection and close it straight away with a code.
 */
function rejectSocket(code: number, reason: string): Response {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client });
}

function isAllowedOrigin(origin: string | null, allowed: string): boolean {
  return (
    origin !== null &&
    allowed
      .split(',')
      .map((entry) => entry.trim())
      .includes(origin)
  );
}
