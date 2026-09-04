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
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#7c3aed",
  "#0f766e", "#db2777", "#334155", "#ea580c", "#0891b2",
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
  tool: "pen" | "marker" | "highlighter";
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
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PAGE_H); ctx.stroke();
    }
    for (let y = gap; y < PAGE_H; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); ctx.stroke();
    }
  } else if (type === "dotted") {
    const gap = 36;
    ctx.fillStyle = "rgba(100,116,139,0.5)";
    for (let x = gap; x < PAGE_W; x += gap) {
      for (let y = gap; y < PAGE_H; y += gap) {
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (type === "cornell") {
    const gap = 46;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    for (let y = 150; y < PAGE_H - 300; y += gap) {
      ctx.beginPath(); ctx.moveTo(340, y); ctx.lineTo(PAGE_W - 70, y); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(239,68,68,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(320, 100); ctx.lineTo(320, PAGE_H - 300); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(70, PAGE_H - 300); ctx.lineTo(PAGE_W - 70, PAGE_H - 300); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(70, 100); ctx.lineTo(PAGE_W - 70, 100); ctx.stroke();
  } else if (type === "music") {
    ctx.strokeStyle = "rgba(30,41,59,0.55)";
    ctx.lineWidth = 1.4;
    for (let s = 0; s < 10; s++) {
      const top = 140 + s * 160;
      for (let i = 0; i < 5; i++) {
        const y = top + i * 16;
        ctx.beginPath(); ctx.moveTo(80, y); ctx.lineTo(PAGE_W - 80, y); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.points.length === 0) return;
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
    const pressure = s.tool === "pen" ? (b.p ?? 0.5) : 0.5;
    ctx.lineWidth = s.tool === "pen" ? s.width * (0.55 + pressure) : s.width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderPage(
  ctx: CanvasRenderingContext2D,
  page: { strokes: Stroke[]; texts: TextBox[] },
  paper: PaperType,
  paperColor: string,
  withText = false,
) {
  drawPaper(ctx, paper, paperColor);
  for (const s of page.strokes) drawStroke(ctx, s);
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
