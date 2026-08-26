import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Brain, Sparkles, CheckCircle2, GraduationCap } from "lucide-react";
import { aiStream } from "@/lib/ai-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mistakes")({ component: Mistakes });

const SYSTEM = "あなたは中高生向けの家庭教師です。答えをただ教えるのではなく、つまずいた原因を推測し、考え方の手順、似た練習問題を1問、覚えるコツの順に、やさしい日本語で簡潔に説明してください。";

function Mistakes() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [edu, setEdu] = useState<any[]>([]);
  const [stream, setStream] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const loadEdu = async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("org_edu_attempts")
      .select("*, org_edu_questions(body), org_edu_units(title)")
      .eq("user_id", user.id).eq("correct", false).is("resolved_at", null)
      .order("created_at", { ascending: false }).limit(100);
    const rows = (data ?? []) as any[];
    // 正解・解説はテーブルから直接読めないので、復習用 RPC で取得する
    const orgIds = Array.from(new Set(rows.map((r) => r.organization_id).filter(Boolean)));
    const keyMap = new Map<string, { answer: string; explanation: string | null }>();
    for (const org of orgIds) {
      const { data: rev } = await (supabase as any).rpc("org_edu_review_rows", { _org: org, _include_done: false });
      for (const r of ((rev ?? []) as any[])) keyMap.set(r.id, { answer: r.answer, explanation: r.explanation });
    }
    setEdu(rows.map((r) => ({
      ...r,
      org_edu_questions: {
        ...(r.org_edu_questions ?? {}),
        answer: keyMap.get(r.id)?.answer ?? "",
        explanation: keyMap.get(r.id)?.explanation ?? null,
      },
    })));
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: sess } = await supabase.from("makron_sessions").select("id").eq("user_id", user.id);
      const ids = (sess ?? []).map((s) => s.id);
      if (ids.length) {
        const { data } = await supabase.from("makron_answers")
          .select("*, makron_questions(prompt)").in("session_id", ids)
          .eq("is_correct", false).order("created_at", { ascending: false }).limit(100);
        const answerMap = new Map<string, string>();
        await Promise.all(ids.map(async (sessionId) => {
          const { data: revealed } = await (supabase as any).rpc("makron_reveal", { _session_id: sessionId });
          for (const item of revealed ?? []) {
            const answers = item.accepted_answers?.length
              ? item.accepted_answers
              : item.correct_options?.length
                ? item.correct_options
                : [item.model_answer].filter(Boolean);
            answerMap.set(item.question_id, item.correct_answer || answers.join(" / "));
          }
        }));
        setRows((data ?? []).map((row: any) => ({
          ...row,
          makron_questions: {
            ...(row.makron_questions ?? {}),
            answer: answerMap.get(row.question_id) ?? "",
          },
        })));
      }
      loadEdu();
    })();
  }, [user?.id]);

  const explain = async (row: any, q: string, a: string, mine: string) => {
    setBusy(row.id); setStream((s) => ({ ...s, [row.id]: "" }));
    try {
      const text = await aiStream(
        `次の問題を間違えました。\n【問題】${q}\n【正解】${a}\n【私の解答】${mine || "（無回答）"}\nどこで間違えたのか、どう考えれば解けるのかを教えてください。`,
        (partial) => setStream((s) => ({ ...s, [row.id]: partial })),
        SYSTEM,
      );
      setStream((s) => ({ ...s, [row.id]: text }));
      if (row.question_id) await (supabase as any).from("org_edu_attempts").update({ ai_review: text }).eq("id", row.id);
    } catch (e: any) {
      toast.error(e?.message ?? "AIを利用できませんでした");
    } finally { setBusy(null); }
  };

  const resolve = async (id: string) => {
    await (supabase as any).from("org_edu_attempts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    loadEdu();
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Brain className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">間違い直しノート</h1></div>
        <Button onClick={() => window.print()}>印刷 / PDF</Button>
      </div>

      <Tabs defaultValue="makron">
        <TabsList>
          <TabsTrigger value="makron">Makron ({rows.length})</TabsTrigger>
          <TabsTrigger value="edu"><GraduationCap className="h-3.5 w-3.5 mr-1" />学校の教材 ({edu.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="makron" className="space-y-3 pt-3">
          {rows.length === 0 && <Card className="p-6 text-sm text-muted-foreground">まだ誤答はありません。</Card>}
          {rows.map((r, i) => (
            <Card key={r.id} className="p-4 space-y-1">
              <div className="text-xs text-muted-foreground">#{i + 1} {new Date(r.created_at).toLocaleDateString("ja-JP")}</div>
              <div className="text-sm"><b>Q:</b> {r.makron_questions?.prompt}</div>
              <div className="text-sm text-red-500"><b>あなた:</b> {r.answer}</div>
              <div className="text-sm text-green-600"><b>正解:</b> {r.makron_questions?.answer}</div>
              <AiBlock row={r} text={stream[r.id]} busy={busy === r.id}
                onRun={() => explain(r, r.makron_questions?.prompt ?? "", r.makron_questions?.answer ?? "", r.answer ?? "")} />
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="edu" className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">
            学校・塾の教材（Makron for education）で間違えた問題です。ポイントは付きませんが、AIが解き方を解説します。
          </p>
          {edu.length === 0 && <Card className="p-6 text-sm text-muted-foreground">復習待ちの問題はありません。</Card>}
          {edu.map((r, i) => (
            <Card key={r.id} className="p-4 space-y-1">
              <div className="text-xs text-muted-foreground">#{i + 1} {r.org_edu_units?.title} ・ {new Date(r.created_at).toLocaleDateString("ja-JP")}</div>
              <div className="text-sm"><b>Q:</b> {r.org_edu_questions?.body}</div>
              <div className="text-sm text-red-500"><b>あなた:</b> {r.user_answer}</div>
              <div className="text-sm text-green-600"><b>正解:</b> {r.org_edu_questions?.answer}</div>
              {r.org_edu_questions?.explanation && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{r.org_edu_questions.explanation}</div>}
              <AiBlock row={r} text={stream[r.id] ?? r.ai_review} busy={busy === r.id}
                onRun={() => explain(r, r.org_edu_questions?.body ?? "", r.org_edu_questions?.answer ?? "", r.user_answer ?? "")} />
              <Button size="sm" variant="ghost" onClick={() => resolve(r.id)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />直し完了
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AiBlock({ text, busy, onRun }: { row: any; text?: string; busy: boolean; onRun: () => void }) {
  return (
    <div className="pt-1">
      {text
        ? <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm whitespace-pre-wrap">{text}{busy && <span className="animate-pulse">▍</span>}</div>
        : <Button size="sm" variant="outline" disabled={busy} onClick={onRun}>
            <Sparkles className="h-3.5 w-3.5 mr-1" />{busy ? "AIが考え中…" : "AIに解き方を聞く"}
          </Button>}
    </div>
  );
}
