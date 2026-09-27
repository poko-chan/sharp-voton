import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Clock, Lock, QrCode, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getChildControls,
  issueChildLoginCode,
  listChildFriends,
  revokeChildLoginCode,
  setChildControls,
} from "@/lib/parent.functions";

export { LOCKABLE_FEATURES } from "@/components/parent/lockable-features";
import { LOCKABLE_FEATURES } from "@/components/parent/lockable-features";


type Friend = { id: string; username: string | null; display_name: string | null };

export function ParentControls({ childId }: { childId: string }) {
  const [limit, setLimit] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [locked, setLocked] = useState<string[]>([]);
  const [homeworkFirst, setHomeworkFirst] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res: any = await getChildControls({ data: { childId } });
      const c = res?.controls;
      setLimit(c?.daily_limit_minutes != null ? String(c.daily_limit_minutes) : "");
      setFrom(c?.allowed_from?.slice(0, 5) ?? "");
      setTo(c?.allowed_to?.slice(0, 5) ?? "");
      setLocked(c?.locked_features ?? []);
      setHomeworkFirst(Boolean(c?.homework_first));
      setCode(res?.loginCode ?? null);
      setFriends(((await listChildFriends({ data: { childId } })) as any) ?? []);
    })();
  }, [childId]);

  useEffect(() => {
    if (!code) return setQr(null);
    const url = `${window.location.origin}/qr-login?c=${code}`;
    QRCode.toDataURL(url, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [code]);

  const save = async () => {
    setBusy(true);
    try {
      await setChildControls({
        data: {
          childId,
          daily_limit_minutes: limit.trim() === "" ? null : Number(limit),
          allowed_from: from || null,
          allowed_to: to || null,
          locked_features: locked,
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

  return (
    <div className="space-y-4">
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
          <Lock className="h-4 w-4" /> 使えなくする機能
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {LOCKABLE_FEATURES.map((f) => (
            <div key={f.key} className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm">{f.label}</span>
              <Switch checked={locked.includes(f.key)} onCheckedChange={() => toggle(f.key)} />
            </div>
          ))}
        </div>
      </Card>

      <Button onClick={save} disabled={busy}>
        利用制限を保存
      </Button>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <QrCode className="h-4 w-4" /> ログインカード（QRコード）
        </div>
        <p className="text-xs text-muted-foreground">
          お子様がカメラでQRを読み取るだけでログインできます。印刷して連絡帳などに貼ってください。
        </p>
        {qr ? (
          <div className="space-y-3">
            <img src={qr} alt="ログインQRコード" className="h-48 w-48 rounded-xl border bg-white p-2" />
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
