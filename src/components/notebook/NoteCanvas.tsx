import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Pen, Highlighter, Eraser, Type, Undo2, Redo2, Minus, ZoomIn, ZoomOut,
  Trash2, Download, Brush,
} from "lucide-react";
import {
  PAGE_H, PAGE_W, renderPage, drawStroke, distToStroke,
  type PaperType, type Stroke, type TextBox,
} from "@/lib/notebooks";
import { cn } from "@/lib/utils";

type Tool = "pen" | "marker" | "highlighter" | "eraser" | "text";

const PEN_COLORS = ["#111827", "#1d4ed8", "#dc2626", "#16a34a", "#ca8a04", "#7c3aed", "#0891b2", "#ffffff"];

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#111827");
  const [width, setWidth] = useState(3);
  const [straight, setStraight] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activeText, setActiveText] = useState<string | null>(null);
  const undoRef = useRef<{ strokes: Stroke[]; texts: TextBox[] }[]>([]);
  const redoRef = useRef<{ strokes: Stroke[]; texts: TextBox[] }[]>([]);
  const [, force] = useState(0);
  const drawing = useRef<Stroke | null>(null);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    renderPage(ctx, { strokes, texts: [] }, paper, paperColor);
    if (drawing.current) drawStroke(ctx, drawing.current);
  }, [strokes, paper, paperColor]);

  useEffect(() => { redraw(); }, [redraw]);

  const commit = (next: { strokes: Stroke[]; texts: TextBox[] }, snapshot = true) => {
    if (snapshot) {
      undoRef.current = [...undoRef.current.slice(-49), { strokes, texts }];
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
      p: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (tool === "text") {
      const { x, y } = toPage(e);
      const t: TextBox = {
        id: crypto.randomUUID(), x, y, w: 420, text: "", size: 32, color: "#111827",
      };
      commit({ strokes, texts: [...texts, t] });
      setActiveText(t.id);
      setTool("pen");
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pt = toPage(e);
    if (tool === "eraser") {
      undoRef.current = [...undoRef.current.slice(-49), { strokes, texts }];
      erase(pt.x, pt.y);
      drawing.current = null;
      (e.currentTarget as any).__erasing = true;
      return;
    }
    drawing.current = {
      id: crypto.randomUUID(),
      tool: tool === "marker" ? "marker" : tool === "highlighter" ? "highlighter" : "pen",
      color,
      width: tool === "highlighter" ? width * 8 : tool === "marker" ? width * 2.2 : width,
      points: [pt],
    };
  };

  const erase = (x: number, y: number) => {
    const keep = strokes.filter((s) => !distToStroke(s, x, y, 14 + width * 2));
    if (keep.length !== strokes.length) onChange({ strokes: keep, texts });
  };

  const onMove = (e: React.PointerEvent) => {
    if (readOnly) return;
    if ((e.currentTarget as any).__erasing) {
      if (e.buttons === 0) return;
      const pt = toPage(e);
      erase(pt.x, pt.y);
      return;
    }
    const d = drawing.current;
    if (!d) return;
    const pt = toPage(e);
    if (straight) d.points = [d.points[0], pt];
    else d.points.push(pt);
    redraw();
  };

  const onUp = (e: React.PointerEvent) => {
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

  // キーボードショートカット（Ctrl+Z / Ctrl+Shift+Z）
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() !== "z") return;
      if (document.activeElement?.tagName === "TEXTAREA") return;
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <Button
      key={t}
      size="sm"
      variant={tool === t ? "default" : "outline"}
      onClick={() => setTool(t)}
      title={label}
      className="h-9"
    >
      {icon}
    </Button>
  );

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card/80 p-2 backdrop-blur">
          {toolBtn("pen", <Pen className="h-4 w-4" />, "ペン")}
          {toolBtn("marker", <Brush className="h-4 w-4" />, "サインペン")}
          {toolBtn("highlighter", <Highlighter className="h-4 w-4" />, "蛍光ペン")}
          {toolBtn("eraser", <Eraser className="h-4 w-4" />, "消しゴム")}
          {toolBtn("text", <Type className="h-4 w-4" />, "テキストボックス")}
          <span className="mx-1 h-6 w-px bg-border" />
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`色 ${c}`}
              className={cn("h-7 w-7 rounded-full border-2 transition", color === c ? "scale-110 border-foreground" : "border-border")}
              style={{ background: c }}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-9 rounded border" aria-label="カスタム色" />
          <span className="mx-1 h-6 w-px bg-border" />
          <input type="range" min={1} max={16} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-24" aria-label="太さ" />
          <Button size="sm" variant={straight ? "default" : "outline"} onClick={() => setStraight((s) => !s)} title="直線モード"><Minus className="h-4 w-4" /></Button>
          <span className="mx-1 h-6 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={undo} title="元に戻す"><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={redo} title="やり直し"><Redo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} title="縮小"><ZoomOut className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))} title="拡大"><ZoomIn className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={exportPng} title="PNG保存"><Download className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={clearPage} title="ページを消去" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </div>
      )}

      <div className="overflow-auto rounded-xl border bg-muted/30 p-2">
        <div
          ref={wrapRef}
          className="relative mx-auto shadow-xl"
          style={{ width: `${Math.round(100 * zoom)}%`, maxWidth: zoom <= 1 ? "100%" : "none", aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
        >
          <canvas
            ref={canvasRef}
            width={PAGE_W}
            height={PAGE_H}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            className="absolute inset-0 h-full w-full touch-none rounded-md"
            style={{ cursor: readOnly ? "default" : tool === "eraser" ? "cell" : "crosshair" }}
          />
          {texts.map((t) => (
            <div
              key={t.id}
              className="absolute"
              style={{
                left: `${(t.x / PAGE_W) * 100}%`,
                top: `${(t.y / PAGE_H) * 100}%`,
                width: `${(t.w / PAGE_W) * 100}%`,
              }}
            >
              <div className="group relative">
                {!readOnly && (
                  <div className="absolute -top-8 left-0 z-10 hidden items-center gap-1 rounded-md border bg-card p-1 shadow group-focus-within:flex">
                    <input type="color" value={t.color} onChange={(e) => updateText(t.id, { color: e.target.value })} className="h-6 w-7 rounded border" aria-label="文字色" />
                    <input
                      type="range" min={14} max={72} value={t.size}
                      onChange={(e) => updateText(t.id, { size: Number(e.target.value) })}
                      className="w-20" aria-label="文字サイズ"
                    />
                    <button className="px-1 text-xs font-bold" onClick={() => updateText(t.id, { bold: !t.bold }, true)}>B</button>
                    <button className="px-1 text-xs text-destructive" onClick={() => removeText(t.id)}>削除</button>
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
                  style={{
                    fontSize: `${(t.size / PAGE_W) * 100}cqw`,
                    color: t.color,
                    fontWeight: t.bold ? 700 : 400,
                    minHeight: "1.6em",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
