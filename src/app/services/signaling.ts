/**
 * Turns WebRTC connection descriptions into short text codes and back.
 * Players copy these codes between devices by hand, so no server is needed.
 * The browser's built-in CompressionStream roughly halves the length.
 */

const CODE_PREFIX = 'MS1.';
/** Real codes are about 600 characters. */
const MAX_CODE_CHARS = 20_000;
/** A real connection description is a few KB. */
const MAX_SDP_BYTES = 40_000;

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
  if (trimmed.length > MAX_CODE_CHARS) throw new InvalidCodeError('This code is too long.');

  let sdp: string;
  try {
    const bytes = fromBase64Url(trimmed.slice(CODE_PREFIX.length));
    const json = new TextDecoder().decode(
      await transform(bytes, new DecompressionStream('deflate-raw'), MAX_SDP_BYTES),
    );
    const parsed: unknown = JSON.parse(json);
    const { type, sdp: text } = parsed as Record<string, unknown>;
    if (type !== expectedType || typeof text !== 'string') throw new Error();
    sdp = text;
  } catch {
    const expected = expectedType === 'offer' ? 'an invite code' : 'a reply code';
    throw new InvalidCodeError(`This code is incomplete or not ${expected}.`);
  }
  return { type: expectedType, sdp: keepLocalCandidates(sdp) };
}

/**
 * The code comes from another person, so it is not trusted. Its network addresses
 * decide where this browser sends connection checks. Only addresses inside the
 * local network are kept, so a crafted code cannot make the browser contact
 * anything on the internet (and a normal game never leaves the local network).
 */
export function keepLocalCandidates(sdp: string): string {
  const kept: string[] = [];
  let candidates = 0;
  for (const line of sdp.split(/\r?\n/)) {
    if (line === '' || line.startsWith('a=remote-candidates')) continue;
    if (line.startsWith('c=')) {
      kept.push('c=IN IP4 0.0.0.0'); // The real addresses are in the candidates.
    } else if (line.startsWith('a=candidate:')) {
      if (isLocalCandidate(line)) {
        kept.push(line);
        candidates++;
      }
    } else {
      kept.push(line);
    }
  }
  if (candidates === 0) {
    throw new InvalidCodeError(
      'This code has no address inside your local network, so it was not accepted.',
    );
  }
  return kept.join('\r\n') + '\r\n';
}

/** "a=candidate:<id> <component> <protocol> <priority> <address> <port> typ <type> ..." */
function isLocalCandidate(line: string): boolean {
  const parts = line.slice('a=candidate:'.length).split(' ');
  const port = Number(parts[5]);
  const isHost = parts[6] === 'typ' && parts[7] === 'host';
  return isHost && Number.isInteger(port) && port > 0 && port < 65536 && isLocalAddress(parts[4]);
}

/** Private ranges, link-local, loopback, and the ".local" names that browsers use to hide IPs. */
export function isLocalAddress(address: string): boolean {
  const host = address.split('%')[0].toLowerCase(); // Drop an IPv6 zone such as %en0.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.local$/.test(host)) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    if ([a, b, c, d].some((part) => part > 255)) return false;
    return (
      a === 10 || // 10.0.0.0/8
      a === 127 || // loopback
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (phone hotspots use these)
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) || // link-local
      (a === 100 && b >= 64 && b <= 127) // 100.64.0.0/10 (carrier-grade NAT, Tailscale)
    );
  }
  if (host.includes(':')) {
    return host === '::1' || /^fe[89ab][0-9a-f]:/.test(host) || /^f[cd][0-9a-f]{2}:/.test(host);
  }
  return false;
}

/**
 * Reads the whole stream, but stops with an error once it is bigger than maxBytes.
 * Without the limit, a tiny code could expand to gigabytes ("decompression bomb").
 */
async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  maxBytes = Infinity,
): Promise<Uint8Array> {
  // Write and read at the same time; awaiting the write first could stall on big inputs.
  const writer = stream.writable.getWriter();
  writer.write(bytes as BufferSource).catch(() => undefined);
  writer.close().catch(() => undefined);

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('Too big');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
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
