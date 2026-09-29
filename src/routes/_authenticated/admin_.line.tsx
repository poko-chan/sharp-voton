import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getLineServerStatus } from "@/lib/line.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Check, Copy, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_APPS_SCRIPT = `/**
 * Study# × LINE 連携用 Google Apps Script
 *
 * 1. script.google.com で新しいプロジェクトを作成し、このコードを貼り付ける
 * 2. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 * 3. 発行された /exec のURLを Study# の「Webhook転送先URL」に貼り付ける
 *
 * Study# が LINE の署名を検証したあと、このスクリプトへ本文を転送します。
 */

// LINE Developers の Messaging API チャネルアクセストークン
const LINE_ACCESS_TOKEN = 'ここにチャネルアクセストークン';
// 記録は Study# のデータベースに自動保存されます
const LOGIN_URL = 'https://sharp-voton.lovable.app/line-liff/login';

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  (body.events || []).forEach(handleEvent);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleEvent(event) {
  if (event.type === 'follow') {
    replyText_(event.replyToken, 'Study# へようこそ！\\nこちらからログインできます:\\n' + LOGIN_URL);
    return;
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const text = (event.message.text || '').trim();
    if (text === 'ログイン' || text.toLowerCase() === 'login') {
      replyText_(event.replyToken, 'こちらからログインしてください:\\n' + LOGIN_URL);
    } else {
      replyText_(event.replyToken, '「ログイン」と送るとログインリンクをお送りします。');
    }
  }
}

function replyText_(replyToken, text) {
  if (!replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + LINE_ACCESS_TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true,
  });
}

`;

type Settings = {
  login_channel_id: string | null;
  liff_id: string | null;
  official_account_id: string | null;
  webhook_forward_url: string | null;
  webhook_enabled: boolean;
  welcome_message: string | null;
  apps_script_code: string | null;
  notes: string | null;
};

const EMPTY: Settings = {
  login_channel_id: "",
  liff_id: "",
  official_account_id: "",
  webhook_forward_url: "",
  webhook_enabled: true,
  welcome_message: "",
  apps_script_code: DEFAULT_APPS_SCRIPT,
  notes: "",
};

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("コピーしました");
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <X className="h-4 w-4 text-destructive" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function AdminLinePage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [s, setS] = useState<Settings>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/line/webhook` : "";
  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}/line-liff/login` : "";
  const callbackUrl = loginUrl;

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase.from("line_settings").select("*").eq("id", 1).maybeSingle();
      if (data) {
        setS({
          ...EMPTY,
          ...(data as any),
          apps_script_code: (data as any).apps_script_code || DEFAULT_APPS_SCRIPT,
        });
      }
      try {
        setStatus((await getLineServerStatus()) as any);
      } catch {
        /* ignore */
      }
    })();
  }, [isAdmin]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("line_settings").upsert({ id: 1, ...s } as any);
    if (error) toast.error(error.message);
    else toast.success("保存しました");
    setSaving(false);
  };

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <Button variant="ghost" className="-ml-3" onClick={() => navigate({ to: "/admin" })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        管理機能一覧
      </Button>

      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#06C755]/15 text-[#06C755]">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LINE連携</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            公式アカウントのWebhookとApps Scriptをここで管理します。
          </p>
        </div>
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">LINE Developers に貼り付けるURL</h2>
        {[
          { label: "Webhook URL（Messaging API）", value: webhookUrl },
          { label: "コールバックURL（LINEログイン）", value: callbackUrl },
          { label: "リッチメニューのリンク先", value: loginUrl },
        ].map((row) => (
          <div key={row.label} className="space-y-1">
            <Label>{row.label}</Label>
            <div className="flex gap-2">
              <Input readOnly value={row.value} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(row.value)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {status && (
          <div className="grid gap-1 rounded-xl border p-3 sm:grid-cols-2">
            <StatusDot ok={status.loginChannelId} label="ログイン チャネルID" />
            <StatusDot ok={status.loginChannelSecret} label="ログイン チャネルシークレット" />
            <StatusDot ok={status.messagingChannelSecret} label="Messaging チャネルシークレット" />
            <StatusDot ok={status.messagingAccessToken} label="Messaging アクセストークン" />
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Webhookの設定</h2>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <div>
            <div className="text-sm font-medium">Webhookを受け付ける</div>
            <div className="text-xs text-muted-foreground">
              オフにするとLINEからの通知を無視します
            </div>
          </div>
          <Switch
            checked={s.webhook_enabled}
            onCheckedChange={(v) => setS({ ...s, webhook_enabled: v })}
          />
        </div>
        <div className="space-y-1">
          <Label>Webhook転送先URL（Apps Script の /exec）</Label>
          <Input
            value={s.webhook_forward_url ?? ""}
            onChange={(e) => setS({ ...s, webhook_forward_url: e.target.value })}
            placeholder="https://script.google.com/macros/s/.../exec"
          />
        </div>
        <div className="space-y-1">
          <Label>自動あいさつメッセージ（空欄なら送りません）</Label>
          <Textarea
            rows={3}
            value={s.welcome_message ?? ""}
            onChange={(e) => setS({ ...s, welcome_message: e.target.value })}
            placeholder="Study# へようこそ！メニューからログインできます。"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>ログイン チャネルID（控え）</Label>
            <Input
              value={s.login_channel_id ?? ""}
              onChange={(e) => setS({ ...s, login_channel_id: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>LIFF ID（任意）</Label>
            <Input value={s.liff_id ?? ""} onChange={(e) => setS({ ...s, liff_id: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>公式アカウントID（任意）</Label>
            <Input
              value={s.official_account_id ?? ""}
              onChange={(e) => setS({ ...s, official_account_id: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Google Apps Script のコード</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setS({ ...s, apps_script_code: DEFAULT_APPS_SCRIPT })}
            >
              初期コードに戻す
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(s.apps_script_code ?? "")}>
              <Copy className="mr-2 h-4 w-4" />
              コピー
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          このコードを script.google.com に貼り付けてウェブアプリとしてデプロイし、発行されたURLを上の「Webhook転送先URL」に入れてください。
        </p>
        <Textarea
          rows={22}
          className="font-mono text-xs"
          value={s.apps_script_code ?? ""}
          onChange={(e) => setS({ ...s, apps_script_code: e.target.value })}
        />
        <div className="space-y-1">
          <Label>メモ</Label>
          <Textarea
            rows={2}
            value={s.notes ?? ""}
            onChange={(e) => setS({ ...s, notes: e.target.value })}
          />
        </div>
      </Card>

      <LineLogCard />


      <Button onClick={save} disabled={saving} size="lg">
        保存する
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin_/line")({
  head: () => ({
    meta: [
      { title: "LINE連携管理｜Study#" },
      { name: "description", content: "LINE公式アカウントのWebhookとApps Scriptを管理します。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLinePage,
});

function LineLogCard() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from("line_message_logs" as any)
      .select("id, direction, event_type, line_user_id, user_id, text, ok, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as any[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <Card className="space-y-3 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">LINEの記録（最新50件）</h2>
        <Button variant="outline" size="sm" onClick={load}>更新</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        受け取ったメッセージと送ったお知らせは、すべてStudy#のデータベースに保存されます。
      </p>
      <div className="max-h-96 space-y-1 overflow-auto text-xs">
        {rows.length === 0 && <p className="text-muted-foreground">まだ記録はありません。</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex gap-2 rounded border p-2">
            <span className={r.direction === "in" ? "text-primary" : "text-muted-foreground"}>
              {r.direction === "in" ? "受信" : "送信"}
            </span>
            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("ja-JP")}</span>
            <span>{r.event_type}</span>
            {r.ok === false && <span className="text-destructive">失敗</span>}
            <span className="truncate">{r.text}</span>
            {!r.user_id && r.direction === "in" && (
              <span className="ml-auto text-muted-foreground">未連携</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
