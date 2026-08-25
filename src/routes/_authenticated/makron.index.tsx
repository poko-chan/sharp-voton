import { createFileRoute, Link } from "@tanstack/react-router";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, Lock, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/makron/")({ component: MakronHub });

function MakronHub() {
  return (
    <MakronShell title="Makron" subtitle="学習モードを選択">
      <div className="max-w-4xl mx-auto p-6 grid md:grid-cols-2 gap-4">
        <Link to="/makron/units" className="block">
          <Card className="p-6 h-full hover:border-primary transition space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <div className="text-xl font-bold">Makron</div>
            </div>
            <p className="text-sm text-muted-foreground">
              教科・単元から公式パックを選んで問題演習。XP・ランキング・履歴に対応。
            </p>
            <Button size="sm" className="w-full">
              はじめる <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Card>
        </Link>

        <Card className="p-6 h-full space-y-3 opacity-70">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <div className="text-xl font-bold">Makron for YourSelf</div>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-muted">準備中</span>
          </div>
          <p className="text-sm text-muted-foreground">
            自分専用の問題づくり・自習モード。近日公開予定です。
          </p>
          <Button size="sm" className="w-full" variant="outline" disabled>
            <Lock className="h-4 w-4 mr-1" />準備中
          </Button>
        </Card>
      </div>
    </MakronShell>
  );
}
