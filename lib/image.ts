// lib/image.ts
export async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** Unlike an object URL (which is a revocable reference into an in-memory
 *  registry), a data URL embeds the image bytes directly in the string --
 *  there's nothing to revoke and nothing that can go stale out from under
 *  an <img> that's mid-load. Costs ~33% more memory than a blob URL, which
 *  is a fine trade for a personal gallery's worth of photos. */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
