## Phase 1: 今回指示分（一括実装）

### 1. Markon調整

- 手書きOCRの「ファイル読み込み/アップロード」UIを削除（キャンバス手書きのみ残す）。`MakronHandwriteOCR.tsx` は既にアップロード無いので、`ocr.tsx`画面のファイルアップロード機能と参照を削除。
- **記述問題のAI採点**: `makron_questions.question_type='written'` 用に `gradeWrittenAnswer` server fn を新設（Gemini）。模範解答との意味的一致度・部分点・フィードバックを返す。セッション画面で記述問題提出時に呼び出し。

### 2. デザイン刷新（Study+ 全体）

新デザイントークン（`src/styles.css`）：

- 配色: ベース `#0B0E1A`（深紺）／サーフェス `#141828`／アクセント `#7B6CFF`（紫）＋ `#34D7B5`（ミント）／テキスト `#F2F4FB`。
- 角丸 `--radius: 14px`、ガラスモーフ `backdrop-blur` のサーフェスクラス `.glass`。
- フォント: 見出し `Zen Kaku Gothic New`、本文 `Inter` + `Noto Sans JP`（`__root.tsx` で`<link>` 追加）。
- ライト/ダーク両対応。既存セマンティックトークンの値だけ差し替え（コンポーネントは触らない）。
- `AppShell.tsx` のサイドバー・ヘッダーを新トークンに合わせて装飾刷新（構造は維持）。
- ログイン画面 `login.tsx` をヒーロー＋ガラスカードに刷新。

### 3. ログイン演出 + 掲示板

- 新テーブル `login_boards`（id, title, body, audience 'all'|'user', target_user_id?, version int, active bool, created_by, created_at）。GRANT + RLS。
- 新テーブル `user_board_seen`（user_id, board_version, seen_at）。
- 新コンポーネント `LoginWelcomeOverlay.tsx`：
  - 「Welcome, {ユーザー名}」を3秒表示 → 上方フェード／スライド → 下から掲示板スライドイン（Framer Motion 風だが既存の Tailwind animate でOK、派手すぎず上品に）。
  - 「閉じる」で `user_board_seen` 記録。
- `_authenticated/route.tsx`（管理外）には触れず、`AppShell.tsx` でマウント＆発火（セッション毎に1回）。
- 管理ダッシュボード `admin.tsx` に「ログイン掲示板」タブ追加：
  - 全体/個別投稿の作成・編集・削除。
  - グローバルスイッチ「これ以降にログインしたユーザーの演出をスキップ」（`app_settings.login_overlay_enabled`）。
  - スキップ時は「アップデート内容」ページ `/updates` で詳細閲覧可能。
- 新ルート `/updates`：管理者が書いた最新版＋履歴を表示。

## Phase 2: 学習支援系 1-6（続けて一括）

1. **AI弱点ヒートマップ** `/heatmap`：単元×正答率の2Dマップ（`makron_answers` 集計 → recharts ScatterChart で色濃度）。
2. **間違い直しノート自動生成**：誤答だけ集めた問題セットを `/mistakes` で出題＋PDFエクスポート（既存 `report-pdf.ts` 流用）。
3. **学習ストリーク保険（週次トークン）**：既存 `streak_freezes` を拡張。`weekly_streak_tokens`（週1回自動付与）テーブル新設、`/streak` にトークン消費ボタン。
4. **ポモドーロ深掘り統計**：`focus_logs` に `idle_seconds`, `focus_score` 追加。`/timer` でタブ非アクティブ時の離席検知、`/dashboard` に集中度カーブ。
5. **AI模試生成**：`generateMockExam` server fn → 単元と問題数を指定して `makron_packs` をAI生成（既存 AiPackImportDialog の拡張）。
6. **逆算スケジューラ**：試験日と教材残量から日割り。`exams` × `materials.total_pages` から `/exams/$examId` に「日割り計画」タブを追加、`study_plans` に保存。

## マイグレーション

- `20260630_login_boards_and_support.sql`：login_boards / user_board_seen / weekly_streak_tokens / focus_logs拡張 / app_settings.login_overlay_enabled。全て GRANT + RLS。

実装範囲が広いが、計画通りすべて一気に行う。

そして、クレジットが残り3.6しかない。だから、最高のものを作るが、クレジットは食わないように設定してくれ。(もしあなたのＡＩが編集できるのであれば。そして、外部が制御されるのであれば、うまくやってくれ。)