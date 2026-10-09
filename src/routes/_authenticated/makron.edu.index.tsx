import { createFileRoute, Link } from "@tanstack/react-router";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/makron/edu/")({
  head: () => ({
    meta: [
      { title: "Makron for Education — 準備中 | Study#" },
      { name: "description", content: "Makron for Education は現在リニューアル準備中です。" },
    ],
  }),
  component: EduComingSoon,
});

export function EduComingSoon() {
  return (
    <MakronShell title="Makron for Education" subtitle="リニューアル準備中">
      <div className="max-w-xl mx-auto p-6">
        <Card className="p-8 text-center space-y-3">
          <GraduationCap className="h-10 w-10 mx-auto text-primary" />
          <div className="text-lg font-bold">現在リニューアル準備中です</div>
          <p className="text-sm text-muted-foreground">
            学校・塾向けの機能を作り直しています。公開まで今しばらくお待ちください。
          </p>
          <Link to="/makron" className="text-sm underline text-primary">
            Makron に戻る
          </Link>
        </Card>
      </div>
    </MakronShell>
  );
}
