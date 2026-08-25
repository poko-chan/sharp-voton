import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { SectionHeading } from "./shared";

export function LanguageSection() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="space-y-6">
      <SectionHeading title="言語・翻訳" desc="表示言語を切り替えます" />
      <Card className="p-6 space-y-3">
        <div className="font-semibold">{t("settings.language")}</div>
        <p className="text-xs text-muted-foreground">{t("settings.language.desc")}</p>
        <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGS.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>
    </div>
  );
}
