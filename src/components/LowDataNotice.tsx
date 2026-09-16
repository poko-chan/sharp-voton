import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Database } from "lucide-react";

const KEY = "lowDataNotice.shown";

export function LowDataNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(KEY)) return;
    setOpen(true);
  }, []);

  if (!open) return null;

  const close = () => {
    sessionStorage.setItem(KEY, "1");
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <Card className="max-w-md space-y-3 p-6">
        <div className="flex items-center gap-2 font-bold">
          <Database className="h-5 w-5 text-primary" />
          低データモード中です
        </div>
        <p className="text-sm text-muted-foreground">
          現在、通信量をおさえるため一部の機能を停止しています。ご利用いただけるのは次の画面です。
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>ホーム（ダッシュボード）</li>
          <li>勉強記録</li>
          <li>タイマー</li>
          <li>チャット</li>
          <li>お知らせ</li>
          <li>設定</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          解除されると、これまでどおりすべての機能が使えるようになります。
        </p>
        <Button className="w-full" onClick={close}>
          わかりました
        </Button>
      </Card>
    </div>
  );
}
