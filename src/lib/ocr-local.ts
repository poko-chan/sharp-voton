// 高精度OCR: サーバー経由で Gemini Vision を利用（Lovable AI Gateway）。
// tesseract.js より圧倒的に高精度。手書き日本語・数式・混在レイアウトに強い。
// 失敗時は tesseract.js にフォールバック。
import { ocrImage } from "@/lib/ocr.functions";
import { prepareOcrImage } from "@/lib/ocr-image";

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
  opts?.onProgress?.("preprocessing", 0.05);
  const prepared = await prepareOcrImage(source);
  if (prepared.isBlank) return { text: "" };
  const res = await Tesseract.recognize(prepared.source, lang, {
    logger: (m: any) => {
      try {
        const progress = typeof m.progress === "number" ? 0.08 + m.progress * 0.92 : 0.08;
        opts?.onProgress?.(m.status ?? "recognizing", progress);
      } catch { /* noop */ }
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
    
    // AI Gateway (Gemini)
    opts?.onProgress?.("recognizing", 0.3);
    const r = await (ocrImage as any)({ data: { dataUrl } });
    
    const text = (r?.text ?? "").toString();
    if (text.trim().length === 0) {
      opts?.onProgress?.("falling back", 0.5);
      return await fallbackTesseract(source, opts);
    }
    
    opts?.onProgress?.("done", 1);
    return { text };
  } catch (err) {
    console.warn("High-accuracy OCR unavailable; using local Japanese OCR", err);
    return await fallbackTesseract(source, opts);
  }
}
