import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { selfDeleteAccount } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SectionHeading } from "./shared";

export function DangerSection() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const del = useServerFn(selfDeleteAccount);
  const [confirmText, setConfirmText] = useState("");
  const [counts, setCounts] = useState<{ logs: number; goals: number; questions: number; plans: number; subjects: number; events: number; ai: number; tutor: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const tables = ["study_logs", "goals", "questions", "study_plans", "subjects", "events", "ai_chats", "tutor_messages"] as const;
      const results = await Promise.all(tables.map((t) =>
        supabase.from(t as any).select("id", { count: "exact", head: true }).eq("user_id", user.id)
      ));
      setCounts({
        logs: results[0].count ?? 0, goals: results[1].count ?? 0, questions: results[2].count ?? 0,
        plans: results[3].count ?? 0, subjects: results[4].count ?? 0, events: results[5].count ?? 0,
        ai: results[6].count ?? 0, tutor: results[7].count ?? 0,
      });
    })();
  }, [user]);

  const doDelete = async () => {
    if (confirmText !== "DELETE") { toast.error("確認のため DELETE と入力してください"); throw new Error("confirm"); }
    try {
      await del();
      toast.success("アカウントを削除しました");
      await signOut();
      navigate({ to: "/login" });
    } catch (e: any) {
      toast.error(e.message ?? "削除に失敗しました");
      throw e;
    }
  };

  if (!user) return null;
  const scope = counts ? [
    `プロフィール情報（${user.email}）`,
    `勉強記録 ${counts.logs} 件`,
    `学習目標 ${counts.goals} 件`,
    `学習計画 ${counts.plans} 件`,
    `教科 ${counts.subjects} 件`,
    `カレンダー予定 ${counts.events} 件`,
    `生成した問題 ${counts.questions} 件（および採点履歴すべて）`,
    `AIチャット ${counts.ai} 件 / AIチューターメッセージ ${counts.tutor} 件`,
    `アバター画像、通知設定、ログイン情報`,
  ] : ["全データを集計中..."];

  return (
    <div className="space-y-6">
      <SectionHeading title="危険な操作" desc="元に戻せない操作です。十分に注意して行ってください" />
      <Card className="p-6 space-y-3 border-destructive/30">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> アカウント削除
        </div>
        <p className="text-sm text-muted-foreground">
          アカウントを削除すると、以下のすべてのデータが完全に消去されます。元に戻せません。
        </p>
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-0.5">
          <div className="font-medium text-destructive mb-1">削除対象データ</div>
          <ul className="list-disc pl-5 text-muted-foreground">
            {scope.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">確認のため <code>DELETE</code> と入力</Label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="max-w-xs" />
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="destructive" disabled={confirmText !== "DELETE"}>
              アカウントを完全に削除する
            </Button>
          }
          title="本当にアカウントを削除しますか？"
          description="この操作は取り消せません。サーバーからすべての関連データが完全に消去されます。"
          scopeItems={scope}
          confirmLabel="完全に削除する"
          onConfirm={doDelete}
        />
      </Card>
    </div>
  );
}
