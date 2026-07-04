// オフラインOCR (tesseract.js) — Gateway/AI不要
import Tesseract from "tesseract.js";

export type OcrProgress = (status: string, progress: number) => void;

export async function ocrLocal(source: string | File | Blob, opts?: {
  lang?: string;
  onProgress?: OcrProgress;
}): Promise<{ text: string }> {
  const lang = opts?.lang ?? "jpn+eng";
  const res = await Tesseract.recognize(source as any, lang, {
    logger: (m: any) => {
      try { opts?.onProgress?.(m.status ?? "", typeof m.progress === "number" ? m.progress : 0); } catch { /* noop */ }
    },
  });
  return { text: res.data.text ?? "" };
}