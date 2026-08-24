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

