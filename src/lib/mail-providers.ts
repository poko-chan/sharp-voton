/** 受信トレイを開くためのメールプロバイダ定義（登録時のメール認証案内で使用） */
export type MailProvider = {
  key: string;
  name: string;
  url: string;
  /** このプロバイダに一致するメールドメイン */
  domains: string[];
  color: string;
};

export const MAIL_PROVIDERS: MailProvider[] = [
  { key: "gmail", name: "Gmail", url: "https://mail.google.com/mail/u/0/#search/StudyΩ", domains: ["gmail.com", "googlemail.com"], color: "#EA4335" },
  { key: "outlook", name: "Outlook", url: "https://outlook.live.com/mail/0/", domains: ["outlook.com", "outlook.jp", "hotmail.com", "hotmail.co.jp", "live.jp", "live.com", "msn.com"], color: "#0078D4" },
  { key: "icloud", name: "iCloud メール", url: "https://www.icloud.com/mail", domains: ["icloud.com", "me.com", "mac.com"], color: "#3693F3" },
  { key: "yahoo", name: "Yahoo!メール", url: "https://mail.yahoo.co.jp/", domains: ["yahoo.co.jp", "ybb.ne.jp", "yahoo.com"], color: "#6001D2" },
  { key: "docomo", name: "ドコモメール", url: "https://mail.smt.docomo.ne.jp/", domains: ["docomo.ne.jp"], color: "#CC0033" },
  { key: "au", name: "au メール", url: "https://webmail.au.com/", domains: ["au.com", "ezweb.ne.jp"], color: "#EB5505" },
  { key: "softbank", name: "SoftBank メール", url: "https://mail.softbank.jp/", domains: ["softbank.ne.jp", "i.softbank.jp"], color: "#B0B0B0" },
  { key: "proton", name: "Proton Mail", url: "https://mail.proton.me/", domains: ["proton.me", "protonmail.com"], color: "#6D4AFF" },
];

export function emailDomain(email: string): string {
  return email.split("@")[1]?.trim().toLowerCase() ?? "";
}

/** メールアドレスに対応するプロバイダ。不明なら null */
export function providerForEmail(email: string): MailProvider | null {
  const d = emailDomain(email);
  if (!d) return null;
  return MAIL_PROVIDERS.find((p) => p.domains.includes(d)) ?? null;
}
