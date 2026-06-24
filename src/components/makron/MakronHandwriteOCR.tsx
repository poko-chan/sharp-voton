import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Maximize2, Minimize2, Plus, Trash2, Eraser } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ocrImage } from "@/lib/ocr.functions";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runOcr = useServerFn(ocrImage);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctxRef.current = ctx;
  }, [active, fullscreen]);

  useEffect(() => {
    onChange?.(pages.map((p) => p.text).join(""));
  }, [pages, onChange]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
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
    if (!c) return;
    const dataUrl = c.toDataURL("image/png");
    try {
      const res = await runOcr({ data: { dataUrl } });
      const cleaned = (res.text ?? "").replace(/\s+/g, "");
      setPages((prev) => prev.map((p, i) => (i === active ? { ...p, dataUrl, text: cleaned } : p)));
    } catch (err: any) {
      toast.error(err?.message ?? "OCR失敗");
    }
  };

  const clearPage = () => {
    const c = canvasRef.current;
    if (!c || !ctxRef.current) return;
    ctxRef.current.fillStyle = "#fff";
    ctxRef.current.fillRect(0, 0, c.width, c.height);
    setPages((prev) => prev.map((p, i) => (i === active ? { ...p, text: "" } : p)));
  };

  const addPage = () => {
    setPages((prev) => [...prev, { id: crypto.randomUUID(), text: "" }]);
    setActive(pages.length);
  };
  const deletePage = () => {
    if (pages.length <= 1) return;
    setPages((prev) => prev.filter((_, i) => i !== active));
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
          className="w-full bg-white rounded border touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        <div className="bg-muted/40 rounded p-2 text-sm min-h-[2.25rem] select-none" aria-readonly>
          {pages[active]?.text || <span className="text-muted-foreground text-xs">手を止めると自動で読み取ります（1 秒）</span>}
        </div>
      </Card>
    </div>
  );
}

export default MakronHandwriteOCR;