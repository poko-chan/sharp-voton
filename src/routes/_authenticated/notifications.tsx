import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listNotifications, markNotificationRead, deleteNotification } from "@/lib/notifications.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const list = useServerFn(listNotifications);
  const mark = useServerFn(markNotificationRead);
  const del = useServerFn(deleteNotification);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const markM = useMutation({
    mutationFn: (vars: { id?: string; all?: boolean }) => mark({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
    },
  });
  const delM = useMutation({
    mutationFn: (vars: { id?: string; ids?: string[]; all?: boolean }) => del({ data: vars }),
    onSuccess: () => {
      toast.success("削除しました");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
    },
  });

  const allSelected = useMemo(() => items.length > 0 && selected.size === items.length, [items, selected]);
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((n: any) => n.id)));
  };
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Bell className="h-7 w-7 text-primary" />通知</h1>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => markM.mutate({ all: true })}>
            <CheckCheck className="h-3 w-3 mr-1" />すべて既読
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={items.length === 0}
            onClick={() => {
              if (confirm("すべての通知を削除しますか?")) delM.mutate({ all: true });
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" />すべて削除
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <Card className="p-3 bg-card/60 backdrop-blur-md flex items-center gap-3">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="すべて選択" />
          <span className="text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} 件選択中` : "選択して一括操作"}
          </span>
          <Button
            size="sm"
            variant="destructive"
            disabled={selected.size === 0}
            className="ml-auto"
            onClick={() => delM.mutate({ ids: Array.from(selected) })}
          >
            <Trash2 className="h-3 w-3 mr-1" />選択を削除
          </Button>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">読み込み中…</p>}
      {!isLoading && items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">通知はありません</Card>
      )}

      <div className="space-y-2">
        {items.map((n: any) => (
          <Card key={n.id} className={`p-4 transition ${n.read_at ? "opacity-70" : "border-primary/30"} ${selected.has(n.id) ? "ring-2 ring-primary/40" : ""}`}>
            <div className="flex justify-between items-start gap-3">
              <Checkbox checked={selected.has(n.id)} onCheckedChange={() => toggle(n.id)} className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ja-JP")}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {!n.read_at && (
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => markM.mutate({ id: n.id })}>既読</Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => delM.mutate({ id: n.id })}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
