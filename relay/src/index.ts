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
    const creating = new URL(request.url).searchParams.has('create');
    const hosts = this.ctx.getWebSockets('host').length;
    const guests = this.ctx.getWebSockets('guest').length;

    if (creating && hosts + guests > 0) return rejectSocket(CLOSE.codeTaken, 'Code taken');
    if (!creating && hosts === 0) return rejectSocket(CLOSE.notFound, 'Room not found');
    if (!creating && guests > 0) return rejectSocket(CLOSE.full, 'Room full');

    const role: Role = creating ? 'host' : 'guest';
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment(newWindow());
    if (role === 'guest') this.ctx.getWebSockets().forEach((socket) => socket.send(PAIRED));

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
    this.others(socket).forEach((other) => other.send(message));
  }

  /** One player left, so the match is over: close the room for the other one too. */
  override webSocketClose(socket: WebSocket): void {
    this.others(socket).forEach((other) => other.close(CLOSE.opponentLeft, 'Opponent left'));
  }

  override webSocketError(socket: WebSocket): void {
    this.webSocketClose(socket);
  }

  private others(socket: WebSocket): WebSocket[] {
    return this.ctx.getWebSockets().filter((other) => other !== socket);
  }

  /**
   * Counts messages per player in 10-second windows. The count is stored on the
   * socket itself, because the room forgets everything else while it hibernates.
   */
  private countMessage(socket: WebSocket): boolean {
    let window = socket.deserializeAttachment() as RateWindow;
    if (Date.now() - window.start > RATE_WINDOW_MS) window = newWindow();
    window.count++;
    socket.serializeAttachment(window);
    return window.count <= MAX_MESSAGES_PER_WINDOW;
  }
}

interface RateWindow {
  start: number;
  count: number;
}

function newWindow(): RateWindow {
  return { start: Date.now(), count: 0 };
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
