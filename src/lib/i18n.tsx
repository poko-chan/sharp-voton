import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ja" | "en";
const LS_KEY = "studyplus.lang";

const dict = {
  ja: {
    "nav.dashboard": "ダッシュボード",
    "nav.study": "勉強記録",
    "nav.timer": "タイマー",
    "nav.calendar": "カレンダー",
    "nav.goals": "学習目標",
    "nav.questions": "問題生成",
    "nav.practice": "苦手演習",
    "nav.tutor": "AI家庭教師",
    "nav.coach": "AIコーチ",
    "nav.micro": "マイクロ学習",
    "nav.listen": "耳で学ぶ",
    "nav.classroom": "Voton Classroom",
    "nav.chat": "ユーザーチャット",
    "nav.announcements": "お知らせ",
    "nav.notifications": "通知",
    "nav.settings": "ユーザー設定",
    "nav.admin": "管理者ツール",
    "nav.logout": "ログアウト",
    "settings.language": "表示言語",
    "settings.language.desc": "アプリの表示言語を切り替えます（再読み込み不要）",
    "lang.ja": "日本語",
    "lang.en": "English",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.study": "Study Log",
    "nav.timer": "Timer",
    "nav.calendar": "Calendar",
    "nav.goals": "Goals",
    "nav.questions": "Question Maker",
    "nav.practice": "Practice",
    "nav.tutor": "AI Tutor",
    "nav.coach": "AI Coach",
    "nav.micro": "Micro Learning",
    "nav.listen": "Listen",
    "nav.classroom": "Voton Classroom",
    "nav.chat": "Chat",
    "nav.announcements": "Announcements",
    "nav.notifications": "Notifications",
    "nav.settings": "Settings",
    "nav.admin": "Admin Tools",
    "nav.logout": "Sign out",
    "settings.language": "Display Language",
    "settings.language.desc": "Switch the app language (no reload required)",
    "lang.ja": "日本語",
    "lang.en": "English",
  },
} as const;

type Key = keyof typeof dict.ja;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "ja",
  setLang: () => {},
  t: (k) => dict.ja[k] ?? k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ja";
    const v = localStorage.getItem(LS_KEY);
    return v === "en" ? "en" : "ja";
  });
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch { /* ignore */ }
  };
  const t = (k: Key) => (dict[lang][k] ?? dict.ja[k] ?? k) as string;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
