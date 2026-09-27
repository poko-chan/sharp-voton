import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { getMyControls } from "@/lib/parent.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Lock } from "lucide-react";
import { LOCKABLE_FEATURES } from "@/components/parent/ParentControls";

type Controls = {
  daily_limit_minutes: number | null;
  allowed_from: string | null;
  allowed_to: string | null;
  locked_features: string[];
  homework_first: boolean;
};

const USAGE_KEY = "study-hash.usage";

function minutesUsedToday() {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) ?? "{}");
    const today = new Date().toISOString().slice(0, 10);
    return raw.date === today ? Number(raw.minutes ?? 0) : 0;
  } catch {
    return 0;
  }
}

function bumpUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const minutes = minutesUsedToday() + 1;
  localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, minutes }));
  return minutes;
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

function Blocked({ icon, title, body }: { icon: "time" | "lock"; title: string; body: string }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-background/95 p-6 backdrop-blur">
      <Card className="max-w-sm space-y-4 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted">
          {icon === "time" ? <Clock className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Button className="w-full" onClick={() => navigate({ to: "/dashboard" })}>
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

  useEffect(() => {
    if (!user || accountKind === "parent") return;
    (async () => {
      try {
        setControls((await getMyControls()) as any);
      } catch {
        /* no controls */
      }
    })();
  }, [user, accountKind]);

  useEffect(() => {
    if (!controls?.daily_limit_minutes) return;
    setUsed(minutesUsedToday());
    const id = setInterval(() => setUsed(bumpUsage()), 60_000);
    return () => clearInterval(id);
  }, [controls?.daily_limit_minutes]);

  if (!controls) return null;

  if (!withinWindow(controls.allowed_from, controls.allowed_to)) {
    return (
      <Blocked
        icon="time"
        title="いまは使える時間ではありません"
        body={`つかえる時間は ${controls.allowed_from?.slice(0, 5)} 〜 ${controls.allowed_to?.slice(0, 5)} です。`}
      />
    );
  }

  if (controls.daily_limit_minutes && used >= controls.daily_limit_minutes) {
    return (
      <Blocked
        icon="time"
        title="今日の利用時間が終わりました"
        body={`1日 ${controls.daily_limit_minutes} 分までに設定されています。また明日つかえます。`}
      />
    );
  }

  const path = location.pathname;
  const hit = (controls.locked_features ?? []).find((k) => path.startsWith(`/${k}`));
  if (hit) {
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
