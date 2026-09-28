import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  getChatWebhooks,
  saveChatWebhooks,
  testChatWebhooks,
  type ChatWebhooks,
} from "@/lib/chat-webhooks.functions";

export function ChatWebhookSection() {
  const [v, setV] = useState<ChatWebhooks | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getChatWebhooks()
      .then(setV)
      .catch(() => setV({ discord_url: "", slack_url: "", notify_study_finished: true }));
  }, []);

  if (!v) return <p className="text-sm text-muted-foreground">読み込み中…</p>;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-bold">Discord / Slack 通知</h2>
        <p className="text-sm text-muted-foreground">
          勉強仲間のチャンネルに、勉強が終わったことを自動で投稿します。チャンネル設定で作った「Webhook URL」を貼ってください。
        </p>
      </div>
      <label className="block space-y-1 text-sm">
        <span>Discord Webhook URL</span>
        <Input
          value={v.discord_url}
          placeholder="https://discord.com/api/webhooks/..."
          onChange={(e) => setV({ ...v, discord_url: e.target.value.trim() })}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Slack Webhook URL</span>
        <Input
          value={v.slack_url}
          placeholder="https://hooks.slack.com/services/..."
          onChange={(e) => setV({ ...v, slack_url: e.target.value.trim() })}
        />
      </label>
      <div className="flex items-center justify-between text-sm">
        <span>勉強が終わったら投稿する</span>
        <Switch
          checked={v.notify_study_finished}
          onCheckedChange={(c) => setV({ ...v, notify_study_finished: c })}
        />
      </div>
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => run(() => saveChatWebhooks({ data: v }), "保存しました")}>
          保存
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run(() => testChatWebhooks(), "テスト通知を送りました")}
        >
          テスト通知
        </Button>
      </div>
    </Card>
  );
}
