import { Switch } from "@/components/ui/switch";
import { Database, Eye, EyeOff, Layers, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { SCOPE_DEFS, type ChatPrefs, type ScopeKey } from "@/lib/tutor-prefs";

function Segmented<T extends string | number>({
  value, options, onChange,
}: { value: T; options: { v: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-xl border px-2 py-2 text-left transition ${
            value === o.v ? "border-primary/50 bg-primary/10 text-foreground" : "hover:bg-muted/60"
          }`}
        >
          <span className="block text-xs font-semibold">{o.label}</span>
          {o.hint && <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ChatSettingsPanel({ prefs, onChange }: { prefs: ChatPrefs; onChange: (p: ChatPrefs) => void }) {
  const set = (patch: Partial<ChatPrefs>) => onChange({ ...prefs, ...patch });
  const toggleScope = (k: ScopeKey) =>
    set({ scopes: prefs.scopes.includes(k) ? prefs.scopes.filter((x) => x !== k) : [...prefs.scopes, k] });

  return (
    <div className="space-y-5">
      <Section
        icon={prefs.lookup === "never" ? EyeOff : Eye}
        title="このチャットで学習データを見るか"
        desc="AIがあなたの学習記録や目標を参照するかどうかを決めます。"
      >
        <Segmented
          value={prefs.lookup}
          onChange={(v) => set({ lookup: v })}
          options={[
            { v: "auto", label: "自動", hint: "必要なときだけ見る" },
            { v: "always", label: "いつも見る", hint: "毎回参照して答える" },
            { v: "never", label: "見ない", hint: "会話だけで答える" },
          ]}
        />
      </Section>

      <Section icon={Layers} title="考える回数（推論パス）" desc="回数を増やすほど下書きを自己点検して精度が上がりますが、時間がかかります。">
        <Segmented
          value={prefs.passes}
          onChange={(v) => set({ passes: v })}
          options={[
            { v: 1, label: "すぐ答える", hint: "1回で生成" },
            { v: 2, label: "見直す", hint: "下書き→改善" },
            { v: 3, label: "じっくり", hint: "計画→下書き→改善" },
          ]}
        />
      </Section>

      <Section icon={Sparkles} title="回答の長さ" desc="用途に合わせて情報量を切り替えます。">
        <Segmented
          value={prefs.length}
          onChange={(v) => set({ length: v })}
          options={[
            { v: "short", label: "簡潔", hint: "要点だけ" },
            { v: "normal", label: "標準", hint: "バランス" },
            { v: "deep", label: "詳しく", hint: "example付き" },
          ]}
        />
      </Section>

      <Section icon={Wand2} title="話し方" desc="AIの口調を選べます。">
        <Segmented
          value={prefs.tone}
          onChange={(v) => set({ tone: v })}
          options={[
            { v: "friendly", label: "やさしい" },
            { v: "calm", label: "落ち着き" },
            { v: "coach", label: "コーチ" },
          ]}
        />
      </Section>

      <div className="space-y-2 rounded-xl border p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-xs font-semibold">答えを先に教える</span>
            <span className="block text-[11px] text-muted-foreground">オフのときは、まずヒントと考え方から案内します。</span>
          </span>
          <Switch checked={prefs.directAnswer} onCheckedChange={(v) => set({ directAnswer: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 border-t pt-2">
          <span className="min-w-0">
            <span className="block text-xs font-semibold">思考プロセスを自動で開く</span>
            <span className="block text-[11px] text-muted-foreground">生成中の考えを最初から表示します。</span>
          </span>
          <Switch checked={prefs.autoOpenThinking} onCheckedChange={(v) => set({ autoOpenThinking: v })} />
        </label>
      </div>

      <Section icon={ShieldCheck} title="AIに見せてよい情報" desc="オフにした情報は、どの設定でもAIへ渡しません。">
        <div className="grid gap-2">
          {SCOPE_DEFS.map((s) => {
            const on = prefs.scopes.includes(s.key);
            const Icon = s.icon;
            return (
              <label key={s.key} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${on ? "border-primary/30 bg-primary/[0.06]" : "bg-background/70"}`}>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{s.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{s.desc}</span>
                </span>
                <Switch checked={on} onCheckedChange={() => toggleScope(s.key)} aria-label={`${s.label}の参照許可`} />
              </label>
            );
          })}
        </div>
      </Section>

      <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        設定は端末に保存され、次に開いたときも引き継がれます。学習情報は回答の作成だけに使われ、外部には送信されません。
      </p>
    </div>
  );
}
