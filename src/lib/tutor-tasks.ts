// AIチャットの「…」メニューから選べる特別な作業（成果物づくり・リサーチ）の定義。
import { Telescope, FileText, Presentation, Table2, Workflow, CalendarClock } from "lucide-react";

export type TaskKind = "deep" | "doc" | "slides" | "table" | "diagram" | "plan";

export type TaskDef = {
  kind: TaskKind;
  label: string;
  desc: string;
  icon: any;
  /** 結果を右のキャンバスに出すか */
  canvas: boolean;
  /** 送信時にAIへ追加する指示 */
  instruction: string;
  placeholder: string;
};

export const TASK_DEFS: Record<TaskKind, TaskDef> = {
  deep: {
    kind: "deep",
    label: "ディープリサーチ",
    desc: "指定したサイトを調べて、根拠つきのレポートにまとめます",
    icon: Telescope,
    canvas: true,
    instruction:
      "収集した資料をもとに、調査レポートを書いてください。構成は「要約」「わかったこと（箇条書き）」「詳細（見出しごと）」「まだ不明な点」。事実には [1] のように資料番号を付け、資料にないことは推測せず不明と書くこと。",
    placeholder: "調べたいテーマを書いてください（例：日本の高校無償化の現状）",
  },
  doc: {
    kind: "doc",
    label: "ドキュメントを作る",
    desc: "見出し付きの読みやすい文書を作り、右で編集できます",
    icon: FileText,
    canvas: true,
    instruction:
      "指示された内容のドキュメントをマークダウンで作成してください。冒頭にタイトル(#)、そのあと見出し(##)で章立てし、本文は読みやすい段落で書くこと。前置きや説明文は書かず、ドキュメント本体だけを出力すること。",
    placeholder: "作りたい文書の内容を書いてください（例：光合成のまとめレポート）",
  },
  slides: {
    kind: "slides",
    label: "スライドを作る",
    desc: "発表用のページ構成と各ページの本文を作ります",
    icon: Presentation,
    canvas: true,
    instruction:
      "発表用スライドの構成を作ってください。各ページを「## スライド1: タイトル」の見出しで区切り、その下に箇条書き3〜5行と、必要なら「話す内容:」を1〜2文添えること。全体で6〜10ページ。スライド本体だけを出力すること。",
    placeholder: "発表したいテーマを書いてください（例：地球温暖化の対策 5分発表）",
  },
  table: {
    kind: "table",
    label: "比較表を作る",
    desc: "項目を整理した表（マークダウン）を作ります",
    icon: Table2,
    canvas: true,
    instruction:
      "内容をマークダウンの表に整理してください。1行目に列見出しを置き、比較軸は3つ以上にすること。表のあとに、表からわかることを3行以内で添えること。",
    placeholder: "比較したい内容を書いてください（例：参考書3冊の比較）",
  },
  diagram: {
    kind: "diagram",
    label: "図解を作る",
    desc: "流れ図・関係図を Mermaid 記法で作ります",
    icon: Workflow,
    canvas: true,
    instruction:
      "内容を図解してください。```mermaid のコードブロック1つで flowchart TD を書き、日本語ラベルは必ず [\"...\"] のように二重引用符で囲むこと。コードブロックのあとに、図の読み方を3行以内で説明すること。",
    placeholder: "図にしたい内容を書いてください（例：細胞分裂の流れ）",
  },
  plan: {
    kind: "plan",
    label: "学習プランを作る",
    desc: "試験日から逆算した週ごとの計画表を作ります",
    icon: CalendarClock,
    canvas: true,
    instruction:
      "学習プランを作ってください。まず前提（期間・目標・1日の学習可能時間）を短く整理し、次に週ごとの表（週 / 範囲 / やること / 目安時間）、最後に「つまずいたときの調整方法」を3つ書くこと。",
    placeholder: "目標と期限を書いてください（例：3週間後の数学の期末で80点）",
  },
};

export const TASK_GROUPS: { label: string; kinds: TaskKind[] }[] = [
  { label: "調べる", kinds: ["deep"] },
  { label: "成果物を作る", kinds: ["doc", "slides", "table", "diagram"] },
  { label: "学習を組み立てる", kinds: ["plan"] },
];

/** 「site:example.com」形式の検索クエリを作る */
export function buildSiteQueries(query: string, sites: string[]): string[] {
  const clean = sites.map((s) => s.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean);
  if (!clean.length) return [query];
  return clean.slice(0, 4).map((d) => `site:${d} ${query}`);
}
