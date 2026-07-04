import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ocrLocal } from "@/lib/ocr-local";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScanLine, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ocr")({ component: OcrPage });

function OcrPage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("ocr_notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setNotes(data ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const onFile = async (f: File) => {
    if (!f) return;
    setLoading(true); setProgress(0);
    try {
      const r = await ocrLocal(f, { onProgress: (_s, p) => setProgress(Math.round(p * 100)) });
      setText(r.text);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const save = async () => {
    if (!user || !text.trim()) return;
    await supabase.from("ocr_notes").insert({ user_id: user.id, text, title: text.slice(0, 40) });
    setText(""); load(); toast.success("保存しました");
  };
  const del = async (id: string) => { await supabase.from("ocr_notes").delete().eq("id", id); load(); };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2"><ScanLine className="h-7 w-7" /><h1 className="text-3xl font-bold">ノートOCR</h1></div>
      <Card className="p-4 space-y-3">
        <input type="file" accept="image/*" capture="environment" className="hidden" id="ocr-file"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <Button className="w-full" disabled={loading} onClick={() => document.getElementById("ocr-file")?.click()}>
          <Upload className="h-4 w-4 mr-1" />{loading ? `読み取り中... ${progress}%` : "画像を選択 / 撮影（オフライン処理）"}
        </Button>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="抽出されたテキストがここに表示されます（編集可）" rows={8} />
        <Button onClick={save} disabled={!text.trim()}>保存</Button>
      </Card>
      <div className="space-y-2">
        {notes.map((n) => (
          <Card key={n.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("ja-JP")}</div>
              <Button size="sm" variant="ghost" onClick={() => del(n.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
            <pre className="whitespace-pre-wrap text-sm mt-1">{n.text}</pre>
          </Card>
        ))}
      </div>
    </div>
  );
}