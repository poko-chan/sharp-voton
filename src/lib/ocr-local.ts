// 高精度OCR: サーバー経由で Gemini Vision を利用（Lovable AI Gateway）。
// tesseract.js より圧倒的に高精度。手書き日本語・数式・混在レイアウトに強い。
// 失敗時は tesseract.js にフォールバック。
import { ocrImage } from "@/lib/ocr.functions";

export type OcrProgress = (status: string, progress: number) => void;

function toDataUrl(source: string | File | Blob): Promise<string> {
  if (typeof source === "string") return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(source);
  });
}

async function fallbackTesseract(source: string | File | Blob, opts?: { lang?: string; onProgress?: OcrProgress }) {
  const Tesseract = (await import("tesseract.js")).default;
  const lang = opts?.lang ?? "jpn";
  const res = await Tesseract.recognize(source as any, lang, {
    logger: (m: any) => {
      try { opts?.onProgress?.(m.status ?? "", typeof m.progress === "number" ? m.progress : 0); } catch { /* noop */ }
    },
  });
  return { text: res.data.text ?? "" };
}

export async function ocrLocal(source: string | File | Blob, opts?: {
  lang?: string;
  onProgress?: OcrProgress;
}): Promise<{ text: string }> {
  try {
    opts?.onProgress?.("uploading", 0.1);
    const dataUrl = await toDataUrl(source);
    opts?.onProgress?.("recognizing", 0.5);
    const r = await (ocrImage as any)({ data: { dataUrl } });
    opts?.onProgress?.("done", 1);
    const text = (r?.text ?? "").toString();
    if (text.trim().length === 0) return await fallbackTesseract(source, opts);
    return { text };
  } catch {
    return await fallbackTesseract(source, opts);
  }
}