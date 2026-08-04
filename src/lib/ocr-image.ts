export type OcrPreparedImage = { source: Blob; isBlank: boolean };

/** Japanese handwriting benefits from a tight crop, high contrast and extra resolution. */
export async function prepareOcrImage(source: string | File | Blob): Promise<OcrPreparedImage> {
  const original = await toBlob(source);
  const bitmap = await createImageBitmap(original);
  const scan = document.createElement("canvas");
  scan.width = bitmap.width;
  scan.height = bitmap.height;
  const scanContext = scan.getContext("2d", { willReadFrequently: true });
  if (!scanContext) throw new Error("画像を処理できませんでした");
  scanContext.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = scanContext.getImageData(0, 0, scan.width, scan.height);
  let left = scan.width, top = scan.height, right = 0, bottom = 0, darkPixels = 0;
  for (let y = 0; y < scan.height; y += 1) {
    for (let x = 0; x < scan.width; x += 1) {
      const offset = (y * scan.width + x) * 4;
      const gray = image.data[offset] * 0.299 + image.data[offset + 1] * 0.587 + image.data[offset + 2] * 0.114;
      if (gray < 210) {
        darkPixels += 1;
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  if (darkPixels < 12) return { source: original, isBlank: true };
  const padding = Math.max(18, Math.round(Math.max(right - left, bottom - top) * 0.06));
  left = Math.max(0, left - padding); top = Math.max(0, top - padding);
  right = Math.min(scan.width - 1, right + padding); bottom = Math.min(scan.height - 1, bottom + padding);
  const cropWidth = right - left + 1, cropHeight = bottom - top + 1;
  const scale = Math.min(3, Math.max(1.5, 1800 / Math.max(cropWidth, cropHeight)));
  const output = document.createElement("canvas");
  output.width = Math.round(cropWidth * scale); output.height = Math.round(cropHeight * scale);
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("画像を補正できませんでした");
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  context.drawImage(scan, left, top, cropWidth, cropHeight, 0, 0, output.width, output.height);
  const corrected = context.getImageData(0, 0, output.width, output.height);
  for (let i = 0; i < corrected.data.length; i += 4) {
    const gray = corrected.data[i] * 0.299 + corrected.data[i + 1] * 0.587 + corrected.data[i + 2] * 0.114;
    const contrasted = gray < 200 ? Math.max(0, (gray - 35) * 0.9) : 255;
    corrected.data[i] = contrasted; corrected.data[i + 1] = contrasted;
    corrected.data[i + 2] = contrasted; corrected.data[i + 3] = 255;
  }
  context.putImageData(corrected, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(
    (result) => result ? resolve(result) : reject(new Error("画像変換に失敗しました")), "image/png",
  ));
  return { source: blob, isBlank: false };
}

async function toBlob(source: string | File | Blob): Promise<Blob> {
  if (source instanceof Blob) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error("画像を読み込めませんでした");
  return response.blob();
}