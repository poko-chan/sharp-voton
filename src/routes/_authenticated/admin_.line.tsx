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

type AutoReply = { keyword: string; reply: string };

function buildAppsScript(opts: {
  token: string;
  welcome: string;
  loginUrl: string;
  replies: AutoReply[];
}) {
  const esc = (v: string) => JSON.stringify(v ?? "");
  const rules = (opts.replies ?? [])
    .filter((r) => r.keyword.trim())
    .map((r) => `  { keyword: ${esc(r.keyword.trim())}, reply: ${esc(r.reply)} },`)
    .join("\n");
  return `/**
 * Study# × LINE 連携用 Google Apps Script（自動生成）
 *
 * 1. script.google.com で新しいプロジェクトを作成し、このコードを貼り付ける
 * 2. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 * 3. 発行された /exec のURLを Study# の「Webhook転送先URL」に貼り付ける
 *
 * 記録はすべて Study# のデータベースに自動保存されます。
 */

const LINE_ACCESS_TOKEN = ${esc(opts.token || "ここにチャネルアクセストークン")};
const LOGIN_URL = ${esc(opts.loginUrl)};
const WELCOME_MESSAGE = ${esc(opts.welcome || "Study# へようこそ！")};

const AUTO_REPLIES = [
${rules || "  // キーワード自動返信ルールは Study# の管理画面で追加できます"}
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(handleEvent_);
  } catch (err) {
    console.error(err);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleEvent_(event) {
  if (event.type === 'follow') {
    replyText_(event.replyToken, WELCOME_MESSAGE + '\\n' + LOGIN_URL);
    return;
  }
  if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;

  const text = (event.message.text || '').trim();
  for (let i = 0; i < AUTO_REPLIES.length; i++) {
    const rule = AUTO_REPLIES[i];
    if (text === rule.keyword || text.indexOf(rule.keyword) >= 0) {
      replyText_(event.replyToken, rule.reply.replace('{LOGIN_URL}', LOGIN_URL));
      return;
    }
  }
  if (text === 'ログイン' || text.toLowerCase() === 'login') {
    replyText_(event.replyToken, 'こちらからログインしてください:\\n' + LOGIN_URL);
    return;
  }
  replyText_(event.replyToken, '「ログイン」と送るとログインリンクをお送りします。');
}

function replyText_(replyToken, text) {
  if (!replyToken || !text) return;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + LINE_ACCESS_TOKEN },
      payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error(err);
  }
}
`;
}

type Settings = {
  login_channel_id: string | null;
  liff_id: string | null;
  official_account_id: string | null;
  webhook_forward_url: string | null;
  webhook_enabled: boolean;
  welcome_message: string | null;
  apps_script_code: string | null;
  notes: string | null;
  auto_replies: AutoReply[];
};

const EMPTY: Settings = {
  login_channel_id: "",
  liff_id: "",
  official_account_id: "",
  webhook_forward_url: "",
  webhook_enabled: true,
  welcome_message: "",
  apps_script_code: "",
  notes: "",
  auto_replies: [
    { keyword: "ログイン", reply: "こちらからログインしてください:\n{LOGIN_URL}" },
    { keyword: "ヘルプ", reply: "使い方はStudy#のヘルプページをご覧ください。" },
  ],
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
  const [token, setToken] = useState("");

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
        const ar = (data as any).auto_replies;
        setS({
          ...EMPTY,
          ...(data as any),
          auto_replies: Array.isArray(ar) && ar.length > 0 ? ar : EMPTY.auto_replies,
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

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Apps Script 設定フォーム</h2>
        <p className="text-xs text-muted-foreground">
          ここに入力すると、下のコードが自動で完成します。コピーして script.google.com
          に貼り付け、ウェブアプリとしてデプロイしてください。
        </p>
        <div className="space-y-1">
          <Label>LINE チャネルアクセストークン（コードに埋め込むだけ・保存されません）</Label>
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="LINE Developers の Messaging API から取得"
          />
        </div>
        <div className="space-y-1">
          <Label>あいさつメッセージ（友だち追加のとき）</Label>
          <Textarea
            rows={2}
            value={s.welcome_message ?? ""}
            onChange={(e) => setS({ ...s, welcome_message: e.target.value })}
            placeholder="Study# へようこそ！"
          />
        </div>
        <div className="space-y-2">
          <Label>キーワード自動返信ルール</Label>
          <p className="text-[11px] text-muted-foreground">
            返信文に {"{"}LOGIN_URL{"}"} と書くと、ログインリンクに置きかわります。
          </p>
          {s.auto_replies.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="w-40"
                value={r.keyword}
                placeholder="キーワード"
                onChange={(e) => {
                  const next = [...s.auto_replies];
                  next[i] = { ...r, keyword: e.target.value };
                  setS({ ...s, auto_replies: next });
                }}
              />
              <Input
                value={r.reply}
                placeholder="返信する文"
                onChange={(e) => {
                  const next = [...s.auto_replies];
                  next[i] = { ...r, reply: e.target.value };
                  setS({ ...s, auto_replies: next });
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setS({ ...s, auto_replies: s.auto_replies.filter((_, j) => j !== i) })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setS({ ...s, auto_replies: [...s.auto_replies, { keyword: "", reply: "" }] })
            }
          >
            ルールを追加
          </Button>
        </div>
        <div className="space-y-1">
          <Label>ログインURL（自動）</Label>
          <Input readOnly value={loginUrl} className="font-mono text-xs" />
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">できあがったコード</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              copy(
                buildAppsScript({
                  token,
                  welcome: s.welcome_message ?? "",
                  loginUrl,
                  replies: s.auto_replies,
                }),
              )
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            コピー
          </Button>
        </div>
        <Textarea
          rows={20}
          readOnly
          className="font-mono text-xs"
          value={buildAppsScript({
            token,
            welcome: s.welcome_message ?? "",
            loginUrl,
            replies: s.auto_replies,
          })}
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
