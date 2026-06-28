## テスト点数機能（100%）と教材強化（99%）

前回の続き（OCR/Enterキー/見直し色/AIプロンプトコピー）は完了済みです。今回は以下を一括で実装します。

### A. テスト点数機能（試験トラッカー）

#### 1. DB（マイグレーション1本）
- `exam_series`: 試験シリーズ（定期テスト等の共通枠）。`name`, `user_id`。
- `exams`: 試験本体。`series_id?`, `name`, `start_date`, `end_date`, `note`。
- `exam_subjects`: 教科別。`exam_id`, `name`, `max_score`, `target_score`, `actual_score?`, `exam_date`, `order_no`, `duration_min`, `study_subject_ids uuid[]`（StudyのSubject IDの配列＝換算対象）, `reflection`, `time_satisfaction int`, `content_satisfaction int`。
- `exam_todos`: やることリスト。`exam_subject_id`, `text`, `done`, `done_at`, `coin_awarded bool`。
- RPC `complete_exam_todo(_id uuid)`: doneに切替＋未付与なら10コイン付与（`user_coins` を inc、`coin_transactions` 記録）。
- RLS: 全テーブル `auth.uid() = user_id`（exam_subjects/todoは親exam→user_id辿る）。

#### 2. UI
- `/exams`（一覧）：シリーズでグルーピング表示。新規作成ボタン。
- `/exams/$examId`：教科タブ。各教科で
  - 基本情報（試験日・順番・時間・満点・目標点・換算する勉強教科を複数選択）
  - やることリスト（追加/チェック→10コイン）
  - 試験後：自己点数、振り返り、満足度2軸
- シリーズ比較ページ `/exams/series/$seriesId`：教科ごとの「勉強時間 vs 点数」推移グラフ（recharts）。同教科名＋同満点＋同`study_subject_ids`が揃ったexamのみ比較対象。
- 左ナビに「試験」を追加。

### B. 教材強化（99%）

#### 1. DB
- `materials.favorite bool default false` 追加。
- `time_entries.material_ids uuid[] default '{}'` 追加（既に `material_id` があれば配列も追加して両対応）。
- `study_logs.material_ids uuid[]` 追加。
- インデックス：favorite, material_ids GIN。

#### 2. UI
- `/materials`：お気に入り（★）がトップに来るよう並び替え＋トグル。
- タイマー（Stopwatch/Countdown/Pomodoro）：開始前に教材を**複数選択**できるMultiSelect。終了時に`time_entries.material_ids`へ保存。
- 勉強記録の編集（`study.tsx`）：教材を複数追加できるピッカー。
- ダッシュボード：教材別の累計時間（過去30日）バーチャート。

### 技術メモ
- マイグレーション1本：`20260628_exams_and_material_links.sql`。GRANT忘れず。
- 教材MultiSelectは共通 `MaterialPicker.tsx` を新設しタイマー/学習記録で再利用。
- 比較グラフは recharts（既存導入済み）。
- ナビ追加は `AppShell.tsx`。

実装範囲が広いので**この計画通り一括実装**します。除外したい項目があれば番号でお知らせください。OKならそのまま着手します。