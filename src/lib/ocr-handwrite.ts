// AIを使わない手書き読み取り（端末内 Tesseract）。
// 手書き向けに「二値化 → 線を太らせる → 文字サイズを揃える → 余白を付ける」前処理を行い、
// 1行なら単一行モードで認識して精度を上げる。ワーカーは使い回して2回目以降を高速化。
let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const T = (await import("tesseract.js")).default as any;
      const w = await T.createWorker(["jpn", "eng"]);
      await w.setParameters({ preserve_interword_spaces: "0" });
      return w;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

function preprocess(src: HTMLCanvasElement): { canvas: HTMLCanvasElement; singleLine: boolean } {
  const w = src.width;
  const h = src.height;
  const data = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  const ink = new Uint8Array(w * h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      if (lum < 160) {
        ink[y * w + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  if (maxX < 0) return { canvas: src, singleLine: true };
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  // 行数の推定：横方向の投影で空白帯を数える
  let lines = 0, inLine = false;
  for (let y = minY; y <= maxY; y++) {
    let any = false;
    for (let x = minX; x <= maxX && !any; x++) any = ink[y * w + x] === 1;
    if (any && !inLine) lines++;
    inLine = any;
  }
  const singleLine = lines <= 1 || bw / bh > 2.2;

  // 1行あたり約90pxの高さに揃える
  const target = 90 * Math.max(1, singleLine ? 1 : lines);
  const scale = Math.min(4, Math.max(0.4, target / bh));
  const pad = 40;
  const out = document.createElement("canvas");
  out.width = Math.round(bw * scale) + pad * 2;
  out.height = Math.round(bh * scale) + pad * 2;
  const o = out.getContext("2d")!;
  o.fillStyle = "#fff";
  o.fillRect(0, 0, out.width, out.height);
  // 線を太らせて描画（擬似的な膨張）
  const r = Math.max(1, Math.round(scale * 1.5));
  o.fillStyle = "#000";
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      if (ink[y * w + x])
        o.fillRect(pad + (x - minX) * scale - r / 2, pad + (y - minY) * scale - r / 2, r + scale, r + scale);
  return { canvas: out, singleLine };
}

export async function ocrHandwrite(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void,
): Promise<string> {
  onProgress?.(0.1);
  const { canvas: img, singleLine } = preprocess(canvas);
  onProgress?.(0.3);
  const w = await getWorker();
  await w.setParameters({ tessedit_pageseg_mode: singleLine ? "7" : "6" });
  onProgress?.(0.5);
  const res = await w.recognize(img);
  onProgress?.(1);
  return String(res?.data?.text ?? "")
    .replace(/\s+/g, "")
    // 手書きで混同しやすい記号を正規化
    .replace(/[|｜]/g, "1")
    .replace(/[“”"]/g, "");
}
