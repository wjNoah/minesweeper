import {
  decodeDescription,
  encodeDescription,
  fromBase64Url,
  InvalidCodeError,
  isLocalAddress,
  keepLocalCandidates,
  toBase64Url,
} from './signaling';

const candidate = (address: string, type = 'host', port = 50123) =>
  `a=candidate:1 1 udp 2113937151 ${address} ${port} typ ${type} generation 0\r\n`;
const sdpWith = (...candidates: string[]) =>
  'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nc=IN IP4 0.0.0.0\r\n' + candidates.join('');

describe('signaling codes', () => {
  it('round-trips bytes through URL-safe base64', () => {
    const bytes = Uint8Array.from([0, 1, 250, 251, 252, 253, 254, 255]);
    const text = toBase64Url(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(fromBase64Url(text)).toEqual(bytes);
  });

  it('encodes and decodes a description', async () => {
    const sdp = sdpWith(candidate('192.168.1.20'), candidate('abc-123.local'));
    const code = await encodeDescription({ type: 'offer', sdp });
    expect(code.startsWith('MS1.')).toBe(true);
    expect(await decodeDescription(code, 'offer')).toEqual({ type: 'offer', sdp });
  });

  it('rejects codes of the wrong kind or that are cut off', async () => {
    const code = await encodeDescription({ type: 'offer', sdp: sdpWith(candidate('10.0.0.5')) });
    await expect(decodeDescription(code, 'answer')).rejects.toBeInstanceOf(InvalidCodeError);
    await expect(decodeDescription(code.slice(0, 8), 'offer')).rejects.toBeInstanceOf(
      InvalidCodeError,
    );
    await expect(decodeDescription('hello', 'offer')).rejects.toBeInstanceOf(InvalidCodeError);
  });

  it('rejects a code that is far too long', async () => {
    await expect(decodeDescription('MS1.' + 'A'.repeat(30_000), 'offer')).rejects.toThrow(
      'too long',
    );
  });

  it('rejects a decompression bomb: a tiny code that expands to megabytes', async () => {
    const bomb = await encodeDescription({ type: 'offer', sdp: 'a'.repeat(5_000_000) });
    expect(bomb.length).toBeLessThan(20_000);
    await expect(decodeDescription(bomb, 'offer')).rejects.toBeInstanceOf(InvalidCodeError);
  });
});

describe('keepLocalCandidates', () => {
  it('drops candidates that point outside the local network', () => {
    const result = keepLocalCandidates(
      sdpWith(
        candidate('192.168.1.20'),
        candidate('8.8.8.8'),
        candidate('203.0.113.9', 'srflx'),
        candidate('198.51.100.4', 'relay'),
        candidate('2001:db8::1'),
      ),
    );
    expect(result).toContain('192.168.1.20');
    expect(result).not.toContain('8.8.8.8');
    expect(result).not.toContain('203.0.113.9');
    expect(result).not.toContain('198.51.100.4');
    expect(result).not.toContain('2001:db8::1');
  });

  it('only accepts host candidates, even on a private address', () => {
    expect(() => keepLocalCandidates(sdpWith(candidate('10.0.0.5', 'srflx')))).toThrow(
      InvalidCodeError,
    );
  });

  it('rejects a code that has no local address at all', () => {
    expect(() => keepLocalCandidates(sdpWith())).toThrow('local network');
    expect(() => keepLocalCandidates(sdpWith(candidate('93.184.216.34')))).toThrow('local network');
  });

  it('rewrites the default connection address and removes remote-candidates lines', () => {
    const sdp =
      sdpWith(candidate('10.0.0.5')).replace('c=IN IP4 0.0.0.0', 'c=IN IP4 93.184.216.34') +
      'a=remote-candidates:1 93.184.216.34 9\r\n';
    const result = keepLocalCandidates(sdp);
    expect(result).toContain('c=IN IP4 0.0.0.0');
    expect(result).not.toContain('93.184.216.34');
  });

  it('rejects candidates with a missing or invalid port', () => {
    expect(() => keepLocalCandidates(sdpWith(candidate('10.0.0.5', 'host', 0)))).toThrow();
    expect(() => keepLocalCandidates(sdpWith(candidate('10.0.0.5', 'host', 70000)))).toThrow();
  });
});

describe('isLocalAddress', () => {
  it('accepts private, link-local, loopback and .local addresses', () => {
    for (const address of [
      '10.1.2.3',
      '172.16.0.1',
      '172.20.10.2', // iPhone hotspot
      '172.31.255.255',
      '192.168.43.1', // Android hotspot
      '169.254.10.10',
      '100.64.0.1',
      '127.0.0.1',
      'fe80::1ff:fe23:4567:890a',
      'fe80::1%en0',
      'fd12:3456:789a::1',
      '::1',
      '3f6a2b1c-9d5e-4f10-8a77-0c1d2e3f4a5b.local',
    ]) {
      expect(isLocalAddress(address), address).toBe(true);
    }
  });

  it('rejects public addresses and names, and lookalikes', () => {
    for (const address of [
      '8.8.8.8',
      '172.15.0.1',
      '172.32.0.1',
      '192.169.1.1',
      '100.128.0.1',
      '300.1.1.1',
      '10.0.0',
      '2001:db8::1',
      '2a00:1450:4001::1',
      'example.com',
      'evil.local.example.com',
      'local',
      '',
    ]) {
      expect(isLocalAddress(address), address).toBe(false);
    }
  });
});
