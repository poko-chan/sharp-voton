import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Log = { date: string; duration_minutes: number; subjects?: { name?: string | null } | null };

// NotoSans 等の埋め込みは行わず、日本語は base font の限界に頼らない。
// jsPDF の組み込みフォントは日本語非対応 → 内容は英数記号で表現する。
// ラベルは Japanese -> ASCII translit を使う。
const L = {
  title: "Study Report",
  period: "Period",
  total: "Total minutes",
  active: "Active days",
  avg: "Avg / active day",
  daily: "Daily breakdown",
  bySubject: "By subject",
  date: "Date",
  minutes: "Minutes",
  subject: "Subject",
  generated: "Generated",
};

export type ReportRange = "week" | "month";

export function buildReport(logs: Log[], range: ReportRange) {
  const today = new Date();
  const days = range === "week" ? 7 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startStr = fmt(start);
  const endStr = fmt(today);

  const inRange = logs.filter((l) => l.date >= startStr && l.date <= endStr);
  const total = inRange.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);

  const dayMap = new Map<string, number>();
  inRange.forEach((l) => dayMap.set(l.date, (dayMap.get(l.date) ?? 0) + (l.duration_minutes ?? 0)));
  const activeDays = dayMap.size;
  const avg = activeDays ? Math.round(total / activeDays) : 0;

  const subjMap = new Map<string, number>();
  inRange.forEach((l) => {
    const k = l.subjects?.name ?? "(none)";
    subjMap.set(k, (subjMap.get(k) ?? 0) + (l.duration_minutes ?? 0));
  });

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(L.title, 14, 18);
  doc.setFontSize(11);
  doc.text(`${L.period}: ${startStr} - ${endStr}`, 14, 28);
  doc.text(`${L.total}: ${total}`, 14, 36);
  doc.text(`${L.active}: ${activeDays}`, 14, 44);
  doc.text(`${L.avg}: ${avg}`, 14, 52);

  autoTable(doc, {
    startY: 60,
    head: [[L.date, L.minutes]],
    body: Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, m]) => [d, String(m)]),
    styles: { fontSize: 9 },
  });

  const after = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  autoTable(doc, {
    startY: after + 10,
    head: [[L.subject, L.minutes]],
    body: Array.from(subjMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([n, m]) => [n, String(m)]),
    styles: { fontSize: 9 },
  });

  doc.setFontSize(8);
  doc.text(`${L.generated}: ${new Date().toISOString()}`, 14, doc.internal.pageSize.getHeight() - 10);
  doc.save(`study-report-${range}-${endStr}.pdf`);
}
