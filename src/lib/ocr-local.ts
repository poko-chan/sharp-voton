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
  
  // Tesseract.js 7.0.0 uses a simplified recognize method
  // We specify PSM 6 (Assume a single uniform block of text) which often works better for handwritten blocks
  const res = await Tesseract.recognize(source as any, lang, {
    logger: (m: any) => {
      try { opts?.onProgress?.(m.status ?? "", typeof m.progress === "number" ? m.progress : 0); } catch { /* noop */ }
    },
    // Parameters for improved Japanese recognition
    // @ts-ignore - Tesseract.js types might not include all these but they are passed to the engine
    tessedit_pageseg_mode: "6",
  } as any);
  
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
    console.warn("Gemini OCR failed, falling back to Tesseract:", err);
    return await fallbackTesseract(source, opts);
  }
}
