import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Video, LogIn, Lock, KeyRound, History, Plus, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { formatCode, rpcCreateMeeting, rpcJoinMeeting } from "@/lib/meeting-room";

type Search = { join?: string };

export const Route = createFileRoute("/_authenticated/meetings/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    join: typeof s.join === "string" ? s.join : undefined,
  }),
  head: () => ({
    meta: [
      { title: "会議 | Study#" },
      { name: "description", content: "コードで参加できるStudy#のビデオ会議。作成も参加もかんたん。" },
      { property: "og:title", content: "会議 | Study#" },
      { property: "og:description", content: "コードで参加できるStudy#のビデオ会議。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingsLobby,
});

function MeetingsLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [title, setTitle] = useState("");
  const [newPass, setNewPass] = useState("");
  const [muteOnEntry, setMuteOnEntry] = useState(false);
  const [withVideo, setWithVideo] = useState(true);
  const [code, setCode] = useState(search.join ? formatCode(search.join) : "");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  useEffect(() => {
    if (search.join) setCode(formatCode(search.join));
  }, [search.join]);

  const recent = useQuery({
    queryKey: ["meetings-recent", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("meeting_participants")
        .select("joined_at, meetings(id, code, title, status, host_id)")
        .eq("user_id", user!.id)
        .eq("kicked", false)
        .order("joined_at", { ascending: false })
        .limit(8);
      return (data ?? []).filter((r: any) => r.meetings) as Array<{
        joined_at: string;
        meetings: { id: string; code: string; title: string; status: string; host_id: string };
      }>;
    },
  });

  const enter = (c: string) => {
    sessionStorage.setItem("meeting.video", withVideo ? "1" : "0");
    navigate({ to: "/meetings/$code", params: { code: c } });
  };

  const create = async () => {
    setBusy("create");
    try {
      const m = await rpcCreateMeeting(title, newPass, muteOnEntry);
      toast.success(`会議を作成しました（${formatCode(m.code)}）`);
      enter(m.code);
    } catch (e: any) {
      toast.error(e.message ?? "作成できませんでした");
    } finally {
      setBusy(null);
    }
  };

  const join = async (c = code, p = pass) => {
    const digits = c.replace(/\D/g, "");
    if (digits.length !== 8) return toast.error("8桁の会議コードを入力してください");
    setBusy("join");
    try {
      const m = await rpcJoinMeeting(digits, p);
      enter(m.code);
    } catch (e: any) {
      toast.error(e.message ?? "参加できませんでした");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
          <Video className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">会議</h1>
          <p className="text-sm text-muted-foreground">
            会議コードで参加。映像と音声は参加者同士で直接つながります。
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4 text-primary" /> 新しい会議を開始
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">会議名</span>
            <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="例: 数学の質問会" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" /> パスコード（任意・4文字以上）
            </span>
            <Input value={newPass} maxLength={32} onChange={(e) => setNewPass(e.target.value)} placeholder="空欄ならパスコードなし" />
          </label>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <MicOff className="h-4 w-4 text-muted-foreground" /> 入室時に参加者をミュート
            </span>
            <Switch checked={muteOnEntry} onCheckedChange={setMuteOnEntry} />
          </div>
          <Button className="w-full" onClick={create} disabled={busy !== null}>
            {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
            会議を作成して開始
          </Button>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <LogIn className="h-4 w-4 text-primary" /> 会議に参加
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">会議コード</span>
            <Input
              value={code}
              inputMode="numeric"
              onChange={(e) => setCode(formatCode(e.target.value))}
              placeholder="1234-5678"
              className="text-center font-mono text-lg tracking-widest"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> パスコード（設定されている場合）
            </span>
            <Input
              value={pass}
              type="password"
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void join()}
            />
          </label>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" /> カメラをオンで入室
            </span>
            <Switch checked={withVideo} onCheckedChange={setWithVideo} />
          </div>
          <Button className="w-full" variant="secondary" onClick={() => void join()} disabled={busy !== null}>
            {busy === "join" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            参加する
          </Button>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <History className="h-4 w-4 text-primary" /> 最近の会議
        </div>
        {(recent.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ会議はありません。</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.data!.map((r) => (
              <li key={r.meetings.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.meetings.title}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {formatCode(r.meetings.code)} ・ {new Date(r.joined_at).toLocaleString("ja-JP")}
                    {r.meetings.host_id === user?.id ? " ・ 主催" : ""}
                  </div>
                </div>
                {r.meetings.status === "active" ? (
                  <Button size="sm" variant="outline" onClick={() => void join(r.meetings.code, "")}>
                    再入室
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">終了</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        学校や会社の一部のネットワークでは、直接接続が制限されてつながらない場合があります。その場合は別の回線（スマホのテザリング等）でお試しください。
      </p>
    </div>
  );
}
