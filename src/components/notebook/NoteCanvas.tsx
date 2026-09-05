import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Pen, Highlighter, Eraser, Type, Undo2, Redo2, Minus, ZoomIn, ZoomOut,
  Trash2, Download, Brush, Hand, Maximize2, Pencil,
} from "lucide-react";
import {
  PAGE_H, PAGE_W, renderPage, drawStroke, eraseAt,
  type PaperType, type Stroke, type TextBox,
} from "@/lib/notebooks";
import { cn } from "@/lib/utils";

type Tool = "pen" | "pencil" | "marker" | "highlighter" | "eraser" | "text" | "hand";

const PEN_COLORS = ["#111827", "#1d4ed8", "#dc2626", "#16a34a", "#ca8a04", "#7c3aed", "#0891b2", "#ffffff"];
const MARKER_COLORS = ["#fde047", "#86efac", "#93c5fd", "#f9a8d4", "#fdba74", "#c4b5fd"];

const TOOLS: { key: Tool; icon: typeof Pen; label: string }[] = [
  { key: "pen", icon: Pen, label: "ボールペン" },
  { key: "pencil", icon: Pencil, label: "えんぴつ" },
  { key: "marker", icon: Brush, label: "サインペン" },
  { key: "highlighter", icon: Highlighter, label: "蛍光ペン" },
  { key: "eraser", icon: Eraser, label: "消しゴム" },
  { key: "text", icon: Type, label: "テキスト" },
  { key: "hand", icon: Hand, label: "手のひら（移動）" },
];

/** 実物の筆記具に近い書き味のノートキャンバス */
export function NoteCanvas({
  strokes,
  texts,
  paper,
  paperColor,
  readOnly,
  onChange,
  title,
}: {
  strokes: Stroke[];
  texts: TextBox[];
  paper: PaperType;
  paperColor: string;
  readOnly?: boolean;
  onChange: (next: { strokes: Stroke[]; texts: TextBox[] }) => void;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#111827");
  const [hlColor, setHlColor] = useState("#fde047");
  const [width, setWidth] = useState(3);
  const [eraserSize, setEraserSize] = useState(24);
  const [straight, setStraight] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeText, setActiveText] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const undoRef = useRef<{ strokes: Stroke[]; texts: TextBox[] }[]>([]);
  const redoRef = useRef<{ strokes: Stroke[]; texts: TextBox[] }[]>([]);
  const [, force] = useState(0);
  const drawing = useRef<Stroke | null>(null);
  const panning = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const stateRef = useRef({ zoom, pan });
  stateRef.current = { zoom, pan };

  const activeColor = tool === "highlighter" ? hlColor : color;

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    renderPage(ctx, { strokes, texts: [] }, paper, paperColor);
    if (drawing.current) drawStroke(ctx, drawing.current);
  }, [strokes, paper, paperColor]);

  useEffect(() => { redraw(); }, [redraw]);

  // 初期表示は幅にフィット
  const fit = useCallback(() => {
    const v = viewRef.current;
    if (!v) return;
    const z = Math.min(1.6, Math.max(0.25, (v.clientWidth - 32) / PAGE_W));
    setZoom(z);
    setPan({ x: (v.clientWidth - PAGE_W * z) / 2, y: 16 });
  }, []);
  useEffect(() => { fit(); }, [fit]);

  // ホイール／ピンチでのズームとスクロール
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const { zoom: z, pan: p } = stateRef.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) < 1) {
        const next = Math.min(4, Math.max(0.2, z * Math.exp(-dy * 0.0015)));
        const k = next / z;
        setZoom(next);
        setPan({ x: px - (px - p.x) * k, y: py - (py - p.y) * k });
      } else {
        setPan({ x: p.x - e.deltaX, y: p.y - dy });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (k: number) => {
    const v = viewRef.current;
    const { zoom: z, pan: p } = stateRef.current;
    const next = Math.min(4, Math.max(0.2, z * k));
    const cx = (v?.clientWidth ?? 0) / 2;
    const cy = (v?.clientHeight ?? 0) / 2;
    const r = next / z;
    setZoom(next);
    setPan({ x: cx - (cx - p.x) * r, y: cy - (cy - p.y) * r });
  };

  const commit = (next: { strokes: Stroke[]; texts: TextBox[] }, snapshot = true) => {
    if (snapshot) {
      undoRef.current = [...undoRef.current.slice(-59), { strokes, texts }];
      redoRef.current = [];
    }
    onChange(next);
    force((n) => n + 1);
  };

  const undo = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push({ strokes, texts });
    onChange(prev);
    force((n) => n + 1);
  };
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push({ strokes, texts });
    onChange(next);
    force((n) => n + 1);
  };

  const toPage = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * PAGE_W,
      y: ((e.clientY - r.top) / r.height) * PAGE_H,
      p: e.pressure && e.pressure > 0 && e.pointerType === "pen" ? e.pressure : 0.5,
    };
  };

  const startPan = (e: React.PointerEvent) => {
    panning.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDown = (e: React.PointerEvent) => {
    if (tool === "hand" || e.button === 1 || (e.pointerType === "touch" && tool !== "eraser" && e.isPrimary === false)) {
      startPan(e);
      return;
    }
    if (readOnly) return;
    if (tool === "text") {
      const { x, y } = toPage(e);
      const t: TextBox = { id: crypto.randomUUID(), x, y, w: 420, text: "", size: 32, color: "#111827" };
      commit({ strokes, texts: [...texts, t] });
      setActiveText(t.id);
      setTool("pen");
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pt = toPage(e);
    if (tool === "eraser") {
      undoRef.current = [...undoRef.current.slice(-59), { strokes, texts }];
      erase(pt.x, pt.y);
      drawing.current = null;
      (e.currentTarget as any).__erasing = true;
      return;
    }
    drawing.current = {
      id: crypto.randomUUID(),
      tool: tool === "marker" ? "marker" : tool === "highlighter" ? "highlighter" : tool === "pencil" ? "pencil" : "pen",
      color: activeColor,
      width: tool === "highlighter" ? width * 8 : tool === "marker" ? width * 2.2 : width,
      points: [pt],
    };
  };

  const erase = (x: number, y: number) => {
    const next = eraseAt(strokes, x, y, eraserSize / 2);
    if (next !== strokes) onChange({ strokes: next, texts });
  };

  const onMove = (e: React.PointerEvent) => {
    if (panning.current) {
      setPan({ x: panning.current.ox + (e.clientX - panning.current.x), y: panning.current.oy + (e.clientY - panning.current.y) });
      return;
    }
    const pt = toPage(e);
    setCursor({ x: pt.x, y: pt.y });
    if (readOnly) return;
    if ((e.currentTarget as any).__erasing) {
      if (e.buttons === 0) return;
      erase(pt.x, pt.y);
      return;
    }
    const d = drawing.current;
    if (!d) return;
    if (straight) d.points = [d.points[0], pt];
    else {
      const last = d.points[d.points.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1.2) return;
      d.points.push(pt);
    }
    redraw();
  };

  const onUp = (e: React.PointerEvent) => {
    if (panning.current) { panning.current = null; return; }
    if ((e.currentTarget as any).__erasing) {
      (e.currentTarget as any).__erasing = false;
      return;
    }
    const d = drawing.current;
    drawing.current = null;
    if (!d) return;
    commit({ strokes: [...strokes, d], texts });
  };

  const updateText = (id: string, patch: Partial<TextBox>, snapshot = false) => {
    commit({ strokes, texts: texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }, snapshot);
  };
  const removeText = (id: string) => commit({ strokes, texts: texts.filter((t) => t.id !== id) });

  const clearPage = () => {
    if (!confirm("このページの内容をすべて消去しますか？")) return;
    commit({ strokes: [], texts: [] });
  };

  const exportPng = () => {
    const c = document.createElement("canvas");
    c.width = PAGE_W; c.height = PAGE_H;
    const ctx = c.getContext("2d")!;
    renderPage(ctx, { strokes, texts }, paper, paperColor, true);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${title || "note"}.png`;
    a.click();
  };

  // キーボードショートカット
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT";
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        return;
      }
      if (typing) return;
      const map: Record<string, Tool> = { p: "pen", n: "pencil", m: "marker", h: "highlighter", e: "eraser", t: "text", v: "hand" };
      if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
      if (e.key === "0") fit();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const swatches = tool === "highlighter" ? MARKER_COLORS : PEN_COLORS;
  const isPenTool = tool === "pen" || tool === "pencil" || tool === "marker" || tool === "highlighter";

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* 左：常設ツールバー（持ち替えのために戻る必要なし） */}
      {!readOnly && (
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-card/90 py-2 backdrop-blur">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              title={t.label}
              onClick={() => setTool(t.key)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border transition",
                tool === t.key ? "border-primary bg-primary text-primary-foreground shadow" : "border-transparent hover:bg-muted",
              )}
            >
              <t.icon className="h-[18px] w-[18px]" />
            </button>
          ))}
          <span className="my-1 h-px w-8 bg-border" />
          <button title="元に戻す" onClick={undo} className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-muted"><Undo2 className="h-[18px] w-[18px]" /></button>
          <button title="やり直し" onClick={redo} className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-muted"><Redo2 className="h-[18px] w-[18px]" /></button>
          <button title="PNG保存" onClick={exportPng} className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-muted"><Download className="h-[18px] w-[18px]" /></button>
          <button title="ページを消去" onClick={clearPage} className="mt-auto flex h-9 w-10 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-[18px] w-[18px]" /></button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 上：選択中の道具の設定（その場で変更できる） */}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-card/70 px-3 py-1.5 backdrop-blur">
            <span className="text-xs font-semibold text-muted-foreground">{TOOLS.find((t) => t.key === tool)?.label}</span>
            {isPenTool && (
              <>
                <span className="h-5 w-px bg-border" />
                {swatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => (tool === "highlighter" ? setHlColor(c) : setColor(c))}
                    aria-label={`色 ${c}`}
                    className={cn("h-6 w-6 rounded-full border-2 transition", activeColor === c ? "scale-110 border-foreground" : "border-border")}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color" value={activeColor} aria-label="カスタム色"
                  onChange={(e) => (tool === "highlighter" ? setHlColor(e.target.value) : setColor(e.target.value))}
                  className="h-7 w-8 rounded border"
                />
                <span className="h-5 w-px bg-border" />
                <span className="text-[11px] text-muted-foreground">太さ</span>
                <input type="range" min={1} max={16} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-24" aria-label="太さ" />
                <Button size="sm" variant={straight ? "default" : "outline"} className="h-7" onClick={() => setStraight((s) => !s)} title="直線モード">
                  <Minus className="h-4 w-4" />
                </Button>
              </>
            )}
            {tool === "eraser" && (
              <>
                <span className="h-5 w-px bg-border" />
                <span className="text-[11px] text-muted-foreground">消しゴムの大きさ</span>
                <input type="range" min={8} max={120} value={eraserSize} onChange={(e) => setEraserSize(Number(e.target.value))} className="w-32" aria-label="消しゴムの大きさ" />
                <span className="text-[11px] tabular-nums text-muted-foreground">{eraserSize}</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomBy(1 / 1.25)} title="縮小"><ZoomOut className="h-4 w-4" /></Button>
              <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomBy(1.25)} title="拡大"><ZoomIn className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={fit} title="幅に合わせる"><Maximize2 className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* 用紙 */}
        <div ref={viewRef} className="relative min-h-0 flex-1 overflow-hidden bg-muted/40 touch-none">
          <div
            className="absolute left-0 top-0 origin-top-left shadow-2xl"
            style={{ width: PAGE_W, height: PAGE_H, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <canvas
              ref={canvasRef}
              width={PAGE_W}
              height={PAGE_H}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={(e) => { setCursor(null); onUp(e); }}
              className="absolute inset-0 h-full w-full touch-none rounded-sm bg-white"
              style={{ cursor: tool === "hand" ? "grab" : tool === "eraser" ? "none" : readOnly ? "default" : "crosshair" }}
            />
            {tool === "eraser" && cursor && !readOnly && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-foreground/60 bg-foreground/5"
                style={{ left: cursor.x - eraserSize / 2, top: cursor.y - eraserSize / 2, width: eraserSize, height: eraserSize }}
              />
            )}
            {texts.map((t) => (
              <div key={t.id} className="absolute" style={{ left: t.x, top: t.y, width: t.w }}>
                <div className="group relative">
                  {!readOnly && (
                    <div className="absolute -top-11 left-0 z-10 hidden items-center gap-1 rounded-md border bg-card p-1 shadow group-focus-within:flex">
                      <input type="color" value={t.color} onChange={(e) => updateText(t.id, { color: e.target.value })} className="h-7 w-8 rounded border" aria-label="文字色" />
                      <input type="range" min={14} max={96} value={t.size} onChange={(e) => updateText(t.id, { size: Number(e.target.value) })} className="w-24" aria-label="文字サイズ" />
                      <button className="px-1 text-sm font-bold" onClick={() => updateText(t.id, { bold: !t.bold }, true)}>B</button>
                      <button className="px-1 text-sm text-destructive" onClick={() => removeText(t.id)}>削除</button>
                    </div>
                  )}
                  <textarea
                    value={t.text}
                    readOnly={readOnly}
                    autoFocus={activeText === t.id}
                    onChange={(e) => updateText(t.id, { text: e.target.value })}
                    onBlur={() => setActiveText(null)}
                    placeholder="テキスト..."
                    className="w-full resize-y rounded border border-dashed border-transparent bg-transparent p-1 leading-snug outline-none focus:border-primary/60 focus:bg-background/70"
                    style={{ fontSize: t.size, color: t.color, fontWeight: t.bold ? 700 : 400, minHeight: "1.6em" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
