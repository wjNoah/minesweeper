import { ImageError, resizeImage } from './image-resize';

const file = (parts: BlobPart[], name: string, type: string) => new File(parts, name, { type });

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
    const big = file([new Uint8Array(16 * 1024 * 1024)], 'big.png', 'image/png');
    await expect(resizeImage(big, 100)).rejects.toThrow('15 MB');
  });
});
