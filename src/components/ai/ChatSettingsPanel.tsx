import { Switch } from "@/components/ui/switch";
import {
  Check,
  Database,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { ALL_SCOPES, SCOPE_DEFS, type ChatPrefs, type ScopeKey } from "@/lib/tutor-prefs";

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
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
          {o.hint && (
            <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
              {o.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: any;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ChatSettingsPanel({
  prefs,
  onChange,
}: {
  prefs: ChatPrefs;
  onChange: (p: ChatPrefs) => void;
}) {
  const set = (patch: Partial<ChatPrefs>) => onChange({ ...prefs, ...patch });
  const toggleScope = (k: ScopeKey) =>
    set({
      scopes: prefs.scopes.includes(k) ? prefs.scopes.filter((x) => x !== k) : [...prefs.scopes, k],
    });
  const allScopesEnabled = prefs.scopes.length === SCOPE_DEFS.length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.13] via-background to-background p-4">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-foreground text-background shadow-sm">
            <LockKeyhole className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">あなたのペースで、見せる情報を決める</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              許可した情報だけを回答づくりに使います。いつでも変更でき、記録を勝手に保存することはありません。
            </p>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-2 border-t border-primary/15 pt-3 text-[11px] text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-primary" />
          現在 {prefs.scopes.length} / {SCOPE_DEFS.length} 項目を許可中
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          よく使う設定は入力欄のボタンからすぐ変更できます。ここでは、AIが参照できる範囲を細かく管理できます。
        </span>
      </p>

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
            <span className="block text-[11px] text-muted-foreground">
              オフのときは、まずヒントと考え方から案内します。
            </span>
          </span>
          <Switch checked={prefs.directAnswer} onCheckedChange={(v) => set({ directAnswer: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 border-t pt-2">
          <span className="min-w-0">
            <span className="block text-xs font-semibold">思考プロセスを表示する</span>
            <span className="block text-[11px] text-muted-foreground">
              生成中の考えを最初から開いた状態で表示します（Liteでは表示しません）。
            </span>
          </span>
          <Switch
            checked={prefs.autoOpenThinking}
            onCheckedChange={(v) => set({ autoOpenThinking: v })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 border-t pt-2">
          <span className="min-w-0">
            <span className="block text-xs font-semibold">出典リンクを表示する</span>
            <span className="block text-[11px] text-muted-foreground">
              Webを参照したとき、回答の下に情報源のリンクを付けます。
            </span>
          </span>
          <Switch checked={prefs.showSources} onCheckedChange={(v) => set({ showSources: v })} />
        </label>
      </div>

      <Section
        icon={ShieldCheck}
        title="AIに見せてよい情報"
        desc="オンの項目だけを、質問に関係するときに参照します。"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            学習データのアクセス範囲
          </span>
          <button
            type="button"
            className="text-[11px] font-semibold text-primary hover:underline"
            onClick={() => set({ scopes: allScopesEnabled ? [] : ALL_SCOPES })}
          >
            {allScopesEnabled ? "すべてオフ" : "すべて許可"}
          </button>
        </div>
        <div className="grid gap-2">
          {SCOPE_DEFS.map((s) => {
            const on = prefs.scopes.includes(s.key);
            const Icon = s.icon;
            return (
              <label
                key={s.key}
                className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${on ? "border-primary/35 bg-primary/[0.07] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_8%,transparent)]" : "bg-background/70 opacity-80 hover:opacity-100"}`}
              >
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    {s.label}
                    {on ? <Eye className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                    {s.desc}
                  </span>
                  <span className="mt-1.5 block text-[10px] leading-snug text-muted-foreground/80">
                    {on ? "質問に関係するときだけ参照します" : "この情報はAIに渡しません"}
                  </span>
                </span>
                <Switch
                  checked={on}
                  onCheckedChange={() => toggleScope(s.key)}
                  aria-label={`${s.label}の参照許可`}
                />
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
