import { useEffect, useRef } from "react";

/**
 * Google 翻訳ウィジェット（InlineLayout.SIMPLE）
 * サイト共通ヘッダーに配置し、ページ全体を無料で翻訳できるようにする。
 * AI Gateway は使用しない。
 */

const SCRIPT_ID = "google-translate-script";
const CONTAINER_ID = "google_translate_element";

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: new (
          options: { pageLanguage: string; layout: number },
          containerId: string,
        ) => unknown;
        TranslateElementInlineLayout?: { SIMPLE: number };
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

function getLayout() {
  const simple = window.google?.translate?.TranslateElementInlineLayout?.SIMPLE;
  if (typeof simple === "number") return simple;
  // fallback to known constant
  return 1;
}

function initWidget() {
  const el = document.getElementById(CONTAINER_ID);
  if (!el || el.querySelector(".goog-te-gadget")) return;
  if (!window.google?.translate?.TranslateElement) return;
  try {
    new window.google.translate.TranslateElement(
      { pageLanguage: "ja", layout: getLayout() },
      CONTAINER_ID,
    );
  } catch (e) {
    console.error("Google Translate init failed", e);
  }
}

export function GoogleTranslateWidget() {
  const didInit = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || didInit.current) return;
    didInit.current = true;

    window.googleTranslateElementInit = () => initWidget();

    if (document.getElementById(SCRIPT_ID)) {
      initWidget();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.body.appendChild(script);
  }, []);

  return (
    <div
      id={CONTAINER_ID}
      className="gt-widget inline-flex items-center h-8"
      data-no-translate
      aria-label="Google Translate"
    />
  );
}
