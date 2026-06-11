import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Download, Pencil, Save } from "lucide-react";

export function ScratchPad({
  initial,
  onSave,
}: {
  initial?: string | null;
  onSave?: (dataUrl: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"pen" | "erase">("pen");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(3);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initial;
    }
  }, [initial]);

  const pos = (e: React.PointerEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const { x, y } = pos(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = mode === "erase" ? "#ffffff" : color;
    ctx.lineWidth = mode === "erase" ? size * 6 : size;
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => { drawing.current = false; };

  const clear = () => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const download = () => {
    const url = ref.current!.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `makron-scratchpad-${Date.now()}.png`;
    a.click();
  };

  const save = () => {
    if (!onSave) return;
    onSave(ref.current!.toDataURL("image/png"));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        <Button size="sm" variant={mode === "pen" ? "default" : "outline"} onClick={() => setMode("pen")}><Pencil className="h-4 w-4 mr-1" />ペン</Button>
        <Button size="sm" variant={mode === "erase" ? "default" : "outline"} onClick={() => setMode("erase")}><Eraser className="h-4 w-4 mr-1" />消しゴム</Button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-9 rounded border" />
        <input type="range" min={1} max={12} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24" />
        <Button size="sm" variant="ghost" onClick={clear}>クリア</Button>
        <Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4 mr-1" />DL</Button>
        {onSave && <Button size="sm" onClick={save}><Save className="h-4 w-4 mr-1" />保存</Button>}
      </div>
      <canvas
        ref={ref}
        width={1100}
        height={700}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className="w-full aspect-[11/7] border-2 border-border rounded-md bg-white touch-none"
      />
    </div>
  );
}