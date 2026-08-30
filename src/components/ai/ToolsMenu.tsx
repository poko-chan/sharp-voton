import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { MoreHorizontal, GraduationCap, FileDown, Check } from "lucide-react";
import { TASK_DEFS, TASK_GROUPS, type TaskKind } from "@/lib/tutor-tasks";

export function ToolsMenu({
  value, onSelect, hintOn, onHintChange, disabled, canExportPdf, onExportPdf,
}: {
  value: TaskKind | null;
  onSelect: (k: TaskKind | null) => void;
  hintOn: boolean;
  onHintChange: (v: boolean) => void;
  disabled?: boolean;
  canExportPdf: boolean;
  onExportPdf: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? "Liteでは使えません。Flash以上に切り替えてください。" : "そのほかの機能"}
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${
            value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[320px] p-0">
        <div className="max-h-[70dvh] overflow-y-auto p-2">
          <div className="rounded-xl border p-2.5">
            <label className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-start gap-2">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">ヒント重視</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    答えを先に言わず、ヒントと考え方から導きます。今のスレッドだけに適用されます。
                  </span>
                </span>
              </span>
              <Switch checked={hintOn} onCheckedChange={onHintChange} aria-label="ヒント重視" />
            </label>
          </div>

          {TASK_GROUPS.map((g) => (
            <div key={g.label} className="mt-2">
              <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {g.label}
              </p>
              <div className="space-y-0.5">
                {g.kinds.map((k) => {
                  const def = TASK_DEFS[k];
                  const Icon = def.icon;
                  const on = value === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onSelect(on ? null : k)}
                      className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                        on ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold">{def.label}</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">{def.desc}</span>
                      </span>
                      {on && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-2 border-t pt-2">
            <button
              type="button"
              disabled={!canExportPdf}
              onClick={onExportPdf}
              className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-muted disabled:opacity-40"
            >
              <FileDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">PDFで書き出す</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {canExportPdf ? "右のキャンバスの内容を印刷・PDF保存します。" : "先に成果物を作ると使えます。"}
                </span>
              </span>
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
