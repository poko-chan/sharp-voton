import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useLocalPrefs } from "@/lib/user-prefs";
import { SectionHeading, SettingRow } from "./shared";

export function NotificationsSection() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { prefs: localPrefs, save: saveLocal } = useLocalPrefs();
  const [s, setS] = useState({
    notify_daily_reminder: true,
    notify_chat: true,
    notify_streak_break: true,
    notify_announcements: true,
    reminder_time: "20:00",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc("my_profile_private").then(({ data }: any) => {
      if (data) {
        setS({
          notify_daily_reminder: data.notify_daily_reminder ?? true,
          notify_chat: data.notify_chat ?? true,
          notify_streak_break: data.notify_streak_break ?? true,
          notify_announcements: data.notify_announcements ?? true,
          reminder_time: (data.reminder_time ?? "20:00").slice(0, 5),
        });
      }
      setLoading(false);
    });
  }, [user]);

  const requestBrowser = async () => {
    if (!("Notification" in window)) return toast.error("このブラウザは通知に対応していません");
    const r = await Notification.requestPermission();
    if (r === "granted") toast.success("ブラウザ通知を有効にしました。リマインダーが届くようになります");
    else toast.error("通知が許可されませんでした。ブラウザの設定から通知を許可してください");
  };

  const saveNotifications = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(s).eq("id", user.id);
    if (error) toast.error(error.message); else toast.success("通知設定を保存しました");
  };

  if (loading) return <div className="text-sm text-muted-foreground p-2">読み込み中…</div>;

  const notifPermission = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";

  return (
    <div className="space-y-6">
      <SectionHeading title="通知" desc="リマインダーやチャット、お知らせの通知を管理します" />
      <Card className="p-6 space-y-5">
        {notifPermission !== "granted" && (
          <p className="text-xs text-warning-foreground bg-warning/10 border border-warning/30 rounded p-2">
            {t("settings.notifPermissionNeeded")}
          </p>
        )}
        <SettingRow label={t("settings.dailyReminder")} desc={t("settings.dailyReminderDesc")} checked={s.notify_daily_reminder} onChange={(v) => setS({ ...s, notify_daily_reminder: v })} />
        <div className="pl-2"><Label className="text-xs">{t("settings.reminderTime")}</Label>
          <Input type="time" value={s.reminder_time} onChange={(e) => setS({ ...s, reminder_time: e.target.value })} className="w-32" />
        </div>
        <SettingRow label={t("settings.chatNotif")} desc={t("settings.chatNotifDesc")} checked={s.notify_chat} onChange={(v) => setS({ ...s, notify_chat: v })} />
        <SettingRow label={t("settings.announcementNotif")} desc={t("settings.announcementNotifDesc")} checked={s.notify_announcements} onChange={(v) => setS({ ...s, notify_announcements: v })} />
        <SettingRow label={t("settings.streakNotif")} desc={t("settings.streakNotifDesc")} checked={s.notify_streak_break} onChange={(v) => setS({ ...s, notify_streak_break: v })} />
        <div className="flex gap-2 pt-2">
          <Button onClick={saveNotifications}>{t("common.save")}</Button>
          <Button variant="outline" onClick={requestBrowser}>{t("settings.enableBrowserNotif")}</Button>
        </div>
      </Card>
      <Card className="p-6 space-y-4">
        <div className="font-semibold">効果音</div>
        <SettingRow
          label="効果音を再生する"
          desc="タイマー終了やボタン操作時の効果音のON/OFF（この端末のみ）"
          checked={localPrefs.sound_enabled}
          onChange={(v) => saveLocal({ sound_enabled: v })}
        />
      </Card>
    </div>
  );
}
