import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Link2, Unlink, BellRing, FileText, Moon, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionHeading } from "./shared";
import { useAuth } from "@/lib/auth-context";
import { getMyLineStatus, unlinkLine } from "@/lib/line.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_LINE_PREFS,
  getLinePreferences,
  saveLinePreferences,
  sendLineTestMessage,
  type LinePrefs,
} from "@/lib/line-prefs.functions";

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const TONES: Array<{ id: LinePrefs["reminder_tone"]; label: string }> = [
  { id: "gentle", label: "やさしい応援" },
  { id: "strict", label: "ストイック" },
  { id: "plain", label: "事務的" },
];

function Row({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function LineSection() {
  const { user, accountKind } = useAuth();
  const [linked, setLinked] = useState(false);
  const [prefs, setPrefs] = useState<LinePrefs>(DEFAULT_LINE_PREFS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const st = (await getMyLineStatus()) as any;
      setLinked(Boolean(st?.linked));
      setPrefs((await getLinePreferences()) as LinePrefs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "LINE設定を読み込めませんでした");
    }
    setLoading(false);
  }, []);

  const [suspended, setSuspended] = useState<boolean | null>(null);
  useEffect(() => {
    void (supabase.rpc as any)("line_is_suspended").then(({ data }: any) =>
      setSuspended(Boolean(data)),
    );
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const set = <K extends keyof LinePrefs>(key: K, value: LinePrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      await saveLinePreferences({ data: prefs });
      toast.success("保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存できませんでした");
    }
    setBusy(false);
  };

  if (loading || suspended === null)
    return <p className="text-sm text-muted-foreground">読み込み中…</p>;

  if (suspended)
    return (
      <div className="space-y-4">
        <SectionHeading title="LINE連携・通知" desc="LINEのトークに学習のお知らせを届けます" />
        <Card className="space-y-2 border-destructive/40 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <MessageCircle className="h-4 w-4 text-destructive" /> LINE機能は現在停止中です
          </div>
          <p className="text-sm text-muted-foreground">
            通知・リマインダーなどのLINE機能は一時的に停止しています。LINEでのログインはこれまで通り使えます。
          </p>
        </Card>
      </div>
    );

  return (
    <div className="space-y-4">
      <SectionHeading title="LINE連携・通知" desc="LINEのトークに学習のお知らせを届けます" />

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <MessageCircle className="h-4 w-4 text-[#06C755]" /> LINEとのつながり
        </div>
        {linked ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">連携済みです。</span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await sendLineTestMessage();
                  toast.success("テスト通知を送りました");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "送信できませんでした");
                }
              }}
            >
              <BellRing className="mr-1.5 h-4 w-4" /> テスト通知
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await unlinkLine();
                setLinked(false);
                toast.success("連携を解除しました");
              }}
            >
              <Unlink className="mr-1.5 h-4 w-4" /> 解除する
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              window.location.href = "/line-liff/login?mode=link";
            }}
          >
            <Link2 className="mr-1.5 h-4 w-4" /> LINEと連携する
          </Button>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <BellRing className="h-4 w-4" /> 学習リマインダー
        </div>
        <Row
          title="リマインダーを受け取る"
          desc="決めた時間に「そろそろ勉強しよう」とLINEに届きます"
          checked={prefs.reminder_enabled}
          onChange={(v) => set("reminder_enabled", v)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>平日の時刻</Label>
            <Input
              type="time"
              value={prefs.reminder_weekday_time}
              onChange={(e) => set("reminder_weekday_time", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>休日の時刻</Label>
            <Input
              type="time"
              value={prefs.reminder_weekend_time}
              onChange={(e) => set("reminder_weekend_time", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>送る曜日</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = prefs.reminder_days.includes(i);
              return (
                <button
                  key={d}
                  onClick={() =>
                    set(
                      "reminder_days",
                      on ? prefs.reminder_days.filter((x) => x !== i) : [...prefs.reminder_days, i],
                    )
                  }
                  className={`h-9 w-9 rounded-full border text-sm transition ${
                    on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>メッセージのトーン</Label>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={prefs.reminder_tone === t.id ? "default" : "outline"}
                onClick={() => set("reminder_tone", t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
        <Row
          title="宿題の24時間前に知らせる"
          checked={prefs.homework_alert_24h}
          onChange={(v) => set("homework_alert_24h", v)}
        />
        <Row
          title="宿題の3時間前に知らせる"
          checked={prefs.homework_alert_3h}
          onChange={(v) => set("homework_alert_3h", v)}
        />
        <Row
          title="テストまでのカウントダウンを入れる"
          desc="登録したテスト日までの残り日数をお知らせに添えます"
          checked={prefs.test_countdown_enabled}
          onChange={(v) => set("test_countdown_enabled", v)}
        />
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4" /> 学習レポート
        </div>
        <p className="text-xs text-muted-foreground">
          レポートの内容は「学習時間・教科ランキング・教材ランキング・連続ストリーク」の4つです。
        </p>
        <Row
          title="1日のまとめを受け取る"
          checked={prefs.daily_report_enabled}
          onChange={(v) => set("daily_report_enabled", v)}
        />
        <div className="space-y-1">
          <Label>まとめを送る時刻</Label>
          <Input
            type="time"
            value={prefs.daily_report_time}
            onChange={(e) => set("daily_report_time", e.target.value)}
          />
        </div>
        <Row
          title="1週間のまとめを受け取る（日曜の夜）"
          checked={prefs.weekly_report_enabled}
          onChange={(v) => set("weekly_report_enabled", v)}
        />
        <Row
          title="アプリのお知らせをLINEにも送る"
          desc="Study#のベルに届くお知らせを、LINEのトークにも転送します"
          checked={prefs.forward_app_notifications}
          onChange={(v) => set("forward_app_notifications", v)}
        />
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Moon className="h-4 w-4" /> おやすみモード
        </div>
        <Row
          title="夜間は通知を止める"
          checked={prefs.quiet_enabled}
          onChange={(v) => set("quiet_enabled", v)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>止める時間（開始）</Label>
            <Input
              type="time"
              value={prefs.quiet_from}
              onChange={(e) => set("quiet_from", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>止める時間（終了）</Label>
            <Input
              type="time"
              value={prefs.quiet_to}
              onChange={(e) => set("quiet_to", e.target.value)}
            />
          </div>
        </div>
      </Card>

      {accountKind === "parent" && (
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <MessageCircle className="h-4 w-4" /> 保護者向けのお知らせ
          </div>
          <Row
            title="お子様の学習おわりを知らせる"
            desc="学習時間と問題数だけを、かんたんなカードでお届けします"
            checked={prefs.parent_finish_report}
            onChange={(v) => set("parent_finish_report", v)}
          />
          <Row
            title="「もっと使いたい」のお願いを知らせる"
            checked={prefs.parent_extension_request}
            onChange={(v) => set("parent_extension_request", v)}
          />
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" /> 安全のお知らせ
        </div>
        <Row
          title="見慣れない端末からのログインを知らせる"
          checked={prefs.security_login_alert}
          onChange={(v) => set("security_login_alert", v)}
        />
      </Card>

      <Button onClick={save} disabled={busy}>
        LINE設定を保存
      </Button>
    </div>
  );
}

export default LineSection;
