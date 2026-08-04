import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Maximize2, Minimize2, Plus, Trash2, Eraser, Loader2 } from "lucide-react";
import { ocrLocal } from "@/lib/ocr-local";
import { toast } from "sonner";

type Page = { id: string; dataUrl?: string; text: string };

/**
 * 手書き → 1 秒静止で自動 OCR → 下に表示（編集不可・空白除去）。
 * ページ追加で複数ページ独立処理。フルスクリーン切替可。
 */
export function MakronHandwriteOCR({ onChange }: { onChange?: (combined: string) => void }) {
  const [pages, setPages] = useState<Page[]>([{ id: crypto.randomUUID(), text: "" }]);
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    
    // 背景を白で塗る
    ctx.fillRect(0, 0, c.width, c.height);
    
    // 前回の描画があれば復元する
    const currentPage = pages[active];
    if (currentPage?.dataUrl) {
      const img = new Image();
      img.onload = () => {
        // 現在のキャンバスサイズに合わせて描画（フルスクリーン切替時などに対応）
        ctx.drawImage(img, 0, 0, c.width, c.height);
      };
      img.src = currentPage.dataUrl;
    }
    
    ctxRef.current = ctx;
  }, [active, fullscreen]); // ページ切り替え時とフルスクリーン切り替え時に実行

  useEffect(() => {
    onChangeRef.current?.(pages.map((p) => p.text).join(""));
  }, [pages]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    // キャンバスの物理サイズと表示サイズの比率を計算して座標を補正
    return { 
      x: ((e.clientX - r.left) / r.width) * c.width, 
      y: ((e.clientY - r.top) / r.height) * c.height 
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const { x, y } = pos(e);
    ctxRef.current?.beginPath();
    ctxRef.current?.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const { x, y } = pos(e);
    ctxRef.current?.lineTo(x, y);
    ctxRef.current?.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(triggerOcr, 1000);
  };

  const triggerOcr = async () => {
    const c = canvasRef.current;
    if (!c || busy) return;
    
    setBusy(true); setProgress(0);
    try {
      // OCR品質向上のためのクロップ処理
      const croppedCanvas = getCroppedCanvas(c);
      const blob: Blob = await new Promise((r) => croppedCanvas.toBlob((b) => r(b!), "image/png")!);
      
      // 保存用には全体の状態を保持
      const fullDataUrl = c.toDataURL("image/png");
      
      const res = await ocrLocal(blob, {
        lang: "jpn",
        onProgress: (_s, p) => setProgress(Math.round(p * 100)),
      });
      
      const cleaned = (res.text ?? "").replace(/\s+/g, "");
      setPages((prev) => prev.map((p, i) => (i === active ? { ...p, dataUrl: fullDataUrl, text: cleaned } : p)));
    } catch (err: any) {
      console.error("OCR Error:", err);
      toast.error(err?.message ?? "OCR失敗");
    } finally { setBusy(false); }
  };

  const getCroppedCanvas = (c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const w = c.width;
    const h = c.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;
    
    // 内容がある範囲を特定
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // 背景の白以外をコンテンツとみなす
        if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          found = true;
        }
      }
    }
    
    if (!found) return c;
    
    // 余白を追加
    const padding = 20;
    const startX = Math.max(0, minX - padding);
    const startY = Math.max(0, minY - padding);
    const endX = Math.min(w, maxX + padding);
    const endY = Math.min(h, maxY + padding);
    const cropW = endX - startX;
    const cropH = endY - startY;
    
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.fillStyle = "#fff";
    tempCtx.fillRect(0, 0, cropW, cropH);
    tempCtx.drawImage(c, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
    return tempCanvas;
  };

  const clearPage = () => {
    const c = canvasRef.current;
    if (!c || !ctxRef.current) return;
    ctxRef.current.fillStyle = "#fff";
    ctxRef.current.fillRect(0, 0, c.width, c.height);
    setPages((prev) => prev.map((p, i) => (i === active ? { ...p, dataUrl: undefined, text: "" } : p)));
  };

  const addPage = () => {
    setPages((prev) => [...prev, { id: crypto.randomUUID(), text: "" }]);
    setActive(pages.length);
  };
  const deletePage = () => {
    if (pages.length <= 1) return;
    const newPages = pages.filter((_, i) => i !== active);
    setPages(newPages);
    setActive(Math.max(0, active - 1));
  };

  const wrapCls = fullscreen ? "fixed inset-0 z-50 bg-background p-4 overflow-auto" : "";

  return (
    <div className={wrapCls}>
      <Card className="p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-medium">手書き OCR</div>
          <div className="flex gap-1 ml-auto">
            {pages.map((p, i) => (
              <Button key={p.id} size="sm" variant={i === active ? "default" : "outline"} onClick={() => setActive(i)}>
                P{i + 1}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={addPage}><Plus className="h-3 w-3" /></Button>
            <Button size="sm" variant="outline" onClick={deletePage} disabled={pages.length <= 1}>
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={clearPage}><Eraser className="h-3 w-3" /></Button>
            <Button size="sm" variant="outline" onClick={() => setFullscreen((v) => !v)}>
              {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          width={fullscreen ? 1600 : 900}
          height={fullscreen ? 600 : 280}
          className="w-full bg-white rounded border touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        <div className="bg-muted/40 rounded p-2 text-sm min-h-[2.25rem] select-none" aria-readonly>
          {busy ? (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />オフラインOCR実行中… {progress}%
            </span>
          ) : (pages[active]?.text || <span className="text-muted-foreground text-xs">手を止めると自動で読み取ります（1 秒・日本語モード）</span>)}
        </div>
      </Card>
    </div>
  );
}

export default MakronHandwriteOCR;
