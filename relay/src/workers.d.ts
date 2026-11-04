/**
 * The few Cloudflare Workers types the relay uses, so it type-checks without
 * installing @cloudflare/workers-types. Wrangler itself does not need this file.
 */
declare module 'cloudflare:workers' {
  export abstract class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;
    constructor(ctx: DurableObjectState, env: Env);
    fetch?(request: Request): Promise<Response>;
    webSocketMessage?(socket: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
    webSocketClose?(socket: WebSocket, code: number, reason: string, wasClean: boolean): void;
    webSocketError?(socket: WebSocket, error: unknown): void;
  }
}

interface DurableObjectState {
  acceptWebSocket(socket: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  setWebSocketAutoResponse(pair: WebSocketRequestResponsePair): void;
}

interface DurableObjectId {}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

declare class WebSocketRequestResponsePair {
  constructor(request: string, response: string);
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

interface WebSocket {
  accept(): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

interface ResponseInit {
  webSocket?: WebSocket | null;
}
