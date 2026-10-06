import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminUpdateLowDataMode, adminUpdateMaintenance } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Database } from "lucide-react";
import { toast } from "sonner";

export function MaintenanceTab() {
  const update = useServerFn(adminUpdateMaintenance);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEnabled(!!data.maintenance_mode);
          setMessage(data.maintenance_message ?? "");
          setUntil(
            data.maintenance_until
              ? new Date(data.maintenance_until).toISOString().slice(0, 16)
              : "",
          );
        }
      });
  }, []);

  const save = async () => {
    try {
      await update({
        data: {
          enabled,
          message,
          until: until ? new Date(until).toISOString() : null,
        },
      });
      toast.success("保存しました");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card className="p-6 mt-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5" />
        <h3 className="font-semibold">メンテナンスモード</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        メンテナンスを有効にすると、一般ユーザーはページ遷移・リロード時に自動ログアウトされ、ログイン画面も封鎖されます。
        管理者のみ右下「管理」ボタンからログイン可能です。
      </p>
      <label className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        メンテナンス中にする
      </label>
      <div>
        <Label>内容</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="システム改善のため..."
        />
      </div>
      <div>
        <Label>終了予定時刻</Label>
        <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
      </div>
      <Button onClick={save}>保存</Button>
    </Card>
  );
}

export function LowDataModeTab() {
  const update = useServerFn(adminUpdateLowDataMode);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("low_data_mode")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setEnabled(!!data?.low_data_mode));
  }, []);

  const save = async () => {
    try {
      await update({ data: { enabled } });
      toast.success("保存しました");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card className="p-6 mt-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5" />
        <h3 className="font-semibold">低データモード</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        有効にすると、一般ユーザーは勉強記録、タイマー、チャット、設定、お知らせ、目標時間グラフだけ利用できます。管理者は通常どおり利用できます。
      </p>
      <label className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        低データモードを有効にする
      </label>
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
    supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card className="p-6 mt-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5" />
        <h3 className="font-semibold">アプリバージョン</h3>
      </div>
      <div>
        <Label>バージョン</Label>
        <Input
          value={appVersion}
          onChange={(e) => setAppVersion(e.target.value)}
          placeholder="v1.0.0"
        />
        <p className="text-xs text-muted-foreground mt-1">サイドバーに表示されます。</p>
      </div>
      <Button onClick={save}>保存</Button>
    </Card>
  );
}
