import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Clock, Send } from "lucide-react";

export type Draft = { body: string; minutes: string; subject: string; org: string; visibility: "public" | "followers" | "private" };

export function PostComposer({
  draft, setDraft, recentLogs, orgs, busy, onSubmit,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  recentLogs: any[];
  orgs: any[];
  busy: boolean;
  onSubmit: () => void;
}) {
  const useLog = (l: any) => {
    setDraft({
      ...draft,
      minutes: String(l.duration_minutes ?? ""),
      subject: l.subjectName || draft.subject,
      body: draft.body.trim()
        ? draft.body
        : `${l.subjectName ? l.subjectName + "を" : ""}${l.duration_minutes}分やりました！${l.content ? "\n" + l.content : ""}`,
    });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="font-bold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" />勉強をシェア！</div>
      {recentLogs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">直近の勉強記録から選ぶ</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentLogs.map((l) => (
              <button key={l.id} type="button" onClick={() => useLog(l)}
                className="shrink-0 rounded-lg border px-3 py-1.5 text-left text-xs hover:bg-accent transition">
                <div className="font-medium">{l.subjectName || "勉強"}・{l.duration_minutes}分</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{l.date}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      <Textarea rows={3} placeholder="今日の勉強を共有しよう！" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
      <div className="flex flex-wrap gap-2">
        <Input className="w-24" type="number" placeholder="分" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} />
        <Input className="w-32" placeholder="教科（任意）" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        <Select value={draft.org} onValueChange={(v) => setDraft({ ...draft, org: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">組織限定なし</SelectItem>
            {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name} 限定</SelectItem>)}
          </SelectContent>
        </Select>
        {draft.org === "none" && (
          <Select value={draft.visibility} onValueChange={(v: any) => setDraft({ ...draft, visibility: v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">全体に公開</SelectItem>
              <SelectItem value="followers">フォロワー限定</SelectItem>
              <SelectItem value="private">自分のみ</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button className="ml-auto" onClick={onSubmit} disabled={busy || !draft.body.trim()}><Send className="h-4 w-4 mr-1" />投稿</Button>
      </div>
    </Card>
  );
}
