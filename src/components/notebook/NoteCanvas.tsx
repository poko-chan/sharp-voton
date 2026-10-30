import { memo, useCallback, useEffect, useRef, useState } from "react";

/** ページ一覧用の縮小プレビュー（保存はせず、その場で描画） */
export const PageThumb = memo(function PageThumb({
  strokes,
  paper,
  paperColor,
}: {
  strokes: Stroke[];
  paper: PaperType;
  paperColor: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const s = c.width / PAGE_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    renderPage(ctx, { strokes, texts: [] }, paper, paperColor);
  }, [strokes, paper, paperColor]);
  return (
    <canvas
      ref={ref}
      width={62}
      height={Math.round((62 * PAGE_H) / PAGE_W)}
      className="h-[88px] w-[62px] shrink-0 rounded border bg-background"
    />
  );
});
import { Button } from "@/components/ui/button";
import {
  Pen,
  Highlighter,
  Eraser,
  Type,
  Undo2,
  Redo2,
  Minus,
  ZoomIn,
  ZoomOut,
  Trash2,
  Download,
  Brush,
  Hand,
  Maximize2,
  Pencil,
  Shapes,
  PaintBucket,
  Lasso,
  Pipette,
  Copy,
  Wand2,
} from "lucide-react";
import {
  PAGE_H,
  PAGE_W,
  renderPage,
  drawStroke,
  eraseAt,
  shapePoints,
  paintStroke,
  createInkContext,
  eraseWholeAt,
  strokeBox,
  pointInPolygon,
  recognizeShape,
  type Point,
  type ShapeKind,
  type PaperType,
  type Stroke,
  type TextBox,
} from "@/lib/notebooks";
import { cn } from "@/lib/utils";

type Tool =
  | "pen"
  | "pencil"
  | "marker"
  | "highlighter"
  | "shape"
  | "fill"
  | "eraser"
  | "lasso"
  | "eyedropper"
  | "text"
  | "hand";
type DrawTool = "pen" | "pencil" | "marker" | "highlighter";

const PEN_COLORS = [
  "#111827",
  "#1d4ed8",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#7c3aed",
  "#0891b2",
  "#ffffff",
];
const MARKER_COLORS = ["#fde047", "#86efac", "#93c5fd", "#f9a8d4", "#fdba74", "#c4b5fd"];

const TOOLS: { key: Tool; icon: typeof Pen; label: string }[] = [
  { key: "pen", icon: Pen, label: "ボールペン" },
  { key: "pencil", icon: Pencil, label: "えんぴつ" },
  { key: "marker", icon: Brush, label: "サインペン" },
  { key: "highlighter", icon: Highlighter, label: "蛍光ペン" },
  { key: "shape", icon: Shapes, label: "図形" },
  { key: "fill", icon: PaintBucket, label: "バケツ（塗りつぶし）" },
  { key: "eraser", icon: Eraser, label: "消しゴム" },
  { key: "lasso", icon: Lasso, label: "なげなわ（選択・移動）" },
  { key: "eyedropper", icon: Pipette, label: "スポイト" },
  { key: "text", icon: Type, label: "テキスト" },
  { key: "hand", icon: Hand, label: "手のひら（移動）" },
];

const SHAPES: { key: ShapeKind; label: string }[] = [
  { key: "line", label: "直線" },
  { key: "arrow", label: "矢印" },
  { key: "rect", label: "四角" },
  { key: "ellipse", label: "円" },
];
const SMOOTH_LEVELS = [
  { v: 0, label: "なし" },
  { v: 0.25, label: "弱" },
  { v: 0.45, label: "標準" },
  { v: 0.65, label: "強" },
];
const PRESETS = [
  { color: "#111827", width: 2, label: "黒・細" },
  { color: "#111827", width: 5, label: "黒・太" },
  { color: "#1d4ed8", width: 3, label: "青" },
  { color: "#dc2626", width: 3, label: "赤" },
];
const PREF_KEY = "cnote.prefs.v1";
type Prefs = {
  tool?: Tool;
  color?: string;
  hlColor?: string;
  width?: number;
  eraserSize?: number;
  eraserMode?: "pixel" | "stroke";
  smartShape?: boolean;
  penOnly?: boolean;
  smooth?: number;
  shape?: ShapeKind;
};
function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") as Prefs;
  } catch {
    return {};
  }
}

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
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#111827");
  const [hlColor, setHlColor] = useState("#fde047");
  const [width, setWidth] = useState(3);
  const [eraserSize, setEraserSize] = useState(24);
  const [straight, setStraight] = useState(false);
  const [penOnly, setPenOnly] = useState(true);
  const [smooth, setSmooth] = useState(0.45);
  const [shape, setShape] = useState<ShapeKind>("line");
  const [eraserMode, setEraserMode] = useState<"pixel" | "stroke">("pixel");
  const [smartShape, setSmartShape] = useState(true);
  const lastDrawTool = useRef<DrawTool>("pen");
  useEffect(() => {
    if (tool === "pen" || tool === "pencil" || tool === "marker" || tool === "highlighter")
      lastDrawTool.current = tool;
  }, [tool]);
  const prefsLoaded = useRef(false);
  const shapeOrigin = useRef<Point | null>(null);
  // 前回の道具・色・太さを端末から復元
  useEffect(() => {
    const p = readPrefs();
    if (p.tool && p.tool !== "text" && p.tool !== "eyedropper") setTool(p.tool);
    if (p.color) setColor(p.color);
    if (p.hlColor) setHlColor(p.hlColor);
    if (p.width) setWidth(p.width);
    if (p.eraserSize) setEraserSize(p.eraserSize);
    if (typeof p.penOnly === "boolean") setPenOnly(p.penOnly);
    if (typeof p.smooth === "number") setSmooth(p.smooth);
    if (p.shape) setShape(p.shape);
    if (p.eraserMode) setEraserMode(p.eraserMode);
    if (typeof p.smartShape === "boolean") setSmartShape(p.smartShape);
    prefsLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!prefsLoaded.current) return;
    try {
      localStorage.setItem(
        PREF_KEY,
        JSON.stringify({
          tool,
          color,
          hlColor,
          width,
          eraserSize,
          penOnly,
          smooth,
          shape,
          eraserMode,
          smartShape,
        }),
      );
    } catch {
      /* noop */
    }
  }, [tool, color, hlColor, width, eraserSize, penOnly, smooth, shape, eraserMode, smartShape]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeText, setActiveText] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const undoRef = useRef<{ strokes: Stroke[]; texts: TextBox[] }[]>([]);
  const redoRef = useRef<{ strokes: Stroke[]; texts: TextBox[] }[]>([]);
  const [, force] = useState(0);
  const drawing = useRef<Stroke | null>(null);
  const previewFrame = useRef<number | null>(null);
  const hasInitialFit = useRef(false);
  const activePointer = useRef<number | null>(null);
  const erasing = useRef(false);
  const panning = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const spacePressed = useRef(false);
  const stateRef = useRef({ zoom, pan });
  stateRef.current = { zoom, pan };

  const activeColor = tool === "highlighter" ? hlColor : color;

  // 描画済みの状態を覚えておき、1本増えただけならその1本だけ追記する（書くほど重くならない）
  const inkRef = useRef<CanvasRenderingContext2D | null>(null);
  const rendered = useRef<{ strokes: Stroke[]; paper: PaperType; paperColor: string } | null>(
    null,
  );
  const redraw = useCallback(
    (forceFull = false) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      if (!inkRef.current) inkRef.current = createInkContext();
      const ink = inkRef.current;
      const prev = rendered.current;
      const n = strokes.length;
      const appendOnly =
        !forceFull &&
        prev &&
        prev.paper === paper &&
        prev.paperColor === paperColor &&
        n === prev.strokes.length + 1 &&
        (n === 1 || (strokes[0] === prev.strokes[0] && strokes[n - 2] === prev.strokes[n - 2]));
      if (appendOnly) paintStroke(ctx, strokes[n - 1], ink);
      else if (!prev || prev.strokes !== strokes || prev.paper !== paper || prev.paperColor !== paperColor || forceFull)
        renderPage(ctx, { strokes, texts: [] }, paper, paperColor, false, ink);
      rendered.current = { strokes, paper, paperColor };
    },
    [strokes, paper, paperColor],
  );

  useEffect(() => {
    redraw();
  }, [redraw]);

  const clearPreview = () => {
    if (previewFrame.current !== null) {
      cancelAnimationFrame(previewFrame.current);
      previewFrame.current = null;
    }
    const canvas = previewCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, PAGE_W, PAGE_H);
  };

  const schedulePreview = () => {
    if (previewFrame.current !== null) return;
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = null;
      const canvas = previewCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, PAGE_W, PAGE_H);
      if (drawing.current) drawStroke(ctx, drawing.current);
    });
  };

  useEffect(
    () => () => {
      if (previewFrame.current !== null) cancelAnimationFrame(previewFrame.current);
      const canvas = previewCanvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, PAGE_W, PAGE_H);
    },
    [],
  );

  // 初期表示は幅にフィット
  const fit = useCallback(() => {
    const v = viewRef.current;
    if (!v || v.clientWidth <= 0) return;
    const z = Math.min(1.6, Math.max(0.25, (v.clientWidth - 32) / PAGE_W));
    setZoom(z);
    setPan({ x: (v.clientWidth - PAGE_W * z) / 2, y: 16 });
    hasInitialFit.current = true;
  }, []);
  useEffect(() => {
    fit();
    const view = viewRef.current;
    if (!view) return;
    const observer = new ResizeObserver(() => {
      if (!hasInitialFit.current) fit();
    });
    observer.observe(view);
    return () => observer.disconnect();
  }, [fit]);

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

  const toPage = (clientX: number, clientY: number, pressure: number, pointerType: string) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * PAGE_W,
      y: ((clientY - r.top) / r.height) * PAGE_H,
      p: pointerType === "pen" ? Math.min(1, Math.max(0.05, pressure || 0.5)) : 0.5,
    };
  };

  const eventPoint = (e: React.PointerEvent) =>
    toPage(e.clientX, e.clientY, e.pressure, e.pointerType);

  const startPan = (e: React.PointerEvent) => {
    panning.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  /** 指（タッチ）のジェスチャー：1本指で移動、2本指でピンチ拡大縮小 */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "pan" | "pinch";
    x: number;
    y: number;
    dist: number;
    zoom: number;
    pan: { x: number; y: number };
  } | null>(null);
  const resetGesture = () => {
    const pts = [...touches.current.values()];
    const { zoom: z, pan: p } = stateRef.current;
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = {
        mode: "pinch",
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: z,
        pan: p,
      };
    } else if (pts.length === 1) {
      gesture.current = { mode: "pan", x: pts[0].x, y: pts[0].y, dist: 1, zoom: z, pan: p };
    } else gesture.current = null;
  };
  const touchGestureMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const v = viewRef.current;
    if (!g || !v) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...touches.current.values()];
    if (g.mode === "pan") {
      setPan({ x: g.pan.x + (pts[0].x - g.x), y: g.pan.y + (pts[0].y - g.y) });
      return;
    }
    if (pts.length < 2) return;
    const [a, b] = pts;
    const r = v.getBoundingClientRect();
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const next = Math.min(4, Math.max(0.2, (g.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist));
    const k = next / g.zoom;
    const ox = g.x - r.left;
    const oy = g.y - r.top;
    setZoom(next);
    setPan({
      x: mx - r.left - (ox - g.pan.x) * k,
      y: my - r.top - (oy - g.pan.y) * k,
    });
  };

  /** ペンのお尻（消しゴム側）やペンの消しゴムボタンか */
  const isPenEraser = (e: React.PointerEvent) =>
    e.pointerType === "pen" && ((e.buttons & 32) !== 0 || e.button === 5);

  const eraseFrame = useRef<number | null>(null);
  const pendingErase = useRef<Point[]>([]);
  const liveStrokes = useRef(strokes);
  liveStrokes.current = strokes;
  const flushErase = () => {
    eraseFrame.current = null;
    let cur = liveStrokes.current;
    for (const p of pendingErase.current) {
      cur =
        eraserMode === "stroke"
          ? eraseWholeAt(cur, p.x, p.y, eraserSize / 2)
          : eraseAt(cur, p.x, p.y, eraserSize / 2);
    }
    pendingErase.current = [];
    if (cur !== liveStrokes.current) {
      liveStrokes.current = cur;
      onChange({ strokes: cur, texts });
    }
  };
  const erase = (x: number, y: number) => {
    pendingErase.current.push({ x, y });
    if (eraseFrame.current === null) eraseFrame.current = requestAnimationFrame(flushErase);
  };

  const snapshot = () => {
    undoRef.current = [...undoRef.current.slice(-59), { strokes, texts }];
    redoRef.current = [];
  };

  // ペンを止めたら図形に自動補正（スマートシェイプ）
  const holdTimer = useRef<number | null>(null);
  const holdAnchor = useRef<Point | null>(null);
  const snappedLine = useRef(false);
  const clearHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const armHold = (pt: Point) => {
    const a = holdAnchor.current;
    if (a && Math.hypot(a.x - pt.x, a.y - pt.y) < 4 && holdTimer.current !== null) return;
    holdAnchor.current = pt;
    clearHold();
    if (!smartShape) return;
    holdTimer.current = window.setTimeout(() => {
      const d = drawing.current;
      if (!d || d.tool === "highlighter" || tool === "shape") return;
      const r = recognizeShape(d.points);
      if (!r) return;
      d.points = r.points;
      if (r.kind === "line") {
        snappedLine.current = true;
        shapeOrigin.current = { ...r.points[0] };
      }
      schedulePreview();
    }, 550);
  };

  // なげなわ選択
  const [selection, setSelection] = useState<string[]>([]);
  const lassoPath = useRef<Point[] | null>(null);
  const dragSel = useRef<{ x: number; y: number; base: Stroke[] } | null>(null);
  const selectedSet = new Set(selection);
  const selBox = (() => {
    if (!selection.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const st of strokes) {
      if (!selectedSet.has(st.id)) continue;
      const b = strokeBox(st);
      minX = Math.min(minX, b.minX - st.width);
      minY = Math.min(minY, b.minY - st.width);
      maxX = Math.max(maxX, b.maxX + st.width);
      maxY = Math.max(maxY, b.maxY + st.width);
    }
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
  })();
  useEffect(() => {
    if (tool !== "lasso") setSelection([]);
  }, [tool]);
  const drawLasso = () => {
    const ctx = previewCanvasRef.current?.getContext("2d");
    const path = lassoPath.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, PAGE_W, PAGE_H);
    if (!path || path.length < 2) return;
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0ea5e9";
    ctx.fillStyle = "rgba(14,165,233,0.06)";
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  const deleteSelection = () => {
    if (!selection.length) return;
    commit({ strokes: strokes.filter((st) => !selectedSet.has(st.id)), texts });
    setSelection([]);
  };
  const duplicateSelection = () => {
    if (!selection.length) return;
    const copies = strokes
      .filter((st) => selectedSet.has(st.id))
      .map((st) => ({
        ...st,
        id: crypto.randomUUID(),
        points: st.points.map((q) => ({ ...q, x: q.x + 24, y: q.y + 24 })),
      }));
    commit({ strokes: [...strokes, ...copies], texts });
    setSelection(copies.map((c) => c.id));
  };
  const recolorSelection = () => {
    if (!selection.length) return;
    commit({
      strokes: strokes.map((st) =>
        selectedSet.has(st.id) && st.tool !== "highlighter" ? { ...st, color } : st,
      ),
      texts,
    });
  };

  const pickColor = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex = `#${[d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    setColor(hex);
    setTool(lastDrawTool.current);
  };

  const onDown = (e: React.PointerEvent) => {
    // 指：ペン優先・手のひらツール時は常に移動／拡大。2本目の指が来たら描画を取り消してピンチへ
    if (e.pointerType === "touch") {
      const drawingByTouch = activePointer.current !== null && !panning.current;
      const toGesture =
        penOnly || tool === "hand" || touches.current.size > 0 || readOnly;
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toGesture) {
        if (drawingByTouch) {
          drawing.current = null;
          erasing.current = false;
          activePointer.current = null;
          clearHold();
          clearPreview();
        }
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        resetGesture();
        return;
      }
    }
    if (activePointer.current !== null || panning.current) return;
    if (!e.isPrimary && tool !== "hand") return;
    if (tool === "hand" || e.button === 1 || spacePressed.current) {
      activePointer.current = e.pointerId;
      startPan(e);
      return;
    }
    if (readOnly) return;
    const pt = eventPoint(e);
    const penEraser = isPenEraser(e);

    if (!penEraser && tool === "eyedropper") {
      pickColor(pt.x, pt.y);
      return;
    }
    if (!penEraser && tool === "fill") {
      const f: Stroke = {
        id: crypto.randomUUID(),
        tool: "fill",
        color,
        width: 0,
        points: [{ x: Math.round(pt.x), y: Math.round(pt.y) }],
      };
      commit({ strokes: [...strokes, f], texts });
      return;
    }
    if (!penEraser && tool === "text") {
      const t: TextBox = {
        id: crypto.randomUUID(),
        x: pt.x,
        y: pt.y,
        w: 420,
        text: "",
        size: 32,
        color: "#111827",
      };
      commit({ strokes, texts: [...texts, t] });
      setActiveText(t.id);
      setTool("pen");
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointer.current = e.pointerId;
    if (!penEraser && tool === "lasso") {
      if (
        selBox &&
        pt.x >= selBox.minX &&
        pt.x <= selBox.maxX &&
        pt.y >= selBox.minY &&
        pt.y <= selBox.maxY
      ) {
        snapshot();
        dragSel.current = { x: pt.x, y: pt.y, base: strokes };
        return;
      }
      setSelection([]);
      lassoPath.current = [pt];
      return;
    }
    if (penEraser || tool === "eraser") {
      snapshot();
      erase(pt.x, pt.y);
      drawing.current = null;
      erasing.current = true;
      return;
    }
    drawing.current = {
      id: crypto.randomUUID(),
      tool:
        tool === "marker"
          ? "marker"
          : tool === "highlighter"
            ? "highlighter"
            : tool === "pencil"
              ? "pencil"
              : "pen",
      color: activeColor,
      width: tool === "highlighter" ? width * 8 : tool === "marker" ? width * 2.2 : width,
      points: [pt],
    };
    snappedLine.current = false;
    shapeOrigin.current = tool === "shape" ? { ...pt, p: 0.5 } : null;
    armHold(pt);
    schedulePreview();
  };

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && touches.current.has(e.pointerId) && gesture.current) {
      touchGestureMove(e);
      return;
    }
    if (activePointer.current !== null && e.pointerId !== activePointer.current) return;
    if (panning.current) {
      setPan({
        x: panning.current.ox + (e.clientX - panning.current.x),
        y: panning.current.oy + (e.clientY - panning.current.y),
      });
      return;
    }
    const pt = eventPoint(e);
    if (tool === "eraser" || erasing.current) setCursor({ x: pt.x, y: pt.y });
    if (readOnly) return;
    // ボタン／指が離れている間は絶対に描かない
    if (e.buttons === 0) return;
    if (erasing.current) {
      const samples = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const sm of samples) {
        const q = toPage(sm.clientX, sm.clientY, sm.pressure, sm.pointerType);
        erase(q.x, q.y);
      }
      return;
    }
    if (lassoPath.current) {
      lassoPath.current.push(pt);
      drawLasso();
      return;
    }
    if (dragSel.current) {
      const ds = dragSel.current;
      const dx = pt.x - ds.x;
      const dy = pt.y - ds.y;
      onChange({
        strokes: ds.base.map((st) =>
          selectedSet.has(st.id)
            ? { ...st, points: st.points.map((q) => ({ ...q, x: q.x + dx, y: q.y + dy })) }
            : st,
        ),
        texts,
      });
      return;
    }
    const d = drawing.current;
    if (!d) return;
    if (tool === "shape" && shapeOrigin.current) {
      d.points = shapePoints(shape, shapeOrigin.current, pt);
    } else if (snappedLine.current && shapeOrigin.current) {
      d.points = shapePoints("line", shapeOrigin.current, pt);
    } else if (straight) {
      d.points = [d.points[0], pt];
    } else {
      const samples = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const sample of samples) {
        const samplePoint = toPage(
          sample.clientX,
          sample.clientY,
          sample.pressure,
          sample.pointerType,
        );
        const last = d.points[d.points.length - 1];
        // 手ぶれ補正：前の点へ少し引き寄せて細かな揺れを取り除く
        const k = 1 - smooth;
        const smoothed = {
          x: last.x + (samplePoint.x - last.x) * k,
          y: last.y + (samplePoint.y - last.y) * k,
          p: samplePoint.p,
        };
        const dist = Math.hypot(smoothed.x - last.x, smoothed.y - last.y);
        if (dist >= 0.7) d.points.push(smoothed);
      }
      armHold(pt);
    }
    schedulePreview();
  };

  const finishStroke = () => {
    activePointer.current = null;
    panning.current = null;
    clearHold();
    if (erasing.current) {
      erasing.current = false;
      if (eraseFrame.current !== null) {
        cancelAnimationFrame(eraseFrame.current);
        flushErase();
      }
      if (tool !== "eraser") setCursor(null);
      force((n) => n + 1);
    }
    if (lassoPath.current) {
      const poly = lassoPath.current;
      lassoPath.current = null;
      clearPreview();
      if (poly.length > 2) {
        const ids = strokes
          .filter((st) => {
            if (st.tool === "fill") return false;
            const inside = st.points.filter((q) => pointInPolygon(q, poly)).length;
            return inside > 0 && inside >= st.points.length * 0.5;
          })
          .map((st) => st.id);
        setSelection(ids);
      }
      return;
    }
    if (dragSel.current) {
      dragSel.current = null;
      force((n) => n + 1);
      return;
    }
    const d = drawing.current;
    drawing.current = null;
    snappedLine.current = false;
    clearPreview();
    if (d && d.points.length > 0) commit({ strokes: [...strokes, d], texts });
  };

  const onUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
      touches.current.delete(e.pointerId);
      if (gesture.current) {
        resetGesture();
        return;
      }
    }
    if (activePointer.current !== null && e.pointerId !== activePointer.current) return;
    finishStroke();
  };

  const cancelDrawing = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
    if (gesture.current) {
      resetGesture();
      return;
    }
    activePointer.current = null;
    panning.current = null;
    drawing.current = null;
    erasing.current = false;
    lassoPath.current = null;
    dragSel.current = null;
    clearHold();
    clearPreview();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    redraw(true);
  };

  const openContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
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
    c.width = PAGE_W;
    c.height = PAGE_H;
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
      const typing =
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "INPUT";
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z" && !typing) {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        return;
      }
      if (typing) return;
      if (e.key === " ") {
        e.preventDefault();
        spacePressed.current = true;
      }
      const map: Record<string, Tool> = {
        p: "pen",
        n: "pencil",
        m: "marker",
        h: "highlighter",
        e: "eraser",
        t: "text",
        v: "hand",
        f: "fill",
        l: "lasso",
        i: "eyedropper",
      };
      if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
      if (e.key === "0") fit();
      if ((e.key === "Delete" || e.key === "Backspace") && selection.length) deleteSelection();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") spacePressed.current = false;
    };
    const blur = () => {
      spacePressed.current = false;
    };
    window.addEventListener("keydown", h);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", h);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  });

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [contextMenu]);

  const swatches = tool === "highlighter" ? MARKER_COLORS : PEN_COLORS;
  const isPenTool =
    tool === "pen" ||
    tool === "pencil" ||
    tool === "marker" ||
    tool === "highlighter" ||
    tool === "shape";

  return (
    <div className="flex h-full min-h-0 w-full flex-col md:flex-row">
      {/* 左：常設ツールバー（持ち替えのために戻る必要なし） */}
      {!readOnly && (
        <div className="flex w-full shrink-0 flex-row items-center gap-1 overflow-x-auto border-b bg-card/90 px-2 py-1 backdrop-blur md:w-14 md:flex-col md:overflow-x-visible md:border-b-0 md:border-r md:px-0 md:py-2">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              title={t.label}
              onClick={() => setTool(t.key)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border transition",
                tool === t.key
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-transparent hover:bg-muted",
              )}
            >
              <t.icon className="h-[18px] w-[18px]" />
            </button>
          ))}
          <span className="my-1 h-px w-8 bg-border" />
          <button
            title="元に戻す"
            onClick={undo}
            className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-muted"
          >
            <Undo2 className="h-[18px] w-[18px]" />
          </button>
          <button
            title="やり直し"
            onClick={redo}
            className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-muted"
          >
            <Redo2 className="h-[18px] w-[18px]" />
          </button>
          <button
            title="PNG保存"
            onClick={exportPng}
            className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-muted"
          >
            <Download className="h-[18px] w-[18px]" />
          </button>
          <button
            title="ページを消去"
            onClick={clearPage}
            className="ml-auto flex h-9 w-10 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 md:ml-0 md:mt-auto"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 上：選択中の道具の設定（その場で変更できる） */}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-card/70 px-3 py-1.5 backdrop-blur">
            <span className="text-xs font-semibold text-muted-foreground">
              {TOOLS.find((t) => t.key === tool)?.label}
            </span>
            {tool === "fill" && (
              <>
                <span className="h-5 w-px bg-border" />
                {PEN_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={`色 ${c}`}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition",
                      color === c ? "scale-110 border-foreground" : "border-border",
                    )}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  aria-label="カスタム色"
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-8 rounded border"
                />
                <span className="text-[11px] text-muted-foreground">線で囲まれた中をタップ</span>
              </>
            )}
            {tool === "lasso" && (
              <>
                <span className="h-5 w-px bg-border" />
                <span className="text-[11px] text-muted-foreground">
                  {selection.length
                    ? `${selection.length}本を選択中（ドラッグで移動）`
                    : "囲んで選択"}
                </span>
                {selection.length > 0 && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={duplicateSelection}>
                      <Copy className="mr-1 h-3.5 w-3.5" />複製
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={recolorSelection}>
                      <span className="mr-1 inline-block h-3 w-3 rounded-full border" style={{ background: color }} />
                      この色に
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={deleteSelection}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />削除
                    </Button>
                  </>
                )}
              </>
            )}
            {tool === "eyedropper" && (
              <span className="text-[11px] text-muted-foreground">ノート上の色をタップして取り込み</span>
            )}
            {isPenTool && (
              <>
                <span className="h-5 w-px bg-border" />
                {swatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => (tool === "highlighter" ? setHlColor(c) : setColor(c))}
                    aria-label={`色 ${c}`}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition",
                      activeColor === c ? "scale-110 border-foreground" : "border-border",
                    )}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  value={activeColor}
                  aria-label="カスタム色"
                  onChange={(e) =>
                    tool === "highlighter" ? setHlColor(e.target.value) : setColor(e.target.value)
                  }
                  className="h-7 w-8 rounded border"
                />
                <span className="h-5 w-px bg-border" />
                <span className="text-[11px] text-muted-foreground">太さ</span>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-24"
                  aria-label="太さ"
                />
                <span className="text-[11px] tabular-nums text-muted-foreground">{width}</span>
                {tool === "shape" ? (
                  <>
                    <span className="h-5 w-px bg-border" />
                    {SHAPES.map((s) => (
                      <Button
                        key={s.key}
                        size="sm"
                        variant={shape === s.key ? "default" : "outline"}
                        className="h-7 px-2 text-xs"
                        onClick={() => setShape(s.key)}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant={straight ? "default" : "outline"}
                      className="h-7"
                      onClick={() => setStraight((s) => !s)}
                      title="直線モード"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="h-5 w-px bg-border" />
                    <span className="text-[11px] text-muted-foreground">手ぶれ補正</span>
                    <select
                      value={smooth}
                      onChange={(e) => setSmooth(Number(e.target.value))}
                      className="h-7 rounded border bg-background px-1 text-xs"
                      aria-label="手ぶれ補正"
                    >
                      {SMOOTH_LEVELS.map((l) => (
                        <option key={l.v} value={l.v}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant={smartShape ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setSmartShape((v) => !v)}
                      title="描き終わりでペンを止めると直線・円・四角に整えます"
                    >
                      <Wand2 className="mr-1 h-3.5 w-3.5" />
                      図形補正
                    </Button>
                  </>
                )}
                {tool !== "highlighter" && (
                  <>
                    <span className="h-5 w-px bg-border" />
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        title={p.label}
                        onClick={() => {
                          setColor(p.color);
                          setWidth(p.width);
                        }}
                        className={cn(
                          "flex h-7 items-center gap-1 rounded-md border px-1.5 text-[11px]",
                          color === p.color && width === p.width
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted",
                        )}
                      >
                        <span
                          className="inline-block w-4 rounded-full"
                          style={{ background: p.color, height: Math.max(2, p.width) }}
                        />
                        {p.label}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
            {tool === "eraser" && (
              <>
                <span className="h-5 w-px bg-border" />
                <span className="text-[11px] text-muted-foreground">消しゴムの大きさ</span>
                <input
                  type="range"
                  min={8}
                  max={120}
                  value={eraserSize}
                  onChange={(e) => setEraserSize(Number(e.target.value))}
                  className="w-32"
                  aria-label="消しゴムの大きさ"
                />
                <span className="text-[11px] tabular-nums text-muted-foreground">{eraserSize}</span>
                <Button
                  size="sm"
                  variant={eraserMode === "pixel" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setEraserMode("pixel")}
                >
                  なぞった所だけ
                </Button>
                <Button
                  size="sm"
                  variant={eraserMode === "stroke" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setEraserMode("stroke")}
                >
                  線ごと
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant={penOnly ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setPenOnly((v) => !v)}
              title="ペンで書き、指で移動・ピンチで拡大縮小"
            >
              {penOnly ? "ペン優先" : "タッチ入力"}
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => zoomBy(1 / 1.25)}
                title="縮小"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => zoomBy(1.25)}
                title="拡大"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={fit}
                title="幅に合わせる"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 用紙 */}
        <div
          ref={viewRef}
          onContextMenu={openContextMenu}
          className="relative min-h-0 flex-1 overflow-hidden bg-muted/40 touch-none"
        >
          <div
            className="absolute left-0 top-0 origin-top-left shadow-2xl"
            style={{
              width: PAGE_W,
              height: PAGE_H,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <canvas
              ref={canvasRef}
              width={PAGE_W}
              height={PAGE_H}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={cancelDrawing}
              onPointerLeave={() => setCursor(null)}
              className="absolute inset-0 h-full w-full touch-none rounded-sm bg-white"
              style={{
                cursor:
                  tool === "hand"
                    ? "grab"
                    : tool === "lasso"
                      ? "cell"
                      : tool === "fill" || tool === "eyedropper"
                        ? "copy"
                    : tool === "eraser"
                      ? "none"
                      : readOnly
                        ? "default"
                        : "crosshair",
              }}
            />
            <canvas
              ref={previewCanvasRef}
              width={PAGE_W}
              height={PAGE_H}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            {selBox && tool === "lasso" && (
              <div
                className="pointer-events-none absolute rounded border-2 border-dashed border-primary bg-primary/5"
                style={{
                  left: selBox.minX,
                  top: selBox.minY,
                  width: selBox.maxX - selBox.minX,
                  height: selBox.maxY - selBox.minY,
                }}
              />
            )}
            {(tool === "eraser" || erasing.current) && cursor && !readOnly && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-foreground/60 bg-foreground/5"
                style={{
                  left: cursor.x - eraserSize / 2,
                  top: cursor.y - eraserSize / 2,
                  width: eraserSize,
                  height: eraserSize,
                }}
              />
            )}
            {texts.map((t) => (
              <div key={t.id} className="absolute" style={{ left: t.x, top: t.y, width: t.w }}>
                <div className="group relative">
                  {!readOnly && (
                    <div className="absolute -top-11 left-0 z-10 hidden items-center gap-1 rounded-md border bg-card p-1 shadow group-focus-within:flex">
                      <input
                        type="color"
                        value={t.color}
                        onChange={(e) => updateText(t.id, { color: e.target.value })}
                        className="h-7 w-8 rounded border"
                        aria-label="文字色"
                      />
                      <input
                        type="range"
                        min={14}
                        max={96}
                        value={t.size}
                        onChange={(e) => updateText(t.id, { size: Number(e.target.value) })}
                        className="w-24"
                        aria-label="文字サイズ"
                      />
                      <button
                        className="px-1 text-sm font-bold"
                        onClick={() => updateText(t.id, { bold: !t.bold }, true)}
                      >
                        B
                      </button>
                      <button
                        className="px-1 text-sm text-destructive"
                        onClick={() => removeText(t.id)}
                      >
                        削除
                      </button>
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
                      fontSize: t.size,
                      color: t.color,
                      fontWeight: t.bold ? 700 : 400,
                      minHeight: "1.6em",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {contextMenu && (
            <div
              role="menu"
              onPointerDown={(e) => e.stopPropagation()}
              className="fixed z-50 w-64 rounded-xl border bg-popover p-1.5 text-sm shadow-xl max-sm:inset-x-2 max-sm:bottom-2 max-sm:top-auto max-sm:w-auto max-sm:max-h-[min(70dvh,32rem)] max-sm:overflow-y-auto max-sm:rounded-2xl max-sm:p-2 max-sm:pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
              style={{
                left:
                  window.innerWidth < 640
                    ? undefined
                    : Math.max(8, Math.min(contextMenu.x, window.innerWidth - 272)),
                top:
                  window.innerWidth < 640
                    ? undefined
                    : Math.max(8, Math.min(contextMenu.y, window.innerHeight - 280)),
              }}
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold text-muted-foreground">
                Cnoteの操作
              </p>
              <div className="grid grid-cols-2 gap-1">
                {TOOLS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setTool(item.key);
                      setContextMenu(null);
                    }}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent",
                      tool === item.key && "bg-primary/10 text-primary",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="my-1 border-t" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  undo();
                  setContextMenu(null);
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent"
              >
                <Undo2 className="h-4 w-4" /> 元に戻す
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  redo();
                  setContextMenu(null);
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent"
              >
                <Redo2 className="h-4 w-4" /> やり直す
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  fit();
                  setContextMenu(null);
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent"
              >
                <Maximize2 className="h-4 w-4" /> ページを画面に合わせる
              </button>
              {!readOnly && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    clearPage();
                    setContextMenu(null);
                  }}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> ページを消去
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
