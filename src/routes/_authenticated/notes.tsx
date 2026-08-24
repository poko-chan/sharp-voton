import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, StickyNote as StickyIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
});

type Note = {
  id: string;
  content: string;
  color: string;
  x: number;
  y: number;
  z_index: number;
};

const COLORS: { key: string; bg: string; ring: string }[] = [
  { key: "yellow", bg: "#fef3c7", ring: "#f59e0b" },
  { key: "pink", bg: "#fce7f3", ring: "#ec4899" },
  { key: "blue", bg: "#dbeafe", ring: "#3b82f6" },
  { key: "green", bg: "#dcfce7", ring: "#22c55e" },
  { key: "purple", bg: "#ede9fe", ring: "#8b5cf6" },
];
const colorOf = (k: string) => COLORS.find((c) => c.key === k) ?? COLORS[0];

function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sticky_notes")
      .select("id, content, color, x, y, z_index")
      .eq("user_id", user.id)
      .order("z_index", { ascending: true });
    setNotes((data as Note[]) ?? []);
  };
  useEffect(() => {
    load();
  }, [user]);

  const nextZIndex = () => {
    const max = notes.reduce((m, n) => Math.max(m, n.z_index ?? 0), 0);
    return max + 1;
  };

  const addNote = async (color = "yellow") => {
    if (!user) return;
    const x = Math.floor(40 + Math.random() * 200);
    const y = Math.floor(40 + Math.random() * 200);
    const z_index = nextZIndex();
    const { data, error } = await supabase
      .from("sticky_notes")
      .insert({ user_id: user.id, content: "", color, x, y, z_index })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setNotes((p) => [...p, data as Note]);
  };

  const updateNote = async (id: string, patch: Partial<Note>) => {
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    await supabase.from("sticky_notes").update(patch).eq("id", id);
  };

  const deleteNote = async (id: string) => {
    setNotes((p) => p.filter((n) => n.id !== id));
    await supabase.from("sticky_notes").delete().eq("id", id);
  };

  /** 付箋を最前面に持ち上げる（z_indexをDBに保存） */
  const bringToFront = (note: Note) => {
    const z = nextZIndex();
    if (note.z_index === z - 1 && Math.max(0, ...notes.map((n) => n.z_index ?? 0)) === note.z_index) return;
    updateNote(note.id, { z_index: z });
  };

  const onDragStart = (e: React.PointerEvent, note: Note) => {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    bringToFront(note);
    // ポインタと付箋左上との相対オフセットを保持し、位置ずれを防ぐ
    const boardRect = boardRef.current?.getBoundingClientRect();
    const offsetX = e.clientX - (boardRect ? boardRect.left + note.x : note.x);
    const offsetY = e.clientY - (boardRect ? boardRect.top + note.y : note.y);
    let lastX = note.x;
    let lastY = note.y;
    const onMove = (ev: PointerEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      lastX = Math.max(0, ev.clientX - offsetX - (rect ? rect.left : 0));
      lastY = Math.max(0, ev.clientY - offsetY - (rect ? rect.top : 0));
      setNotes((p) => p.map((n) => (n.id === note.id ? { ...n, x: lastX, y: lastY } : n)));
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      supabase.from("sticky_notes").update({ x: lastX, y: lastY }).eq("id", note.id);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };

  const orderedNotes = [...notes].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <StickyIcon /> 付箋メモ
        </h1>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => addNote(c.key)}
              className="h-9 w-9 rounded-md border-2 hover:scale-105 transition"
              style={{ background: c.bg, borderColor: c.ring }}
              aria-label={`${c.key}の付箋を追加`}
            />
          ))}
          <Button onClick={() => addNote("yellow")} size="sm">
            <Plus className="h-4 w-4 mr-1" />追加
          </Button>
        </div>
      </div>
      <div
        ref={boardRef}
        className="relative bg-muted/40 border rounded-xl"
        style={{ minHeight: "70vh", overflow: "auto" }}
      >
        {notes.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            右上から色を選んで付箋を追加
          </p>
        )}
        {orderedNotes.map((n) => {
          const c = colorOf(n.color);
          return (
            <div
              key={n.id}
              className="absolute w-52 h-52 rounded-lg shadow-lg flex flex-col"
              onPointerDown={() => bringToFront(n)}
              style={{
                left: n.x,
                top: n.y,
                zIndex: n.z_index ?? 0,
                background: c.bg,
                border: `2px solid ${c.ring}`,
              }}
            >
              <div
                onPointerDown={(e) => onDragStart(e, n)}
                className="cursor-move px-2 py-1 flex items-center justify-between text-xs font-semibold"
                style={{ color: c.ring }}
              >
                <span>📌 ドラッグで移動</span>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }}
                  className="hover:opacity-70 p-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <textarea
                value={n.content}
                onChange={(e) => updateNote(n.id, { content: e.target.value })}
                onPointerDown={() => bringToFront(n)}
                placeholder="メモを入力..."
                className="flex-1 bg-transparent p-2 text-sm resize-none focus:outline-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
