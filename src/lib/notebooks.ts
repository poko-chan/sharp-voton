export type PaperType = "ruled" | "dotted" | "grid" | "plain" | "cornell" | "music" | "todo";

export const PAPER_TYPES: { key: PaperType; label: string; note: string }[] = [
  { key: "ruled", label: "横罫（B罫）", note: "定番の横線ノート" },
  { key: "dotted", label: "ドット方眼", note: "点で位置合わせしやすい" },
  { key: "grid", label: "方眼（5mm）", note: "図やグラフ向け" },
  { key: "plain", label: "無地", note: "自由にレイアウト" },
  { key: "cornell", label: "コーネル式", note: "要点・メモ・まとめの3分割" },
  { key: "music", label: "五線譜", note: "音楽用" },
  { key: "todo", label: "チェックリスト", note: "□付きの横罫" },
];

export const COVER_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#7c3aed",
  "#0f766e",
  "#db2777",
  "#334155",
  "#ea580c",
  "#0891b2",
];

export const PAPER_COLORS = [
  { key: "#ffffff", label: "白" },
  { key: "#fdf6e3", label: "クリーム" },
  { key: "#f1f5f9", label: "グレー" },
  { key: "#eef7ee", label: "グリーン" },
];

export const PAGE_W = 1240;
export const PAGE_H = 1754;

export type Point = { x: number; y: number; p?: number };
export type Stroke = {
  id: string;
  /** fill = バケツ塗りつぶし（points[0] が塗り始めの位置） */
  tool: "pen" | "pencil" | "marker" | "highlighter" | "fill";
  color: string;
  width: number;
  points: Point[];
};
export type TextBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  text: string;
  size: number;
  color: string;
  bold?: boolean;
  bg?: string | null;
};

export type NotePage = {
  id: string;
  page_index: number;
  title: string;
  strokes: Stroke[];
  texts: TextBox[];
};

export type Notebook = {
  id: string;
  owner_id: string;
  subject_id: string | null;
  title: string;
  cover_color: string;
  paper_type: PaperType;
  paper_color: string;
  archived: boolean;
  updated_at: string;
};

/** ノートの紙の罫線を canvas に描画する（実際のノート商品に近い寸法） */
export function drawPaper(ctx: CanvasRenderingContext2D, type: PaperType, paperColor: string) {
  ctx.save();
  ctx.fillStyle = paperColor;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  const line = "rgba(59,130,246,0.30)";
  const soft = "rgba(100,116,139,0.28)";
  if (type === "ruled" || type === "todo") {
    const gap = 46; // B罫相当
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    for (let y = 120; y < PAGE_H - 60; y += gap) {
      ctx.beginPath();
      ctx.moveTo(70, y);
      ctx.lineTo(PAGE_W - 70, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(239,68,68,0.35)";
    ctx.beginPath();
    ctx.moveTo(110, 60);
    ctx.lineTo(110, PAGE_H - 60);
    ctx.stroke();
    if (type === "todo") {
      ctx.strokeStyle = soft;
      for (let y = 120; y < PAGE_H - 60; y += gap) {
        ctx.strokeRect(128, y - 26, 22, 22);
      }
    }
  } else if (type === "grid") {
    const gap = 30;
    ctx.strokeStyle = soft;
    ctx.lineWidth = 1;
    for (let x = gap; x < PAGE_W; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, PAGE_H);
      ctx.stroke();
    }
    for (let y = gap; y < PAGE_H; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(PAGE_W, y);
      ctx.stroke();
    }
  } else if (type === "dotted") {
    const gap = 36;
    ctx.fillStyle = "rgba(100,116,139,0.5)";
    for (let x = gap; x < PAGE_W; x += gap) {
      for (let y = gap; y < PAGE_H; y += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === "cornell") {
    const gap = 46;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    for (let y = 150; y < PAGE_H - 300; y += gap) {
      ctx.beginPath();
      ctx.moveTo(340, y);
      ctx.lineTo(PAGE_W - 70, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(239,68,68,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(320, 100);
    ctx.lineTo(320, PAGE_H - 300);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(70, PAGE_H - 300);
    ctx.lineTo(PAGE_W - 70, PAGE_H - 300);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(70, 100);
    ctx.lineTo(PAGE_W - 70, 100);
    ctx.stroke();
  } else if (type === "music") {
    ctx.strokeStyle = "rgba(30,41,59,0.55)";
    ctx.lineWidth = 1.4;
    for (let s = 0; s < 10; s++) {
      const top = 140 + s * 160;
      for (let i = 0; i < 5; i++) {
        const y = top + i * 16;
        ctx.beginPath();
        ctx.moveTo(80, y);
        ctx.lineTo(PAGE_W - 80, y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.points.length === 0 || s.tool === "fill") return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = s.tool === "highlighter" ? 0.32 : 1;
  if (s.points.length === 1) {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  for (let i = 1; i < s.points.length; i++) {
    const a = s.points[i - 1];
    const b = s.points[i];
    const next = s.points[i + 1] ?? b;
    const pressure = s.tool === "pen" || s.tool === "pencil" ? (b.p ?? 0.5) : 0.5;
    ctx.lineWidth =
      s.tool === "pen"
        ? s.width * (0.55 + pressure)
        : s.tool === "pencil"
          ? s.width * (0.5 + pressure * 0.8)
          : s.width;
    if (s.tool === "pencil") ctx.globalAlpha = 0.55 + ((i * 37) % 20) / 100;
    const midpoint = { x: (b.x + next.x) / 2, y: (b.y + next.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(b.x, b.y, midpoint.x, midpoint.y);
    ctx.stroke();
  }
  ctx.restore();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * バケツ塗りつぶし。インクだけを描いた ink キャンバス（紙の罫線なし）で
 * 同じ色が続く範囲を調べ、その範囲を ctx と ink の両方に塗る。
 */
export function floodFillInto(
  ctx: CanvasRenderingContext2D,
  ink: CanvasRenderingContext2D,
  s: Stroke,
) {
  const W = PAGE_W;
  const H = PAGE_H;
  const seed = s.points[0];
  if (!seed) return;
  const sx = Math.round(seed.x);
  const sy = Math.round(seed.y);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const src = ink.getImageData(0, 0, W, H).data;
  const i0 = (sy * W + sx) * 4;
  const r0 = src[i0], g0 = src[i0 + 1], b0 = src[i0 + 2], a0 = src[i0 + 3];
  const tol = 56;
  const match = (i: number) => {
    const a = src[i + 3];
    if (a0 < 24) return a < 24;
    return (
      Math.abs(a - a0) <= tol &&
      Math.abs(src[i] - r0) <= tol &&
      Math.abs(src[i + 1] - g0) <= tol &&
      Math.abs(src[i + 2] - b0) <= tol
    );
  };
  const mask = new Uint8Array(W * H);
  let minX = sx, maxX = sx, minY = sy, maxY = sy;
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    let idx = y * W + x;
    while (x >= 0 && !mask[idx] && match(idx * 4)) {
      x--;
      idx--;
    }
    x++;
    idx++;
    let up = false;
    let down = false;
    while (x < W && !mask[idx] && match(idx * 4)) {
      mask[idx] = 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (y > 0) {
        const u = idx - W;
        const m = !mask[u] && match(u * 4);
        if (m && !up) {
          stack.push(x, y - 1);
          up = true;
        } else if (!m) up = false;
      }
      if (y < H - 1) {
        const d = idx + W;
        const m = !mask[d] && match(d * 4);
        if (m && !down) {
          stack.push(x, y + 1);
          down = true;
        } else if (!m) down = false;
      }
      x++;
      idx++;
    }
  }
  // 線のふちとのすき間ができないよう 2px 広げる
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const out = new ImageData(bw, bh);
  const [r, g, b] = hexToRgb(s.color);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hit = false;
      for (let dy = -pad; dy <= pad && !hit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -pad; dx <= pad; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < W && mask[yy * W + xx]) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) continue;
      const o = ((y - minY) * bw + (x - minX)) * 4;
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = 255;
    }
  }
  const tmp = document.createElement("canvas");
  tmp.width = bw;
  tmp.height = bh;
  tmp.getContext("2d")!.putImageData(out, 0, 0);
  ctx.drawImage(tmp, minX, minY);
  ink.drawImage(tmp, minX, minY);
}

/** 1本を描く（ink があればインク専用キャンバスにも描く） */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  ink?: CanvasRenderingContext2D | null,
) {
  if (s.tool === "fill") {
    if (ink) floodFillInto(ctx, ink, s);
    return;
  }
  drawStroke(ctx, s);
  if (ink) drawStroke(ink, s);
}

export function createInkContext() {
  const c = document.createElement("canvas");
  c.width = PAGE_W;
  c.height = PAGE_H;
  return c.getContext("2d", { willReadFrequently: true });
}

export function renderPage(
  ctx: CanvasRenderingContext2D,
  page: { strokes: Stroke[]; texts: TextBox[] },
  paper: PaperType,
  paperColor: string,
  withText = false,
  inkCtx?: CanvasRenderingContext2D | null,
) {
  drawPaper(ctx, paper, paperColor);
  let ink = inkCtx ?? null;
  if (ink) ink.clearRect(0, 0, PAGE_W, PAGE_H);
  else if (page.strokes.some((s) => s.tool === "fill")) ink = createInkContext();
  for (const s of page.strokes) paintStroke(ctx, s, ink);
  if (withText) {
    for (const t of page.texts) {
      ctx.save();
      ctx.fillStyle = t.color;
      ctx.font = `${t.bold ? "bold " : ""}${t.size}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      const lines = wrapText(ctx, t.text, t.w);
      lines.forEach((ln, i) => ctx.fillText(ln, t.x, t.y + i * t.size * 1.5));
      ctx.restore();
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    out.push(cur);
  }
  return out;
}

/** 2点間の距離（消しゴム判定用） */
export function distToStroke(s: Stroke, x: number, y: number, r: number) {
  return s.points.some((p) => Math.hypot(p.x - x, p.y - y) <= r);
}

export type ShapeKind = "line" | "rect" | "ellipse" | "arrow";

/** 図形を手書き線と同じ点列に変換する（既存データ形式のまま保存・部分消去できる） */
export function shapePoints(kind: ShapeKind, a: Point, b: Point): Point[] {
  const seg = (p: Point, q: Point, n = 24) =>
    Array.from({ length: n + 1 }, (_, i) => ({
      x: p.x + ((q.x - p.x) * i) / n,
      y: p.y + ((q.y - p.y) * i) / n,
      p: 0.5,
    }));
  if (kind === "line") return seg(a, b);
  if (kind === "rect") {
    const c1 = { x: b.x, y: a.y };
    const c2 = { x: a.x, y: b.y };
    return [...seg(a, c1), ...seg(c1, b), ...seg(b, c2), ...seg(c2, a)];
  }
  if (kind === "ellipse") {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    return Array.from({ length: 73 }, (_, i) => {
      const t = (i / 72) * Math.PI * 2;
      return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t), p: 0.5 };
    });
  }
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
  const h1 = { x: b.x - len * Math.cos(ang - 0.45), y: b.y - len * Math.sin(ang - 0.45) };
  const h2 = { x: b.x - len * Math.cos(ang + 0.45), y: b.y - len * Math.sin(ang + 0.45) };
  return [...seg(a, b), ...seg(b, h1, 6), ...seg(h1, b, 6), ...seg(b, h2, 6)];
}

/**
 * 本物の消しゴムのように、触れた部分だけを削る。
 * 線を丸ごと消さず、消した箇所で線を分割して残りを保持する。
 */
export function eraseAt(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  return eraseAtMany(strokes, [{ x, y }], radius);
}

/** 同じフレーム内の消去入力をまとめて処理し、線の走査回数を抑える。 */
export function eraseAtMany(strokes: Stroke[], points: Point[], radius: number): Stroke[] {
  if (points.length === 0) return strokes;
  let changed = false;
  const out: Stroke[] = [];
  for (const s of strokes) {
    const r = radius + s.width / 2;
    const bb = strokeBox(s);
    const nearBox = points.some(
      (point) =>
        point.x >= bb.minX - r &&
        point.x <= bb.maxX + r &&
        point.y >= bb.minY - r &&
        point.y <= bb.maxY + r,
    );
    if (s.tool === "fill" || !nearBox) {
      out.push(s);
      continue;
    }
    let strokeChanged = false;
    let run: Point[] = [];
    const flush = () => {
      if (run.length >= 2) out.push({ ...s, id: crypto.randomUUID(), points: run });
      run = [];
    };
    for (const p of s.points) {
      if (points.some((point) => Math.hypot(p.x - point.x, p.y - point.y) <= r)) {
        strokeChanged = true;
        flush();
      } else {
        run.push(p);
      }
    }
    if (strokeChanged) {
      changed = true;
      flush();
    } else {
      out.push(s);
    }
  }
  return changed ? out : strokes;
}

const boxCache = new WeakMap<Stroke, { minX: number; minY: number; maxX: number; maxY: number }>();
/** 線の外接矩形（キャッシュ付き。消しゴム・選択の高速化用） */
export function strokeBox(s: Stroke) {
  let b = boxCache.get(s);
  if (b) return b;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  b = { minX, minY, maxX, maxY };
  boxCache.set(s, b);
  return b;
}

/** 線を丸ごと消す（オブジェクト消しゴム） */
export function eraseWholeAt(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  return eraseWholeAtMany(strokes, [{ x, y }], radius);
}

export function eraseWholeAtMany(strokes: Stroke[], points: Point[], radius: number): Stroke[] {
  if (points.length === 0) return strokes;
  const out = strokes.filter((s) => {
    const r = radius + s.width / 2 + (s.tool === "fill" ? 6 : 0);
    const bb = strokeBox(s);
    const nearBox = points.some(
      (point) =>
        point.x >= bb.minX - r &&
        point.x <= bb.maxX + r &&
        point.y >= bb.minY - r &&
        point.y <= bb.maxY + r,
    );
    if (!nearBox) return true;
    return !s.points.some((p) =>
      points.some((point) => Math.hypot(p.x - point.x, p.y - point.y) <= r),
    );
  });
  return out.length === strokes.length ? strokes : out;
}

export function pointInPolygon(pt: Point, poly: Point[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/**
 * 描き終わりで止めたときの自動補正（Appleのスマートシェイプ風）。
 * 直線・円・四角に近ければ整えた点列を返す。該当なしは null。
 */
export function recognizeShape(pts: Point[]): { kind: ShapeKind; points: Point[] } | null {
  if (pts.length < 4) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  let maxDev = 0;
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (chord > 0) {
      const d =
        Math.abs((b.y - a.y) * pts[i].x - (b.x - a.x) * pts[i].y + b.x * a.y - b.y * a.x) / chord;
      if (d > maxDev) maxDev = d;
    }
  }
  if (length < 30) return null;
  if (chord > 30 && maxDev < Math.max(8, chord * 0.06))
    return { kind: "line", points: shapePoints("line", a, b) };
  // 閉じた図形か
  if (chord > length * 0.2) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 20 || h < 20) return null;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // 楕円との誤差 vs 四角との誤差
  let eErr = 0;
  let rErr = 0;
  for (const p of pts) {
    const nx = (p.x - cx) / (w / 2);
    const ny = (p.y - cy) / (h / 2);
    eErr += Math.abs(Math.hypot(nx, ny) - 1);
    rErr += Math.abs(Math.max(Math.abs(nx), Math.abs(ny)) - 1);
  }
  const tl = { x: minX, y: minY };
  const br = { x: maxX, y: maxY };
  return eErr <= rErr
    ? { kind: "ellipse", points: shapePoints("ellipse", tl, br) }
    : { kind: "rect", points: shapePoints("rect", tl, br) };
}
