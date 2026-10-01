import { useCallback, useEffect, useState } from "react";
import { Heart, Send, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getMyParentPanel,
  requestTimeExtension,
  sendMessageToParent,
} from "@/lib/parent.functions";
import { onParentPanelOpen, type ParentPanelTab } from "@/lib/parent-panel";

type Msg = {
  id: string;
  sender_role: "parent" | "child";
  kind: string;
  body: string;
  created_at: string;
};
type Req = {
  id: string;
  minutes: number;
  reason: string | null;
  status: string;
  granted_minutes: number | null;
  created_at: string;
};

const STICKERS = [
  "勉強はじめるよ！",
  "今日のノルマ終わったよ！",
  "がんばってる！",
  "ちょっと休けいするね",
  "ありがとう",
  "見てほしい！",
];

const REASONS = [
  "キリが良いところまで解きたい",
  "宿題がまだ終わっていない",
  "明日テストがある",
  "もう少しだけ続けたい",
];

export function ParentBarButton({ compact = false }: { compact?: boolean }) {
  const { user, accountKind } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ParentPanelTab>("message");
  const [linked, setLinked] = useState(false);
  const [parentName, setParentName] = useState<string>("おうちの人");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [text, setText] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = (await getMyParentPanel()) as any;
      setLinked(Boolean(res?.linked));
      if (res?.linked) {
        setParentName(res.parent?.display_name ?? res.parent?.username ?? "おうちの人");
        setMessages(res.messages ?? []);
        setRequests(res.requests ?? []);
      }
    } catch {
      setLinked(false);
    }
  }, []);

  useEffect(() => {
    if (!user || accountKind === "parent") return;
    void load();
  }, [user, accountKind, load]);

  useEffect(() =>
    onParentPanelOpen((t) => {
      setTab(t);
      setOpen(true);
      void load();
    }),
  [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!user || accountKind === "parent" || !linked) return null;

  const unread = messages.filter((m) => m.sender_role === "parent").slice(-1)[0];

  const send = async (body: string, kind: "text" | "sticker") => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await sendMessageToParent({ data: { body: body.trim(), kind } });
      setText("");
      toast.success("おうちの人に送りました");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送れませんでした");
    }
    setBusy(false);
  };

  const ask = async () => {
    setBusy(true);
    try {
      await requestTimeExtension({ data: { minutes, reason, scope: "all" } });
      toast.success("おうちの人にお願いを送りました");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送れませんでした");
    }
    setBusy(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="おうちの人"
        aria-label="おうちの人"
        className={
          compact
            ? "relative inline-flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-accent"
            : "relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition hover:bg-accent"
        }
      >
        <Heart className="h-4 w-4 text-pink-500" />
        {!compact && <span className="hidden lg:inline">おうちの人</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{parentName}とやりとり</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as ParentPanelTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="message">メッセージ</TabsTrigger>
              <TabsTrigger value="extend">もっと使いたい</TabsTrigger>
              <TabsTrigger value="missions">ミッション</TabsTrigger>
            </TabsList>

            <TabsContent value="missions" className="pt-3">
              <MyMissions />
            </TabsContent>

            <TabsContent value="message" className="space-y-3 pt-3">
              {unread && (
                <div className="rounded-xl border bg-pink-500/5 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">{parentName}より</div>
                  {unread.body}
                </div>
              )}
              <div className="max-h-48 space-y-1.5 overflow-auto rounded-xl border p-2">
                {messages.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">まだやりとりはありません。</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                        m.sender_role === "child"
                          ? "ml-auto bg-primary/10"
                          : "mr-auto bg-muted"
                      }`}
                    >
                      {m.body}
                    </div>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STICKERS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => send(s, "sticker")}
                  >
                    {s}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="ひとこと送る"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send(text, "text");
                  }}
                />
                <Button disabled={busy} onClick={() => send(text, "text")}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="extend" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">
                おうちの人に「もう少し使いたい」とお願いできます。
              </p>
              <div className="flex gap-2">
                {[15, 30, 60].map((m) => (
                  <Button
                    key={m}
                    variant={minutes === m ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setMinutes(m)}
                  >
                    {m}分
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      reason === r ? "border-primary bg-primary/5" : "hover:bg-accent"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Button className="w-full" disabled={busy} onClick={ask}>
                <Clock className="mr-1.5 h-4 w-4" />
                お願いを送る
              </Button>
              {requests.length > 0 && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {requests.slice(0, 3).map((r) => (
                    <div key={r.id}>
                      {r.minutes}分のお願い →{" "}
                      {r.status === "pending"
                        ? "返事まち"
                        : r.status === "approved"
                          ? `OK（${r.granted_minutes}分）`
                          : "今回はダメでした"}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ParentBarButton;

function MyMissions() {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const { listMyMissions } = await import("@/lib/parent.functions");
      setRows((await listMyMissions()) as any[]);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const claim = async (id: string) => {
    const { claimMyMission } = await import("@/lib/parent.functions");
    await claimMyMission({ data: { missionId: id } });
    toast.success("できた！を報告したよ");
    void load();
  };

  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">いまはミッションがありません。</p>;

  return (
    <div className="max-h-72 space-y-2 overflow-auto">
      {rows.map((m) => (
        <div key={m.id} className="rounded-xl border p-3">
          <div className="text-sm font-medium">{m.title}</div>
          {m.detail && <div className="text-xs text-muted-foreground">{m.detail}</div>}
          <div className="mt-1 text-[11px] text-muted-foreground">
            {m.reward_text ? `ごほうび：${m.reward_text}` : "ごほうびはおうちの人と相談"}
            {m.due_date ? ` · ${m.due_date}まで` : ""}
          </div>
          {m.status === "open" && (
            <Button size="sm" className="mt-2" onClick={() => claim(m.id)}>
              できたよ
            </Button>
          )}
          {m.status === "claimed" && (
            <div className="mt-2 text-xs text-muted-foreground">おうちの人の返事まち</div>
          )}
          {m.status === "done" && (
            <div className="mt-2 text-xs text-primary">できた！ごほうびを待ってね</div>
          )}
          {m.status === "rewarded" && (
            <div className="mt-2 text-xs text-muted-foreground">約束おわり。よくがんばったね</div>
          )}
        </div>
      ))}
    </div>
  );
}
