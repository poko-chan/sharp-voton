
# 一括実装プラン（17項目）

ご要望リストをカテゴリ別に整理し、DBマイグレーション → サーバ関数/RPC → UI の順で一気に実装します。スコープが大きいので、まず方針を確認させてください。

## A. ショップ／インベントリ系
1. **購入アイテムが使えない問題の改善**
   - `user_inventory` の各 `item_code` ごとに「どこで使えるか」のヘルプリンク・適用先 UI を `shop.tsx` と新規 `inventory.tsx` に追加。
   - `payload` に `usage_hint` `applies_to` を持たせ、ショップ詳細でも明示。
2. **フレームの表示場所**
   - `profiles.active_frame` カラム追加（既存があれば再利用）。インベントリから「装着」ボタン → アバター枠に適用。Profile / Leaderboard / Town / コメントなど、アバター表示箇所すべてに `<AvatarWithFrame />` コンポーネントを共通化。

## B. ミッション
3. **日本時間（JST）でのリセット**
   - `daily_missions.date` の判定を `Asia/Tokyo` 基準に統一。RPC `current_jst_date()` を作成し、生成・進捗・完了を全て JST 日付で処理。クライアント側もJSTで表示。

## C. Makron（学習機能）— 一番ボリューム大
4. **採点で「演習した問題以外」が出る不具合**
   - `finalize_makron_session` / 履歴表示で、表示する問題を `makron_answers.session_id = _session_id` に限定。「同単元の他問題」結合を削除。
5. **手書きOCR回答**
   - 問題演習画面に「✍️ 手書きで答える」モード。`canvas` → 画像 → 既存 `ocr.functions.ts` (Lovable AI Vision) で文字起こし → そのまま回答欄へ。
6. **「後で見直す」フラグ**
   - `makron_answers.review_flag boolean` 追加。演習中に🚩ボタン、結果画面で一覧。
7. **間違えた問題で苦手演習**
   - 「苦手モード」セッション起動 RPC `makron_start_weakness_session(_unit_id, _limit)` 追加。直近の不正解問題からランダム抽出。
8. **演習後もブックマーク**
   - 結果画面 / 履歴詳細でも `makron_bookmarks` の追加/削除 UI。
9. **経過時間表示（制限時間なしでも）**
   - `makron_sessions.elapsed_seconds` を `finished_at - started_at` から導出し結果画面に常時表示。
10. **AI採点機能**
    - `type='text'` の問題に対し、Chrome Built-in AI で「模範解答との一致度を 0–100 で採点、コメント付与」。Chrome AI 不可ならローカル類似度フォールバック。

## D. チャット
11. **日付の表示**（user-chat / class-chat）
    - メッセージ一覧で日付が変わるごとに「2026年6月21日」セパレータを挿入。
12. **友達のみ DM**
    - `chat_messages` 送信時、`are_mutual_friends(sender, recipient)` を RPC `send_dm` でチェック。フレンド外は送信不可＆UIで非表示。

## E. 管理者連絡チャネル（フィードバックとは別）
13. **「管理者への要望チャット」**
    - 新テーブル `admin_request_categories`（管理者が自由に追加）、`admin_request_threads`、`admin_request_messages`。
    - ユーザー画面: カテゴリ選択 → スレッド作成 → 1対1チャット。
    - 管理者側は **`/admin/announcements`（管理者告知ページ）配下** に「ユーザー要望」タブを設置（フィードバックダッシュボードには出さない）。

## F. 共通 UI
14. **フィードバックボタンを全ページ常設**
    - `AppShell` のヘッダ右上に常設。AccountSwitcher の右隣にコンパクトな縦バー風（hover で展開）。既存 `FeedbackWidget` をその場所に統一移動。

---

## 確認したいこと
1. **スコープ**: 17項目すべてを「一気に」実装します（部分省略なし）。**この内容で進めて OK ですか？**
2. **フレームの適用範囲**: アバター表示の全箇所に枠を出す方針（Profile/ランキング/タウン/コメント等）で良いですか？特定の場所だけにする？
3. **管理者要望チャット**: 「ユーザー1人 ↔ 管理者全体」の1対1スレッド型で OK？（複数管理者が同じスレッドに返信できる形）

「OK、進めて」と返信いただければ DB マイグレーション → コードの順で着手します。
