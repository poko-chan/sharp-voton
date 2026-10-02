import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Clock, Lock, QrCode, Users, Heart, Timer } from "lucide-react";
import { toast } from "sonner";
import {
  decideExtensionRequest,
  getChildControls,
  getParentThread,
  grantBonusMinutes,
  issueChildLoginCode,
  listChildFriends,
  revokeChildLoginCode,
  sendCheerToChild,
  setChildControls,
} from "@/lib/parent.functions";
import { LOCKABLE_FEATURES } from "@/components/parent/lockable-features";

export { LOCKABLE_FEATURES } from "@/components/parent/lockable-features";

type Friend = { id: string; username: string | null; display_name: string | null };
type Msg = { id: string; sender_role: string; body: string; created_at: string };
type Req = {
  id: string;
  minutes: number;
  reason: string | null;
  status: string;
  granted_minutes: number | null;
  created_at: string;
};

const CHEERS = ["おつかれさま！", "すごいね！", "よく頑張った！", "その調子！", "あとで話そうね"];

export function ParentControls({ childId }: { childId: string }) {
  const [limit, setLimit] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [locked, setLocked] = useState<string[]>([]);
  const [always, setAlways] = useState<string[]>([]);
  const [appLimits, setAppLimits] = useState<Record<string, string>>({});
  const [homeworkFirst, setHomeworkFirst] = useState(false);
  const [bonus, setBonus] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [cheer, setCheer] = useState("");
  const [busy, setBusy] = useState(false);

  const loadThread = useCallback(async () => {
    const t = (await getParentThread({ data: { childId } })) as any;
    setMessages(t?.messages ?? []);
    setRequests(t?.requests ?? []);
  }, [childId]);

  const loadControls = useCallback(async () => {
    const res: any = await getChildControls({ data: { childId } });
    const c = res?.controls;
    setLimit(c?.daily_limit_minutes != null ? String(c.daily_limit_minutes) : "");
    setFrom(c?.allowed_from?.slice(0, 5) ?? "");
    setTo(c?.allowed_to?.slice(0, 5) ?? "");
    setLocked(c?.locked_features ?? []);
    setAlways(c?.always_allowed_features ?? []);
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    setBonus(c?.bonus_date === today ? Number(c?.bonus_minutes ?? 0) : 0);
    const raw = (c?.app_time_limits ?? {}) as Record<string, number>;
    setAppLimits(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)])));
    setHomeworkFirst(Boolean(c?.homework_first));
    setCode(res?.loginCode ?? null);
  }, [childId]);

  useEffect(() => {
    (async () => {
      await loadControls();
      setFriends(((await listChildFriends({ data: { childId } })) as any) ?? []);
      await loadThread();
    })();
  }, [childId, loadControls, loadThread]);

  useEffect(() => {
    if (!code) return setQr(null);
    const url = `${window.location.origin}/qr-login?c=${code}`;
    QRCode.toDataURL(url, { width: 320, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  const save = async () => {
    setBusy(true);
    try {
      const parsedLimits: Record<string, number> = {};
      for (const [k, v] of Object.entries(appLimits)) {
        const n = Number(v);
        if (v !== "" && Number.isFinite(n) && n > 0) parsedLimits[k] = n;
      }
      await setChildControls({
        data: {
          childId,
          daily_limit_minutes: limit.trim() === "" ? null : Number(limit),
          allowed_from: from || null,
          allowed_to: to || null,
          locked_features: locked,
          always_allowed_features: always,
          app_time_limits: parsedLimits,
          homework_first: homeworkFirst,
        },
      });
      toast.success("保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    }
    setBusy(false);
  };

  const toggle = (key: string) =>
    setLocked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleAlways = (key: string) =>
    setAlways((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Card className="space-y-3 border-primary/40 bg-primary/5 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Timer className="h-4 w-4" /> 「もっと使いたい」のお願い
          </div>
          {pending.map((r) => (
            <div key={r.id} className="space-y-2 rounded-xl border bg-background p-3">
              <div className="text-sm font-medium">あと {r.minutes} 分つかいたい</div>
              {r.reason && <div className="text-xs text-muted-foreground">理由：{r.reason}</div>}
              <div className="flex flex-wrap gap-2">
                {[15, 30, r.minutes].map((m, i) => (
                  <Button
                    key={`${m}-${i}`}
                    size="sm"
                    onClick={async () => {
                      await decideExtensionRequest({
                        data: { requestId: r.id, approve: true, minutes: m },
                      });
                      toast.success(`${m}分ふやしました`);
                      await Promise.all([loadThread(), loadControls()]);
                    }}
                  >
                    {m}分ゆるす
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await decideExtensionRequest({ data: { requestId: r.id, approve: false } });
                    await loadThread();
                  }}
                >
                  今はダメ
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4" /> 使える時間
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>1日の上限（分・空欄で無制限）</Label>
            <Input
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="90"
            />
          </div>
          <div className="space-y-1">
            <Label>使える時間帯（開始）</Label>
            <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>使える時間帯（終了）</Label>
            <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
          <div className="mr-auto text-sm">
            今日の追加時間：<span className="font-semibold">{bonus}分</span>
          </div>
          {[15, 30, 60].map((m) => (
            <Button
              key={m}
              size="sm"
              variant="outline"
              onClick={async () => {
                const res: any = await grantBonusMinutes({ data: { childId, minutes: m } });
                setBonus(res?.bonus ?? bonus + m);
                toast.success(`${m}分ふやしました`);
              }}
            >
              +{m}分
            </Button>
          ))}
          {bonus > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await grantBonusMinutes({ data: { childId, minutes: -bonus } });
                setBonus(0);
              }}
            >
              取り消す
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <div>
            <div className="text-sm font-medium">勉強を優先する</div>
            <div className="text-xs text-muted-foreground">
              今日の勉強を始めるまで、遊びの機能を開けなくします
            </div>
          </div>
          <Switch checked={homeworkFirst} onCheckedChange={setHomeworkFirst} />
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4" /> アプリごとの設定
        </div>
        <p className="text-xs text-muted-foreground">
          「ロック」は完全に使えなくします。「時間切れでも使える」にすると、1日の上限に達したあともそのアプリだけ使えます。分数を入れると、そのアプリだけ1日◯分までにできます。
        </p>
        <div className="space-y-2">
          {LOCKABLE_FEATURES.map((f) => (
            <div
              key={f.key}
              className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
            >
              <span className="mr-auto font-medium">{f.label}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                ロック
                <Switch checked={locked.includes(f.key)} onCheckedChange={() => toggle(f.key)} />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                時間切れでも使える
                <Switch
                  checked={always.includes(f.key)}
                  onCheckedChange={() => toggleAlways(f.key)}
                />
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  className="h-8 w-20"
                  inputMode="numeric"
                  placeholder="分"
                  value={appLimits[f.key] ?? ""}
                  onChange={(e) =>
                    setAppLimits((p) => ({
                      ...p,
                      [f.key]: e.target.value.replace(/[^0-9]/g, ""),
                    }))
                  }
                />
                <span className="text-xs text-muted-foreground">分/日</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Button onClick={save} disabled={busy}>
        利用制限を保存
      </Button>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Heart className="h-4 w-4 text-pink-500" /> 応援メッセージ
        </div>
        <div className="max-h-40 space-y-1.5 overflow-auto rounded-xl border p-2">
          {messages.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">まだやりとりはありません。</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                  m.sender_role === "parent" ? "ml-auto bg-primary/10" : "mr-auto bg-muted"
                }`}
              >
                {m.body}
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CHEERS.map((c) => (
            <Button
              key={c}
              size="sm"
              variant="outline"
              onClick={async () => {
                await sendCheerToChild({ data: { childId, body: c, kind: "sticker" } });
                toast.success("送りました");
                await loadThread();
              }}
            >
              {c}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={cheer}
            onChange={(e) => setCheer(e.target.value)}
            placeholder="ひとこと送る"
          />
          <Button
            onClick={async () => {
              if (!cheer.trim()) return;
              await sendCheerToChild({ data: { childId, body: cheer.trim(), kind: "text" } });
              setCheer("");
              await loadThread();
            }}
          >
            送る
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <QrCode className="h-4 w-4" /> ログインカード（QRコード）
        </div>
        <p className="text-xs text-muted-foreground">
          お子様がカメラでQRを読み取るだけでログインできます。印刷して連絡帳などに貼ってください。
        </p>
        {qr ? (
          <div className="space-y-3">
            <img
              src={qr}
              alt="ログインQRコード"
              className="h-48 w-48 rounded-xl border bg-white p-2"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                印刷する
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { code: c } = (await issueChildLoginCode({ data: { childId } })) as any;
                  setCode(c);
                  toast.success("新しいQRを発行しました（前のQRは使えなくなります）");
                }}
              >
                作り直す
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await revokeChildLoginCode({ data: { childId } });
                  setCode(null);
                  toast.success("ログインカードを無効にしました");
                }}
              >
                無効にする
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={async () => {
              const { code: c } = (await issueChildLoginCode({ data: { childId } })) as any;
              setCode(c);
            }}
          >
            ログインQRを発行する
          </Button>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" /> つながっているフレンド（{friends.length}人）
        </div>
        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだフレンドはいません。</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {friends.map((f) => (
              <div key={f.id} className="rounded-xl border p-3 text-sm">
                <div className="font-medium">{f.display_name ?? f.username}</div>
                <div className="text-xs text-muted-foreground">@{f.username}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default ParentControls;
