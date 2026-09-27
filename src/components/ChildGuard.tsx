import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { getMyControls } from "@/lib/parent.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Lock } from "lucide-react";
import { LOCKABLE_FEATURES } from "@/components/parent/lockable-features";
import { bumpUsage, featureKeyFromPath, readUsage } from "@/lib/child-usage";
import { openParentPanel } from "@/lib/parent-panel";

type Controls = {
  daily_limit_minutes: number | null;
  allowed_from: string | null;
  allowed_to: string | null;
  locked_features: string[];
  always_allowed_features: string[] | null;
  app_time_limits: Record<string, number> | null;
  bonus_minutes: number | null;
  bonus_date: string | null;
  homework_first: boolean;
};

function jstToday() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function withinWindow(from: string | null, to: string | null) {
  if (!from || !to) return true;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const start = fh * 60 + (fm || 0);
  const end = th * 60 + (tm || 0);
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}

function Blocked({
  icon,
  title,
  body,
}: {
  icon: "time" | "lock";
  title: string;
  body: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-background/95 p-6 backdrop-blur">
      <Card className="max-w-sm space-y-4 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted">
          {icon === "time" ? <Clock className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Button className="w-full" onClick={() => openParentPanel("extend")}>
          おうちの人にお願いする
        </Button>
        <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/dashboard" })}>
          ホームへもどる
        </Button>
      </Card>
    </div>
  );
}

export function ChildGuard() {
  const { user, accountKind } = useAuth();
  const location = useLocation();
  const [controls, setControls] = useState<Controls | null>(null);
  const [used, setUsed] = useState(0);
  const [appUsed, setAppUsed] = useState<Record<string, number>>({});

  const path = location.pathname;
  const feature = featureKeyFromPath(path);

  const refresh = useCallback(async () => {
    try {
      setControls((await getMyControls()) as unknown as Controls);
    } catch {
      /* no controls */
    }
  }, []);

  useEffect(() => {
    if (!user || accountKind === "parent") return;
    void refresh();
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [user, accountKind, refresh]);

  const tracking =
    Boolean(controls?.daily_limit_minutes) ||
    Object.keys(controls?.app_time_limits ?? {}).length > 0;

  useEffect(() => {
    if (!tracking) return;
    const snap = readUsage();
    setUsed(snap.minutes);
    setAppUsed(snap.apps);
    const id = setInterval(() => {
      const next = bumpUsage(feature);
      setUsed(next.minutes);
      setAppUsed({ ...next.apps });
    }, 60_000);
    return () => clearInterval(id);
  }, [tracking, feature]);

  if (!controls) return null;

  const alwaysOk = (controls.always_allowed_features ?? []).includes(feature ?? "");

  if (!alwaysOk && !withinWindow(controls.allowed_from, controls.allowed_to)) {
    return (
      <Blocked
        icon="time"
        title="いまは使える時間ではありません"
        body={`つかえる時間は ${controls.allowed_from?.slice(0, 5)} 〜 ${controls.allowed_to?.slice(0, 5)} です。`}
      />
    );
  }

  const bonus = controls.bonus_date === jstToday() ? (controls.bonus_minutes ?? 0) : 0;
  const totalLimit = controls.daily_limit_minutes ? controls.daily_limit_minutes + bonus : null;

  if (!alwaysOk && totalLimit && used >= totalLimit) {
    return (
      <Blocked
        icon="time"
        title="今日の利用時間が終わりました"
        body={`1日 ${totalLimit} 分までに設定されています。もう少し使いたいときは、おうちの人にお願いできます。`}
      />
    );
  }

  const appLimit = feature ? (controls.app_time_limits ?? {})[feature] : undefined;
  if (appLimit && (appUsed[feature ?? ""] ?? 0) >= appLimit) {
    const label = LOCKABLE_FEATURES.find((f) => f.key === feature)?.label ?? "この機能";
    return (
      <Blocked
        icon="time"
        title={`${label}は今日はここまでです`}
        body={`${label}は1日 ${appLimit} 分までに設定されています。ほかの機能はつかえます。`}
      />
    );
  }

  const hit = (controls.locked_features ?? []).find((k) => path.startsWith(`/${k}`));
  if (hit && !alwaysOk) {
    const label = LOCKABLE_FEATURES.find((f) => f.key === hit)?.label ?? "この機能";
    return (
      <Blocked
        icon="lock"
        title={`${label}はロック中です`}
        body="おうちの人が使えないように設定しています。"
      />
    );
  }

  return null;
}

export default ChildGuard;
