// Local-time helpers (avoid the UTC-shift bug from toISOString().slice(0,10))
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysStr(base: Date, deltaDays: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + deltaDays);
  return localDateStr(d);
}

/** 日本時間 (Asia/Tokyo) の今日の日付 YYYY-MM-DD を返す。サーバ/ブラウザのタイムゾーンに依存しない。 */
export function jstDateStr(d: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d); // en-CA は YYYY-MM-DD 形式
}

/** ある日時を日本時間で表示用フォーマット */
export function jstFormat(iso: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    ...opts,
  }).format(d);
}

/** メッセージ一覧のセパレータ用ラベル（今日 / 昨日 / 2026年6月21日(日)） */
export function jstDayLabel(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const target = jstDateStr(d);
  const today = jstDateStr();
  const yest = jstDateStr(new Date(Date.now() - 86400000));
  if (target === today) return "今日";
  if (target === yest) return "昨日";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  }).format(d);
}
