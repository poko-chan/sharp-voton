import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Pencil, Eye, FileDown, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type CanvasDoc = { title: string; content: string; kind: string };

/** 右側のキャンバス：ドキュメント／レポート／スライドなどの成果物を表示・編集する */
export function CanvasPanel({
  doc, streaming, onChange, onClose, onExportPdf,
}: {
  doc: CanvasDoc;
  streaming?: boolean;
  onChange: (content: string) => void;
  onClose: () => void;
  onExportPdf: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l bg-card md:w-[420px] lg:w-[480px]">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{doc.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {streaming ? "作成中…" : "編集できます・PDFで保存できます"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {streaming && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-primary" />}
          <Button variant="ghost" size="icon" className="h-8 w-8" title={editing ? "プレビュー" : "編集"}
            onClick={() => setEditing((v) => !v)} disabled={streaming}>
            {editing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="コピー"
            onClick={async () => {
              try { await navigator.clipboard.writeText(doc.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }
              catch { toast.error("コピーできませんでした"); }
            }}>
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="PDFで書き出す" onClick={onExportPdf} disabled={streaming}>
            <FileDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="閉じる" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {editing ? (
          <Textarea value={doc.content} onChange={(e) => onChange(e.target.value)}
            className="min-h-[60dvh] w-full resize-none font-mono text-xs" />
        ) : (
          <div data-canvas-preview className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{doc.content + (streaming ? "▍" : "")}</ReactMarkdown>
          </div>
        )}
      </div>
    </aside>
  );
}

/** キャンバスの内容を印刷ダイアログ経由でPDF保存する */
export function printDoc(title: string, html: string) {
  const w = window.open("", "_blank", "width=860,height=1000");
  if (!w) { toast.error("ポップアップがブロックされました"); return; }
  w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.8;padding:40px;max-width:760px;margin:auto;color:#111}
h1{font-size:22px}h2{font-size:17px;margin-top:1.6em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;font-size:13px}
pre{background:#f5f5f5;padding:12px;border-radius:8px;overflow:auto;font-size:12px}</style></head>
<body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
