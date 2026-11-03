/**
 * Turns WebRTC connection descriptions into short text codes and back.
 * Players copy these codes between devices by hand, so no server is needed.
 * The browser's built-in CompressionStream roughly halves the length.
 */

const CODE_PREFIX = 'MS1.';

export class InvalidCodeError extends Error {}

export async function encodeDescription(description: RTCSessionDescriptionInit): Promise<string> {
  const json = JSON.stringify({ type: description.type, sdp: description.sdp });
  const compressed = await transform(
    new TextEncoder().encode(json),
    new CompressionStream('deflate-raw'),
  );
  return CODE_PREFIX + toBase64Url(compressed);
}

export async function decodeDescription(
  code: string,
  expectedType: 'offer' | 'answer',
): Promise<RTCSessionDescriptionInit> {
  const trimmed = code.replace(/\s/g, '');
  if (!trimmed.startsWith(CODE_PREFIX)) throw new InvalidCodeError('This is not a game code.');
  try {
    const bytes = fromBase64Url(trimmed.slice(CODE_PREFIX.length));
    const json = new TextDecoder().decode(
      await transform(bytes, new DecompressionStream('deflate-raw')),
    );
    const parsed: unknown = JSON.parse(json);
    const { type, sdp } = parsed as Record<string, unknown>;
    if (type !== expectedType || typeof sdp !== 'string') throw new Error();
    return { type: expectedType, sdp };
  } catch {
    const expected = expectedType === 'offer' ? 'an invite code' : 'a reply code';
    throw new InvalidCodeError(`This code is incomplete or not ${expected}.`);
  }
}

async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  // Write and read at the same time; awaiting the write first could stall on big inputs.
  const writer = stream.writable.getWriter();
  writer.write(bytes as BufferSource).catch(() => undefined);
  writer.close().catch(() => undefined);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** Base64 without characters that break in URLs or chat apps (+, /, =). */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
