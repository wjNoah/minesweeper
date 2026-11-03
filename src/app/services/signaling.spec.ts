import {
  decodeDescription,
  encodeDescription,
  fromBase64Url,
  InvalidCodeError,
  toBase64Url,
} from './signaling';

describe('signaling codes', () => {
  it('round-trips bytes through URL-safe base64', () => {
    const bytes = Uint8Array.from([0, 1, 250, 251, 252, 253, 254, 255]);
    const text = toBase64Url(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(fromBase64Url(text)).toEqual(bytes);
  });

  it('encodes and decodes a description', async () => {
    const sdp = 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n'.repeat(20);
    const code = await encodeDescription({ type: 'offer', sdp });
    expect(code.startsWith('MS1.')).toBe(true);
    expect(code.length).toBeLessThan(sdp.length);
    expect(await decodeDescription(code, 'offer')).toEqual({ type: 'offer', sdp });
  });

  it('rejects codes of the wrong kind or that are cut off', async () => {
    const code = await encodeDescription({ type: 'offer', sdp: 'v=0' });
    await expect(decodeDescription(code, 'answer')).rejects.toBeInstanceOf(InvalidCodeError);
    await expect(decodeDescription(code.slice(0, 8), 'offer')).rejects.toBeInstanceOf(
      InvalidCodeError,
    );
    await expect(decodeDescription('hello', 'offer')).rejects.toBeInstanceOf(InvalidCodeError);
  });
});
