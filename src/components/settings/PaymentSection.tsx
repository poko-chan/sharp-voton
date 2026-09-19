import { BadgeCheck, CreditCard, LockKeyhole, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "./shared";

const FEATURES = [
  { icon: CreditCard, title: "かんたんなお支払い", desc: "安全な決済画面から手続きできるようになります。" },
  { icon: ReceiptText, title: "契約内容をまとめて確認", desc: "利用中のプランやお支払い履歴をここで確認できます。" },
  { icon: LockKeyhole, title: "安全性を重視", desc: "カード情報をStudy#内に保存しない仕組みを予定しています。" },
];

export function PaymentSection() {
  return (
    <div className="space-y-5">
      <SectionHeading title="お支払い" desc="Study#のプランとお支払いを管理します。" />

      <Card className="overflow-hidden border-primary/20">
        <div className="border-b bg-muted/40 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-semibold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" />
              近日提供予定
            </span>
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">お支払い機能を準備しています</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            より便利にStudy#をご利用いただけるプランを準備中です。提供開始後、この画面から内容の確認と手続きができるようになります。
          </p>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card p-5">
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        現在は料金の請求や購入手続きは行われません。提供内容と開始時期は、決まり次第お知らせします。
      </p>
    </div>
  );
}