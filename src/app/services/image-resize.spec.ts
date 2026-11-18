import { ImageError, resizeImage } from './image-resize';

const file = (parts: BlobPart[], name: string, type: string) => new File(parts, name, { type });
const PNG = file(['x'], 'a.png', 'image/png');

describe('resizeImage input checks', () => {
  it('rejects files that are not pictures', async () => {
    await expect(resizeImage(file(['hi'], 'a.txt', 'text/plain'), 100)).rejects.toBeInstanceOf(
      ImageError,
    );
  });

  it('rejects SVG, which can contain scripts', async () => {
    const svg = file(['<svg onload="alert(1)"/>'], 'a.svg', 'image/svg+xml');
    await expect(resizeImage(svg, 100)).rejects.toBeInstanceOf(ImageError);
  });

  it('rejects files over 15 MB before reading them', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    const big = file([new Uint8Array(16 * 1024 * 1024)], 'big.png', 'image/png');
    await expect(resizeImage(big, 100)).rejects.toThrow('15 MB');
    expect(decode).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

/** The test browser (jsdom) cannot decode pictures, so these parts play the browser's role. */
describe('resizeImage with a decoded picture', () => {
  const close = vi.fn();
  let alpha = 255;
  let canvas: HTMLCanvasElement;
  let toDataURL: ReturnType<typeof vi.fn>;

  function decodesTo(width: number, height: number): void {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }));
  }

  beforeEach(() => {
    close.mockReset();
    alpha = 255;
    toDataURL = vi.fn((type: string) => `data:${type};base64,AAAA`);
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === 'canvas') {
        canvas = element as HTMLCanvasElement;
        canvas.toDataURL = toDataURL as HTMLCanvasElement['toDataURL'];
        canvas.getContext = (() => ({
          drawImage: () => undefined,
          getImageData: () => ({ data: new Uint8ClampedArray([9, 9, 9, 255, 9, 9, 9, alpha]) }),
        })) as unknown as HTMLCanvasElement['getContext'];
      }
      return element;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shrinks the longest side to the limit and keeps the proportions', async () => {
    decodesTo(4000, 2000);
    await resizeImage(PNG, 1000);
    expect([canvas.width, canvas.height]).toEqual([1000, 500]);
  });

  it('does not enlarge a small picture', async () => {
    decodesTo(200, 100);
    await resizeImage(PNG, 1000);
    expect([canvas.width, canvas.height]).toEqual([200, 100]);
  });

  it('never makes a side zero, even for an extremely long thin picture', async () => {
    decodesTo(10_000, 2);
    await resizeImage(PNG, 100);
    expect(canvas.height).toBe(1);
  });

  it('rejects a picture with too many pixels and frees its memory', async () => {
    decodesTo(10_000, 10_000);
    await expect(resizeImage(PNG, 1000)).rejects.toThrow('too many pixels');
    expect(close).toHaveBeenCalled();
  });

  it('explains a picture that cannot be read', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('broken')));
    await expect(resizeImage(PNG, 1000)).rejects.toThrow('could not be read');
  });

  it('stores photos as JPEG, which is much smaller', async () => {
    decodesTo(100, 100);
    expect(await resizeImage(PNG, 1000)).toContain('image/jpeg');
  });

  it('keeps transparent pictures as PNG when asked to', async () => {
    decodesTo(100, 100);
    alpha = 0;
    expect(await resizeImage(PNG, 1000, true)).toContain('image/png');
  });

  it('uses JPEG for opaque pictures even when asked to keep transparency', async () => {
    decodesTo(100, 100);
    expect(await resizeImage(PNG, 1000, true)).toContain('image/jpeg');
  });
});
