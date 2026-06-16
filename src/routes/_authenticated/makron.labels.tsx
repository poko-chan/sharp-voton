import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/makron/labels")({ component: LabelsPage });

function LabelsPage() {
  const { isAdmin } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [selSubj, setSelSubj] = useState<string | null>(null);
  const [newSubj, setNewSubj] = useState("");
  const [newField, setNewField] = useState("");

  const load = async () => {
    const { data: s } = await (supabase as any).from("makron_subjects").select("*").order("order_idx").order("name");
    setSubjects(s ?? []);
    const { data: f } = await (supabase as any).from("makron_fields").select("*").order("order_idx").order("name");
    setFields(f ?? []);
  };
  useEffect(() => { load(); }, []);

  if (!isAdmin) return (
    <MakronShell back="/makron" title="ラベル管理">
      <div className="p-6 text-sm text-muted-foreground">管理者のみアクセス可能です。<Link to="/makron" className="underline ml-2">戻る</Link></div>
    </MakronShell>
  );

  const addSubject = async () => {
    if (!newSubj.trim()) return;
    const { error } = await (supabase as any).from("makron_subjects").insert({ name: newSubj });
    if (error) return toast.error(error.message);
    setNewSubj(""); load();
  };
  const delSubject = async (id: string) => {
    if (!confirm("教科を削除すると関連分野も削除されます")) return;
    await (supabase as any).from("makron_subjects").delete().eq("id", id);
    if (selSubj === id) setSelSubj(null);
    load();
  };
  const addField = async () => {
    if (!newField.trim() || !selSubj) return;
    const { error } = await (supabase as any).from("makron_fields").insert({ name: newField, subject_id: selSubj });
    if (error) return toast.error(error.message);
    setNewField(""); load();
  };
  const delField = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await (supabase as any).from("makron_fields").delete().eq("id", id);
    load();
  };

  const subjFields = fields.filter((f) => f.subject_id === selSubj);

  return (
    <MakronShell back="/makron" title="ラベル管理" subtitle="教科 / 分野 / ユニット">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1"><Tags className="h-3 w-3" />教科に基づいて分野が決まり、分野に基づいてユニットが作られます</div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4 space-y-2">
            <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />教科</div>
            <div className="flex gap-1">
              <Input placeholder="例：数学" value={newSubj} onChange={(e) => setNewSubj(e.target.value)} />
              <Button onClick={addSubject}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1 max-h-96 overflow-auto">
              {subjects.map((s) => (
                <div key={s.id} className={`flex items-center gap-1 p-2 rounded cursor-pointer ${selSubj === s.id ? "bg-primary/10" : "hover:bg-accent"}`}
                  onClick={() => setSelSubj(s.id)}>
                  <span className="flex-1 truncate">{s.name}</span>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); delSubject(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {subjects.length === 0 && <div className="text-xs text-muted-foreground">教科がまだありません</div>}
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />分野 {selSubj && <span className="text-[10px] text-muted-foreground">（{subjects.find(s => s.id === selSubj)?.name}）</span>}</div>
            {!selSubj && <div className="text-xs text-muted-foreground">左から教科を選択してください</div>}
            {selSubj && (
              <>
                <div className="flex gap-1">
                  <Input placeholder="例：代数" value={newField} onChange={(e) => setNewField(e.target.value)} />
                  <Button onClick={addField}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-1 max-h-96 overflow-auto">
                  {subjFields.map((f) => (
                    <div key={f.id} className="flex items-center gap-1 p-2 rounded hover:bg-accent">
                      <span className="flex-1 truncate">{f.name}</span>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delField(f.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {subjFields.length === 0 && <div className="text-xs text-muted-foreground">この教科にはまだ分野がありません</div>}
                </div>
              </>
            )}
          </Card>
        </div>

        <Card className="p-4 text-sm">
          <div className="font-bold mb-2">ユニット（単元）</div>
          <div className="text-xs text-muted-foreground">単元の作成・削除はこれまで通り <Link to="/makron/admin" className="underline">問題管理画面</Link> から行えます。教科・分野は上で作成したものから選んで紐付けてください。</div>
        </Card>
      </div>
    </MakronShell>
  );
}