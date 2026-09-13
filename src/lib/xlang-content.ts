// Xlang 学習コンテンツ（端末内完結・サーバー不要）
export type XEx =
  | { type: "wordbank"; ja: string; en: string; distractors: string[] }
  | { type: "choice"; prompt: string; options: string[]; answer: number; note?: string }
  | { type: "listen"; en: string; ja: string; options: string[]; answer: number }
  | { type: "match"; pairs: [string, string][] }
  | { type: "type"; ja: string; en: string; alts?: string[] }
  | { type: "speak"; en: string; ja: string };

export type XLesson = {
  id: string;
  title: string;
  icon: "star" | "book" | "chat" | "trophy" | "coffee" | "plane";
  exercises: XEx[];
};

export type XUnit = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  hue: string; // tailwind-safe token class
  lessons: XLesson[];
};

export const XLANG_UNITS: XUnit[] = [
  {
    id: "u1",
    number: "01",
    title: "First steps",
    subtitle: "あいさつと自己紹介",
    hue: "from-emerald-500/20 to-emerald-500/5",
    lessons: [
      {
        id: "u1l1",
        title: "あいさつ",
        icon: "star",
        exercises: [
          {
            type: "choice",
            prompt: "「はじめまして」に近い英語は？",
            options: ["Nice to meet you.", "See you later.", "I am hungry.", "Good night."],
            answer: 0,
            note: "初対面のあいさつです。",
          },
          {
            type: "wordbank",
            ja: "おはようございます。",
            en: "Good morning",
            distractors: ["night", "bye", "thanks"],
          },
          {
            type: "listen",
            en: "How are you today?",
            ja: "今日は調子どう？",
            options: ["今日は調子どう？", "どこに住んでるの？", "何時ですか？", "元気でね。"],
            answer: 0,
          },
          {
            type: "match",
            pairs: [
              ["hello", "こんにちは"],
              ["thank you", "ありがとう"],
              ["sorry", "ごめんなさい"],
              ["goodbye", "さようなら"],
            ],
          },
          {
            type: "type",
            ja: "ありがとうございます。",
            en: "Thank you",
            alts: ["thank you very much", "thanks"],
          },
        ],
      },
      {
        id: "u1l2",
        title: "自己紹介",
        icon: "book",
        exercises: [
          {
            type: "wordbank",
            ja: "私はケンです。",
            en: "I am Ken",
            distractors: ["is", "you", "are"],
          },
          {
            type: "choice",
            prompt: "“Where are you from?” の意味は？",
            options: ["出身はどこ？", "どこに行くの？", "誰と来たの？", "何が好き？"],
            answer: 0,
          },
          {
            type: "type",
            ja: "私は日本出身です。",
            en: "I am from Japan",
            alts: ["i'm from japan"],
          },
          {
            type: "match",
            pairs: [
              ["name", "名前"],
              ["student", "学生"],
              ["friend", "友だち"],
              ["family", "家族"],
            ],
          },
          { type: "speak", en: "Nice to meet you.", ja: "はじめまして。" },
        ],
      },
      {
        id: "u1l3",
        title: "数と時間",
        icon: "coffee",
        exercises: [
          {
            type: "choice",
            prompt: "“seventeen” は？",
            options: ["17", "70", "7", "27"],
            answer: 0,
          },
          {
            type: "wordbank",
            ja: "今、3時です。",
            en: "It is three o'clock",
            distractors: ["four", "was", "minute"],
          },
          {
            type: "listen",
            en: "What time is it?",
            ja: "今何時ですか？",
            options: ["今何時ですか？", "どんな天気？", "いくらですか？", "誰ですか？"],
            answer: 0,
          },
          { type: "type", ja: "私は8時に起きます。", en: "I get up at eight" },
          {
            type: "match",
            pairs: [
              ["morning", "朝"],
              ["noon", "正午"],
              ["evening", "夕方"],
              ["tonight", "今夜"],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "u2",
    number: "02",
    title: "Daily life",
    subtitle: "毎日のことばと習慣",
    hue: "from-sky-500/20 to-sky-500/5",
    lessons: [
      {
        id: "u2l1",
        title: "一日の流れ",
        icon: "book",
        exercises: [
          {
            type: "wordbank",
            ja: "私は毎日勉強します。",
            en: "I study every day",
            distractors: ["studies", "yesterday", "much"],
          },
          {
            type: "choice",
            prompt: "“She usually walks to school.” の usually は？",
            options: ["たいてい", "まったく", "昨日", "とても"],
            answer: 0,
          },
          { type: "type", ja: "私は朝ごはんを食べます。", en: "I eat breakfast" },
          {
            type: "listen",
            en: "I go to bed at eleven.",
            ja: "私は11時に寝ます。",
            options: ["私は11時に寝ます。", "私は11時に起きます。", "私は11歳です。", "11時に会おう。"],
            answer: 0,
          },
          {
            type: "match",
            pairs: [
              ["breakfast", "朝食"],
              ["homework", "宿題"],
              ["dinner", "夕食"],
              ["weekend", "週末"],
            ],
          },
        ],
      },
      {
        id: "u2l2",
        title: "買い物",
        icon: "coffee",
        exercises: [
          {
            type: "choice",
            prompt: "値段を聞くときは？",
            options: ["How much is it?", "How many are you?", "What color?", "Where is it?"],
            answer: 0,
          },
          {
            type: "wordbank",
            ja: "これをください。",
            en: "I will take this one",
            distractors: ["them", "never", "give"],
          },
          { type: "type", ja: "高すぎます。", en: "It is too expensive", alts: ["it's too expensive"] },
          {
            type: "match",
            pairs: [
              ["cheap", "安い"],
              ["price", "値段"],
              ["receipt", "レシート"],
              ["change", "おつり"],
            ],
          },
          { type: "speak", en: "How much is this?", ja: "これはいくらですか？" },
        ],
      },
      {
        id: "u2l3",
        title: "場所と道案内",
        icon: "plane",
        exercises: [
          {
            type: "wordbank",
            ja: "駅はどこですか？",
            en: "Where is the station",
            distractors: ["when", "are", "airport"],
          },
          {
            type: "choice",
            prompt: "“Turn left at the corner.” の意味は？",
            options: ["角を左に曲がる", "角で止まる", "右に曲がる", "まっすぐ進む"],
            answer: 0,
          },
          {
            type: "listen",
            en: "It is next to the library.",
            ja: "図書館のとなりです。",
            options: ["図書館のとなりです。", "図書館の中です。", "学校の前です。", "駅の裏です。"],
            answer: 0,
          },
          { type: "type", ja: "まっすぐ行ってください。", en: "Go straight" },
          {
            type: "match",
            pairs: [
              ["station", "駅"],
              ["hospital", "病院"],
              ["bridge", "橋"],
              ["corner", "角"],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "u3",
    number: "03",
    title: "Real conversations",
    subtitle: "会話を組み立てる",
    hue: "from-violet-500/20 to-violet-500/5",
    lessons: [
      {
        id: "u3l1",
        title: "気持ちを伝える",
        icon: "chat",
        exercises: [
          {
            type: "wordbank",
            ja: "私はそれが好きではありません。",
            en: "I do not like it",
            distractors: ["likes", "very", "am"],
          },
          {
            type: "choice",
            prompt: "“I'm looking forward to it.” は？",
            options: ["楽しみにしています", "心配しています", "疲れています", "怒っています"],
            answer: 0,
          },
          { type: "type", ja: "うれしいです。", en: "I am happy", alts: ["i'm happy"] },
          {
            type: "match",
            pairs: [
              ["tired", "疲れた"],
              ["excited", "わくわくした"],
              ["nervous", "緊張した"],
              ["proud", "誇らしい"],
            ],
          },
          { type: "speak", en: "I am really glad to hear that.", ja: "それを聞けてとてもうれしいです。" },
        ],
      },
      {
        id: "u3l2",
        title: "過去のできごと",
        icon: "trophy",
        exercises: [
          {
            type: "choice",
            prompt: "“go” の過去形は？",
            options: ["went", "goed", "gone", "going"],
            answer: 0,
          },
          {
            type: "wordbank",
            ja: "私は昨日、映画を見ました。",
            en: "I watched a movie yesterday",
            distractors: ["watch", "tomorrow", "will"],
          },
          { type: "type", ja: "私は京都に行きました。", en: "I went to Kyoto" },
          {
            type: "listen",
            en: "We had a great time.",
            ja: "私たちは楽しい時間を過ごしました。",
            options: [
              "私たちは楽しい時間を過ごしました。",
              "私たちは時間がありません。",
              "私たちは遅刻しました。",
              "私たちは会う予定です。",
            ],
            answer: 0,
          },
          {
            type: "match",
            pairs: [
              ["saw", "見た"],
              ["ate", "食べた"],
              ["bought", "買った"],
              ["met", "会った"],
            ],
          },
        ],
      },
      {
        id: "u3l3",
        title: "お願いと提案",
        icon: "chat",
        exercises: [
          {
            type: "wordbank",
            ja: "手伝ってもらえますか？",
            en: "Could you help me",
            distractors: ["should", "helps", "we"],
          },
          {
            type: "choice",
            prompt: "“Why don't we take a break?” は？",
            options: ["休憩しませんか？", "休んではいけない", "なぜ休んだの？", "休みは終わり"],
            answer: 0,
          },
          { type: "type", ja: "窓を開けてもいいですか？", en: "May I open the window", alts: ["can i open the window"] },
          {
            type: "match",
            pairs: [
              ["please", "どうぞ"],
              ["maybe", "たぶん"],
              ["of course", "もちろん"],
              ["let's", "〜しよう"],
            ],
          },
          { type: "speak", en: "Could you say that again, please?", ja: "もう一度言っていただけますか？" },
        ],
      },
    ],
  },
];

export const ALL_LESSONS = XLANG_UNITS.flatMap((u) =>
  u.lessons.map((l) => ({ ...l, unitId: u.id })),
);

export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
