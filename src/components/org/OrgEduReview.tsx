import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Brain } from "lucide-react";
import { aiStream } from "@/lib/ai-provider";
import { toast } from "sonner";

const SYSTEM =
  "あなたは中高生向けの家庭教師です。答えをただ教えるのではなく、つまずいた原因を推測し、考え方の手順、似た練習問題を1問、覚えるコツの順に、やさしい日本語で簡潔に説明してください。";

/** 組織内タブとしての AI 復習（Makron for education の誤答のみ） */
export function OrgEduReview({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [stream, setStream] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = async () => {
    if (!user) return;
    // 正解・解説は「自分が解答済みの誤答」だけをサーバー側で開示する RPC 経由で取得
    const { data } = await (supabase as any).rpc("org_edu_review_rows", { _org: orgId, _include_done: showDone });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [orgId, user?.id, showDone]);


  const explain = async (row: any) => {
    setBusy(row.id); setStream((s) => ({ ...s, [row.id]: "" }));
    try {
      const text = await aiStream(
        `次の問題を間違えました。\n【単元】${row.unit_title ?? ""}\n【問題】${row.body ?? ""}\n【正解】${row.answer ?? ""}\n【私の解答】${row.user_answer || "（無回答）"}\nどこで間違えたのか、どう考えれば解けるのかを教えてください。`,
        (partial) => setStream((s) => ({ ...s, [row.id]: partial })),
        SYSTEM,
      );
      setStream((s) => ({ ...s, [row.id]: text }));
      await (supabase as any).from("org_edu_attempts").update({ ai_review: text }).eq("id", row.id);
    } catch (e: any) {
      toast.error(e?.message ?? "AIを利用できませんでした");
    } finally { setBusy(null); }
  };

  const resolve = async (id: string) => {
    await (supabase as any).from("org_edu_attempts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <Card className="p-4 flex items-center gap-2 flex-wrap">
        <Brain className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-[200px]">
          <div className="font-bold text-sm">AI復習</div>
          <div className="text-[11px] text-muted-foreground">学校の教材で間違えた問題をAIが解説します（コイン・XPは付きません）。</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "未完了のみ表示" : "完了した分も表示"}
        </Button>
      </Card>

      {rows.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">復習待ちの問題はありません。</Card>}
      {rows.map((r, i) => {
        const text = stream[r.id] ?? r.ai_review;
        return (
          <Card key={r.id} className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground">
              #{i + 1} {r.unit_title} ・ {new Date(r.created_at).toLocaleDateString("ja-JP")}
              {r.resolved_at && " ・ 直し完了"}
            </div>
            <div className="text-sm"><b>Q:</b> {r.body}</div>
            <div className="text-sm text-destructive"><b>あなた:</b> {r.user_answer || "（無回答）"}</div>
            <div className="text-sm text-emerald-600"><b>正解:</b> {r.answer}</div>
            {r.explanation && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{r.explanation}</div>
            )}
            <div className="pt-1">
              {text
                ? <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm whitespace-pre-wrap">{text}{busy === r.id && <span className="animate-pulse">▍</span>}</div>
                : <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => explain(r)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />{busy === r.id ? "AIが考え中…" : "AIに解き方を聞く"}
                  </Button>}
            </div>
            {!r.resolved_at && (
              <Button size="sm" variant="ghost" onClick={() => resolve(r.id)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />直し完了
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
