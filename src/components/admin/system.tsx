import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminUpdateMaintenance } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Coins } from "lucide-react";
import { toast } from "sonner";

export function CoinGrantAllTab() {
  const [amount, setAmount] = useState<number>(100);
  const [reason, setReason] = useState<string>("管理者からのプレゼント");
  const [busy, setBusy] = useState(false);
  const grant = async () => {
    if (!confirm(`全ユーザーに ${amount} コインを配布します。よろしいですか？`)) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("admin_grant_coins_to_all", { _amount: amount, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} 人に配布しました`);
  };
  return (
    <Card className="p-6 max-w-xl space-y-3">
      <div className="flex items-center gap-2 font-bold"><Coins className="h-5 w-5 text-amber-500" />全ユーザーへコイン一括配布</div>
      <div className="text-xs text-muted-foreground">保護者アカウント以外のすべてのユーザーに、同じ金額を一度に付与します。</div>
      <div>
        <Label>金額（負数で回収も可）</Label>
        <Input type="number" value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} />
      </div>
      <div>
        <Label>理由・メッセージ</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例: イベント報酬" />
      </div>
      <Button onClick={grant} disabled={busy || !amount}><Coins className="h-4 w-4 mr-1" />配布する</Button>
    </Card>
  );
}

export const NAV_KEYS: Array<{ key: string; defaultLabel: string }> = [
  { key: "/dashboard", defaultLabel: "ダッシュボード / ホーム" },
  { key: "/today", defaultLabel: "今日" },
  { key: "/study", defaultLabel: "勉強" },
  { key: "/timer", defaultLabel: "タイマー" },
  { key: "/calendar", defaultLabel: "カレンダー" },
  { key: "/goals", defaultLabel: "目標" },
  { key: "/flashcards", defaultLabel: "暗記" },
  { key: "/friends", defaultLabel: "フレンド" },
  { key: "/polls", defaultLabel: "投票" },
  { key: "/questions", defaultLabel: "問題" },
  { key: "/practice", defaultLabel: "演習" },
  { key: "/tutor", defaultLabel: "AIチューター" },
  { key: "/classroom", defaultLabel: "教室" },
  { key: "/chat", defaultLabel: "チャット" },
  { key: "/classchat", defaultLabel: "クラスチャット" },
  { key: "/notes", defaultLabel: "ノート" },
  { key: "/announcements", defaultLabel: "お知らせ" },
  { key: "/missions", defaultLabel: "ミッション" },
  { key: "/leaderboard", defaultLabel: "ランキング" },
  { key: "/settings", defaultLabel: "設定" },
];

export function NavConfigTab() {
  const [rows, setRows] = useState<Record<string, any>>({});
  const load = async () => {
    const { data } = await supabase.from("admin_nav_config").select("*");
    const m: Record<string, any> = {};
    for (const r of data ?? []) m[(r as any).key] = r;
    setRows(m);
  };
  useEffect(() => { load(); }, []);
  const save = async (key: string, patch: any) => {
    const current = rows[key] ?? { key, label: null, icon_url: null, visible: true, in_quickbar: false, order_idx: 100 };
    const next = { ...current, ...patch, key };
    setRows((s) => ({ ...s, [key]: next }));
    const { error } = await supabase.from("admin_nav_config").upsert(next, { onConflict: "key" });
    if (error) toast.error(error.message);
  };
  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm text-muted-foreground">表示/非表示・名前・アイコン画像URL・並び順・クイックバー登録を編集できます。</p>
      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-2">
        <div className="col-span-3">項目</div>
        <div className="col-span-3">表示名</div>
        <div className="col-span-3">アイコンURL</div>
        <div className="col-span-1">並び</div>
        <div className="col-span-1 text-center">表示</div>
        <div className="col-span-1 text-center">Quick</div>
      </div>
      {NAV_KEYS.map((n) => {
        const r = rows[n.key] ?? {};
        return (
          <div key={n.key} className="grid grid-cols-12 gap-2 items-center bg-card border rounded p-2">
            <div className="col-span-3 text-sm">
              <div className="font-medium truncate">{n.defaultLabel}</div>
              <code className="text-[10px] text-muted-foreground">{n.key}</code>
            </div>
            <div className="col-span-3"><Input defaultValue={r.label ?? ""} placeholder={n.defaultLabel} onBlur={(e) => save(n.key, { label: e.target.value || null })} className="h-8" /></div>
            <div className="col-span-3"><Input defaultValue={r.icon_url ?? ""} placeholder="https://..." onBlur={(e) => save(n.key, { icon_url: e.target.value || null })} className="h-8" /></div>
            <div className="col-span-1"><Input type="number" defaultValue={r.order_idx ?? 100} onBlur={(e) => save(n.key, { order_idx: parseInt(e.target.value, 10) || 100 })} className="h-8" /></div>
            <div className="col-span-1 flex justify-center"><Switch checked={r.visible !== false} onCheckedChange={(v) => save(n.key, { visible: v })} /></div>
            <div className="col-span-1 flex justify-center"><Switch checked={!!r.in_quickbar} onCheckedChange={(v) => save(n.key, { in_quickbar: v })} /></div>
          </div>
        );
      })}
    </div>
  );
}


export function MaintenanceTab() {
  const update = useServerFn(adminUpdateMaintenance);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(!!data.maintenance_mode);
        setMessage(data.maintenance_message ?? "");
        setUntil(data.maintenance_until ? new Date(data.maintenance_until).toISOString().slice(0, 16) : "");
      }
    });
  }, []);

  const save = async () => {
    try {
      await update({ data: {
        enabled, message,
        until: until ? new Date(until).toISOString() : null,
      }});
      toast.success("保存しました");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="p-6 mt-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2"><Wrench className="h-5 w-5" /><h3 className="font-semibold">メンテナンスモード</h3></div>
      <p className="text-sm text-muted-foreground">
        メンテナンスを有効にすると、一般ユーザーはページ遷移・リロード時に自動ログアウトされ、ログイン画面も封鎖されます。
        管理者のみ右下「管理」ボタンからログイン可能です。
      </p>
      <label className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled} />メンテナンス中にする</label>
      <div><Label>内容</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="システム改善のため..." /></div>
      <div><Label>終了予定時刻</Label><Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
      <Button onClick={save}>保存</Button>
    </Card>
  );
}

export function VersionTab() {
  const update = useServerFn(adminUpdateMaintenance);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(!!data.maintenance_mode);
        setMessage(data.maintenance_message ?? "");
        setUntil(data.maintenance_until ?? null);
        setAppVersion((data as any).app_version ?? "v1.0.0");
      }
    });
  }, []);

  const save = async () => {
    try {
      await update({ data: { enabled, message, until, appVersion } });
      toast.success("保存しました");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="p-6 mt-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2"><Wrench className="h-5 w-5" /><h3 className="font-semibold">アプリバージョン</h3></div>
      <div>
        <Label>バージョン</Label>
        <Input value={appVersion} onChange={(e) => setAppVersion(e.target.value)} placeholder="v1.0.0" />
        <p className="text-xs text-muted-foreground mt-1">サイドバーに表示されます。</p>
      </div>
      <Button onClick={save}>保存</Button>
    </Card>
  );
}

