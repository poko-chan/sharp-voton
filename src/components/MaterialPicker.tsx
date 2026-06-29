import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Book, X } from "lucide-react";

interface Material { id: string; title: string; publisher: string | null; }

export function MaterialPicker({
  value,
  onChange,
  placeholder = "教材を選択（複数可）",
  disabled,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("materials")
        .select("id,title,publisher")
        .eq("status", "approved")
        .order("title")
        .limit(500);
      setMaterials(data ?? []);
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
