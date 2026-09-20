// バックエンド（クラウド）で動く LLM のカタログ。端末のスペックに関係なく使える。
export type CloudModel = {
  id: string;
  name: string;
  vendor: "openai" | "google";
  /** おすすめ度（大きいほど上に出る） */
  score: number;
  note: string;
  /** 目安の速さ・賢さ表示用 */
  speed: "very-fast" | "fast" | "normal" | "slow";
  /** 画像を読み取れる */
  vision?: boolean;
  tags?: Array<"japanese" | "reasoning" | "math" | "code" | "light" | "pro">;
};

export const CLOUD_MODELS: CloudModel[] = [
  {
    id: "openai/gpt-6-astra",
    name: "GPT-6 Astra",
    vendor: "openai",
    score: 99,
    speed: "slow",
    vision: true,
    note: "いちばん賢い最上位モデル。難しい記述問題や長い説明に強いですが、返答はゆっくりです。",
    tags: ["reasoning", "math", "japanese", "pro"],
  },
  {
    id: "openai/gpt-5.5-pro",
    name: "GPT-5.5 Pro",
    vendor: "openai",
    score: 95,
    speed: "slow",
    vision: true,
    note: "じっくり考えるタイプ。入試レベルの数学や論述の添削におすすめ。",
    tags: ["reasoning", "math", "pro"],
  },
  {
    id: "openai/gpt-5.5",
    name: "GPT-5.5",
    vendor: "openai",
    score: 90,
    speed: "normal",
    vision: true,
    note: "賢さと速さのバランスが良い万能モデル。ふだんの質問はこれで十分です。",
    tags: ["reasoning", "japanese"],
  },
  {
    id: "openai/gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    vendor: "openai",
    score: 88,
    speed: "normal",
    vision: true,
    note: "説明がていねいで、考え方の手順を追いやすいモデル。",
    tags: ["reasoning", "japanese"],
  },
  {
    id: "openai/gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    vendor: "openai",
    score: 86,
    speed: "normal",
    vision: true,
    note: "長い文章の読み取りや要約が得意です。",
    tags: ["japanese", "reasoning"],
  },
  {
    id: "openai/gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    vendor: "openai",
    score: 84,
    speed: "fast",
    vision: true,
    note: "軽快に動くバランス型。会話のテンポを重視したいときに。",
    tags: ["light"],
  },
  {
    id: "openai/gpt-5.4",
    name: "GPT-5.4",
    vendor: "openai",
    score: 82,
    speed: "normal",
    vision: true,
    note: "安定して使える標準モデル。",
    tags: ["japanese"],
  },
  {
    id: "openai/gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    vendor: "openai",
    score: 74,
    speed: "fast",
    vision: true,
    note: "軽くて速い小型モデル。かんたんな質問や下書き向け。",
    tags: ["light"],
  },
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    vendor: "openai",
    score: 66,
    speed: "very-fast",
    vision: true,
    note: "いちばん軽いモデル。短い質問にすぐ答えます。",
    tags: ["light"],
  },
  {
    id: "openai/chat-latest",
    name: "ChatGPT Latest",
    vendor: "openai",
    score: 80,
    speed: "fast",
    vision: true,
    note: "おしゃべりが自然なチャット向けモデル。考え込まずすぐ答えます。",
    tags: ["japanese", "light"],
  },
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    vendor: "google",
    score: 92,
    speed: "normal",
    vision: true,
    note: "Google の高性能モデル。日本語と画像の読み取りが得意です。",
    tags: ["japanese", "reasoning", "pro"],
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    vendor: "google",
    score: 89,
    speed: "very-fast",
    vision: true,
    note: "とても速いのに賢い、いちばん扱いやすいモデル。迷ったらこれ。",
    tags: ["japanese", "light"],
  },
  {
    id: "google/gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    vendor: "google",
    score: 85,
    speed: "very-fast",
    vision: true,
    note: "高速モデル。長文の要約や暗記カード作りに向いています。",
    tags: ["japanese", "light"],
  },
  {
    id: "google/gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    vendor: "google",
    score: 83,
    speed: "very-fast",
    vision: true,
    note: "安定して速い日常使いのモデル。",
    tags: ["japanese", "light"],
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    vendor: "google",
    score: 78,
    speed: "very-fast",
    vision: true,
    note: "軽量で反応が早いモデル。",
    tags: ["light"],
  },
  {
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    vendor: "google",
    score: 70,
    speed: "very-fast",
    vision: true,
    note: "最軽量。かんたんな用途や大量処理向け。",
    tags: ["light"],
  },
];

export const DEFAULT_CLOUD_MODEL = "google/gemini-3.8-flash";

export const SPEED_LABELS: Record<CloudModel["speed"], string> = {
  "very-fast": "とても速い",
  fast: "速い",
  normal: "ふつう",
  slow: "ゆっくり（じっくり考える）",
};

export function findCloudModel(id: string): CloudModel | undefined {
  return CLOUD_MODELS.find((m) => m.id === id);
}
