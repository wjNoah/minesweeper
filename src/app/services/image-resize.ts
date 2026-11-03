export class ImageError extends Error {}

/**
 * Shrinks a picture so its longest side is at most maxSide pixels and returns it
 * as a data URL. Keeps stored pictures small enough for localStorage.
 * keepTransparency: use PNG if the picture has transparent pixels; otherwise
 * (and always for photos) JPEG, which is many times smaller.
 */
export async function resizeImage(
  file: File,
  maxSide: number,
  keepTransparency = false,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageError('Please choose an image file.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('This picture could not be read. Try a JPEG or PNG.');
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('This browser cannot process pictures.');

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const transparent = keepTransparency && hasTransparency(context, canvas.width, canvas.height);
  return canvas.toDataURL(transparent ? 'image/png' : 'image/jpeg', 0.82);
}

function hasTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const pixels = context.getImageData(0, 0, width, height).data;
  // Every 4th value is the alpha channel.
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 255) return true;
  }
  return false;
}
