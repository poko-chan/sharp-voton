import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Book, Star, X } from "lucide-react";

interface Material {
  id: string; title: string; publisher: string | null;
  cover_url?: string | null; subject?: string | null;
}

export function MaterialPicker({
  value,
  onChange,
  placeholder = "教材を選択（複数可）",
  disabled,
  variant = "compact",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: "compact" | "large";
}) {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("materials")
        .select("id,title,publisher,cover_url,subject")
        .eq("status", "approved")
        .order("title")
        .limit(500);
      setMaterials(data ?? []);
      const { data: f } = await (supabase as any)
        .from("material_favorites").select("material_id").eq("user_id", user.id);
      setFavIds(new Set((f ?? []).map((r: any) => r.material_id)));
    })();
  }, [user]);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const selected = materials.filter((m) => value.includes(m.id));
  const filtered = materials.filter((m) =>
    !q ? true : (m.title + " " + (m.publisher ?? "")).toLowerCase().includes(q.toLowerCase()),
  );

  const sortByFav = (list: Material[]) =>
    [...list].sort((a, b) => Number(favIds.has(b.id)) - Number(favIds.has(a.id)));
  const favOnly = useMemo(() => sortByFav(filtered.filter((m) => favIds.has(m.id))), [filtered, favIds]);
  const allSorted = useMemo(() => sortByFav(filtered), [filtered, favIds]);

  if (variant === "large") {
    return (
      <div className="space-y-2">
        <Button variant="outline" type="button" className="w-full justify-start" disabled={disabled} onClick={() => setOpen(true)}>
          <Book className="h-4 w-4 mr-2" />
          {value.length > 0 ? `${value.length}件の教材` : placeholder}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Book className="h-4 w-4" />教材を選択</DialogTitle></DialogHeader>
            <Input placeholder="タイトル/出版社で検索" value={q} onChange={(e) => setQ(e.target.value)} />
            <Tabs defaultValue={favOnly.length > 0 ? "fav" : "all"} className="flex-1 flex flex-col min-h-0">
              <TabsList>
                <TabsTrigger value="fav"><Star className="h-3 w-3 mr-1" />お気に入り ({favOnly.length})</TabsTrigger>
                <TabsTrigger value="all">すべて ({allSorted.length})</TabsTrigger>
                <TabsTrigger value="selected">選択中 ({value.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="fav" className="flex-1 overflow-auto"><Grid items={favOnly} value={value} toggle={toggle} favIds={favIds} /></TabsContent>
              <TabsContent value="all" className="flex-1 overflow-auto"><Grid items={allSorted} value={value} toggle={toggle} favIds={favIds} /></TabsContent>
              <TabsContent value="selected" className="flex-1 overflow-auto"><Grid items={selected} value={value} toggle={toggle} favIds={favIds} /></TabsContent>
            </Tabs>
            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-muted-foreground">{value.length} 件選択中</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onChange([])}>クリア</Button>
                <Button onClick={() => setOpen(false)}>決定</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selected.map((m) => (
              <Badge key={m.id} variant="secondary" className="gap-1">
                {m.title}
                <button type="button" onClick={() => toggle(m.id)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" type="button" className="w-full justify-start" disabled={disabled}>
            <Book className="h-4 w-4 mr-2" />
            {value.length > 0 ? `${value.length}件の教材` : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="start">
          <Input placeholder="検索..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                教材がありません。<a href="/materials" className="underline">追加</a>
              </p>
            )}
            {filtered.map((m) => (
              <label key={m.id} className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                <Checkbox checked={value.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                <div className="text-sm">
                  <div>{m.title}</div>
                  {m.publisher && <div className="text-xs text-muted-foreground">{m.publisher}</div>}
                </div>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((m) => (
            <Badge key={m.id} variant="secondary" className="gap-1">
              {m.title}
              <button type="button" onClick={() => toggle(m.id)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Grid({ items, value, toggle, favIds }: { items: Material[]; value: string[]; toggle: (id: string) => void; favIds: Set<string> }) {
  if (items.length === 0) {
    return <div className="p-6 text-sm text-center text-muted-foreground">教材がありません。<a href="/materials" className="underline">追加</a>から登録できます。</div>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-1">
      {items.map((m) => {
        const on = value.includes(m.id);
        return (
          <button key={m.id} type="button" onClick={() => toggle(m.id)}
            className={`text-left rounded-lg border p-2 hover:bg-accent flex gap-2 transition ${on ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}>
            {m.cover_url
              ? <img src={m.cover_url} alt="" className="w-12 h-16 rounded object-cover shrink-0" />
              : <div className="w-12 h-16 rounded bg-muted text-[10px] text-muted-foreground flex items-center justify-center shrink-0">No img</div>}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold line-clamp-2 flex items-start gap-1">
                {favIds.has(m.id) && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0 mt-0.5" />}
                <span className="flex-1">{m.title}</span>
              </div>
              {m.subject && <div className="text-[10px] text-muted-foreground mt-0.5">{m.subject}</div>}
              {m.publisher && <div className="text-[10px] text-muted-foreground truncate">{m.publisher}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
