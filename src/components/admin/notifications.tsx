import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers, adminSendNotification } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BellRing, Send } from "lucide-react";
import { toast } from "sonner";

export function NotificationsAdminTab() {
  const list = useServerFn(adminListUsers);
  const send = useServerFn(adminSendNotification);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await list({
          data: { search: search.trim() || undefined, page: 0, pageSize: 200 },
        });
        setUsers(result.users);
      } catch (error: any) {
        toast.error(error.message);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const submit = async () => {
    if (!title.trim()) return toast.error("タイトルを入力してください");
    if (target === "all" && !confirm("全ユーザーに通知を送信しますか？")) return;
    setBusy(true);
    try {
      const result = await send({
        data: {
          title,
          body: body || undefined,
          link: link || undefined,
          sendToAll: target === "all",
          userId: target === "all" ? undefined : target,
        },
      });
      toast.success(`${result.count} 人に通知を送信しました`);
      setTitle("");
      setBody("");
      setLink("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">アプリ内通知を送る</h2>
            <p className="text-xs text-muted-foreground">
              重要なお知らせをユーザーの通知ボックスへ届けます。
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>送信先</Label>
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">全ユーザー</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name || user.username || user.email || user.id}
              </option>
            ))}
          </select>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ユーザーを検索して選ぶ"
          />
        </div>
        <div className="space-y-2">
          <Label>タイトル</Label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            placeholder="例: メンテナンスのお知らせ"
          />
        </div>
        <div className="space-y-2">
          <Label>本文</Label>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            rows={5}
            placeholder="通知の内容"
          />
        </div>
        <div className="space-y-2">
          <Label>リンク（任意）</Label>
          <Input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="/announcements"
          />
        </div>
        <Button onClick={submit} disabled={busy}>
          <Send className="mr-2 h-4 w-4" />
          {busy ? "送信中..." : "通知を送信"}
        </Button>
      </Card>
      <Card className="h-fit space-y-3 p-5">
        <h3 className="font-semibold">使い分け</h3>
        <p className="text-sm text-muted-foreground">
          全員への告知は「お知らせ」も使えます。個別の対応連絡や、アプリ内で確実に確認してほしい内容はこちらから送信します。
        </p>
      </Card>
    </div>
  );
}
