import { useEffect, useState } from "react";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deletePasskey,
  listMyPasskeys,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  renamePasskey,
} from "@/lib/passkey.functions";
import {
  getVapidPublicKey,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/push.functions";

const toU8 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function swReg() {
  return navigator.serviceWorker.register("/push-sw.js");
}

export function DeviceSection() {
  const [keys, setKeys] = useState<{ id: string; label: string | null; created_at: string }[]>([]);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const reload = () =>
    listMyPasskeys()
      .then(setKeys)
      .catch(() => {});
  useEffect(() => {
    void reload();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .getRegistration("/push-sw.js")
        .then((r) => r?.pushManager.getSubscription())
        .then((s) => setPushOn(!!s))
        .catch(() => {});
  }, []);

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

  const addPasskey = () =>
    run(async () => {
      const { options, challengeId } = await passkeyRegisterOptions();
      const response = await startRegistration({ optionsJSON: options });
      const auto = /iPhone|iPad/.test(navigator.userAgent)
        ? "iPhone / iPad"
        : /Android/.test(navigator.userAgent)
          ? "Android"
          : /Mac/.test(navigator.userAgent)
            ? "Mac"
            : /Windows/.test(navigator.userAgent)
              ? "Windows"
              : "この端末";
      const label = newName.trim().slice(0, 40) || auto;
      await passkeyRegisterVerify({ data: { challengeId, response, label } });
      setNewName("");
      await reload();
    }, "パスキーを登録しました");

  const enablePush = () =>
    run(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error(
          "この端末は通知に対応していません（iPhoneはホーム画面に追加すると使えます）",
        );
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error("通知が許可されませんでした");
      const reg = await swReg();
      await navigator.serviceWorker.ready;
      const key = await getVapidPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toU8(key),
      });
      const j = sub.toJSON();
      await savePushSubscription({
        data: { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" },
      });
      setPushOn(true);
    }, "この端末で通知をオンにしました");

  const disablePush = () =>
    run(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setPushOn(false);
    }, "通知をオフにしました");

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-5">
        <h2 className="font-bold">パスキー（顔・指紋でログイン）</h2>
        <p className="text-sm text-muted-foreground">
          登録すると、ログイン画面の「パスキーでログイン」から Face ID / Touch ID / Windows Hello
          でパスワードなしで入れます。
        </p>
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between rounded-lg border p-2 text-sm"
          >
            {editId === k.id ? (
              <div className="flex flex-1 gap-2">
                <Input value={editName} maxLength={40} onChange={(e) => setEditName(e.target.value)} />
                <Button
                  size="sm"
                  disabled={busy || !editName.trim()}
                  onClick={() =>
                    run(async () => {
                      await renamePasskey({ data: { id: k.id, label: editName } });
                      setEditId(null);
                      await reload();
                    }, "名前を変更しました")
                  }
                >
                  保存
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                  取消
                </Button>
              </div>
            ) : (
              <>
                <span>
                  {k.label ?? "端末"}（{new Date(k.created_at).toLocaleDateString("ja-JP")}）
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setEditId(k.id);
                      setEditName(k.label ?? "");
                    }}
                  >
                    名前変更
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await deletePasskey({ data: { id: k.id } });
                        await reload();
                      }, "削除しました")
                    }
                  >
                    削除
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        <Input
          placeholder="パスキーの名前（例: 自宅のMac）"
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button disabled={busy} onClick={addPasskey}>
          この端末をパスキーに登録
        </Button>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-bold">この端末への通知</h2>
        <p className="text-sm text-muted-foreground">
          LINEを使わなくても、スマホやパソコンに直接お知らせが届き、アプリのアイコンに印がつきます。
        </p>
        <div className="flex flex-wrap gap-2">
          {pushOn ? (
            <>
              <Button variant="outline" disabled={busy} onClick={disablePush}>
                通知をオフ
              </Button>
              <Button
                disabled={busy}
                onClick={() => run(() => sendTestPush(), "テスト通知を送りました")}
              >
                テスト通知
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={enablePush}>
              通知をオンにする
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
