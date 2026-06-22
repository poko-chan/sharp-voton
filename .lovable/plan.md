# 一括改修プラン（17項目）

添付要望＋前回未完了分をまとめて実装します。DB → サーバ関数 → UI の順に進めます。

## A. 通知の全面整備
1. **サイト内通知の網羅化**
   - `notifications` に統一トリガを追加：
     - クラス投稿/コメント/ファイル追加 → クラスメンバーへ
     - DM受信、フレンド申請、いいね、Makron承認/却下、ショップ引換結果、組織申請結果、コインギフト、お知らせ追加
   - DBトリガ（`AFTER INSERT`）で `public.notifications` に行を入れる方式に統一。
2. **デスクトップ通知（Web Push 風）**
   - ブラウザの `Notification API` で OS 通知。`user_prefs.notify_desktop` を追加。
   - 通知作成を Supabase Realtime で購読 → 新規 row 受信時に `new Notification(title, { body, icon })`。
   - 通知設定ページ `/settings` に「デスクトップ通知を許可」トグル＋カテゴリ別 ON/OFF。

## B. 組織機能
3. **組織管理が開かない不具合**
   - `/organizations/$orgId` の権限判定を修正（`organization_members.role IN ('owner','admin')` で `canManage` 判定）。
   - 管理タブ（メンバー編集／参加申請承認／サービス制限）を実体化。
   - 「組織が使えない」原因：参加申請 RPC `org_review_join_request` 呼び出し時の引数不一致を修正。

## C. ショップ／コイン
4. **使えないアイテムを実用化**
   - 全 `coin_shop_items` に `usage_hint`/`applies_to` を埋め、新規 `/inventory` で「使う」ボタンを実装：
     - フレーム/テーマ/称号 → `profiles.active_*` に適用
     - ヒント券/復活/ブースト → Makron セッションで消費可能に
     - 宝箱 → ランダムコイン付与 RPC
     - 計算用紙/絵文字 → プロフィールデコ
5. **invalid amount エラー**
   - `purchase_shop_item` RPC で `price` が NULL/非整数のアイテムを弾いていた箇所を修正。管理者追加時 `price` を `int` 強制。
6. **管理者→全ユーザーへコイン一括配布**
   - 新 RPC `admin_grant_coins_to_all(_amount, _reason)`（admin限定）。管理画面に投与UI。

## D. Makron（学習）
7. **解答時の問題バージョン固定**
   - `makron_answers.question_snapshot jsonb` を追加し、回答時に問題本文/選択肢/正答をスナップショット。結果画面はスナップショット優先表示。
8. **短答で未回答なのに番号が緑になる**
   - セッション画面のナビ番号判定を `answers[i] !== undefined && answers[i] !== ''` に修正。
9. **解答形式の拡張**
   - `makron_questions.type` に `long_text`（長文記述）、`numeric`、`ordering`（並び替え）、`matching`（対応付け）、`fill_blank`（穴埋め）を追加。各UIコンポーネント実装。
10. **公式申請ができない／自動公式化**
    - `submit_official_request` RPC を新設。管理者が作成した問題はトリガで `is_official=true`、承認した問題は `approve_question` 内で `is_official=true` をセット。
11. **パック削除機能**
    - `/makron/pack/$packId` に「削除」ボタン（作成者 or admin）。RPC `delete_makron_pack` でカスケード削除。
12. **ダッシュボードが見れない**
    - `/makron/pack/$packId/dashboard` の権限/データ取得バグ修正（join 順を直して空配列で落ちないように）。
13. **演習中の上部ボタンに説明**
    - 各ボタンに `Tooltip` ＋ ラベル文字を併記（🚩後で見直す、📑スクラッチ、⏸一時停止、🚪退出、❓ヒント など）。
14. **OCR を「手書き→1秒静止で読取→下に表示・編集不可・スペース改行除去」に刷新**
    - `MakronHandwriteOCR` コンポーネント新設：
      - 横長キャンバス（フルスクリーン切替、ページ追加）
      - 最後の stroke から 1000ms 経過で自動 OCR 呼び出し
      - 結果は `result.replace(/\s+/g,'')` で表示、`readonly`
      - ページ毎独立、結合時もスペース無し
    - `ocr.functions.ts` に「単語/一行モード」プロンプトを追加。

## E. フィードバック
15. **フィードバック一括 → AI プロンプト送信**
    - 管理画面に複数選択チェックボックス＋「AI プロンプト用にまとめてコピー」「個別編集」「個別解除（除外）」「Chrome AI で要約」ボタン。
    - 選択中のフィードバックを 1 つのプロンプト文字列に整形 → クリップボード or Chrome AI へ送信。

## F. Chrome Built-in AI（前回からの継続改善）
16. **生成されない／リロードしないと反映されない問題**
    - `src/lib/chrome-ai.ts` を改修：
      - `availability()` チェック → `downloadable` 時に `create()` で DL 開始 → 進捗トースト
      - 各呼び出しで `session.destroy()` を確実化（メモリリーク回避）
      - 結果は React state へ即反映（`startTransition` で UI 更新保証）
      - 非対応サービス向けに「プロンプトをコピー → 外部AIへ」ボタンを共通コンポーネント化

## G. 残タスク（前回未完了）
17. **AvatarWithFrame / inventory ヒント / weakness モード UI / AI 採点 UI** を完成。

---

## 技術メモ
- DB マイグレーション 1 本（A1, B3, C4-6, D7,9,10,11, E15 用テーブル/RPC/トリガ追加）
- 主要追加ファイル：
  - `src/components/NotificationBell.tsx`（Realtime + Desktop Notification）
  - `src/components/AvatarWithFrame.tsx`
  - `src/components/makron/MakronHandwriteOCR.tsx`
  - `src/routes/_authenticated/inventory.tsx`
  - `src/lib/notifications-realtime.ts`
- 影響範囲が大きいので、ビルドは段階的に確認（マイグレーション後に types 再生成 → UI 実装）。

## 確認
全 17 項目をこのスコープで一気に実装します。**「OK」で着手します。**追加・除外したい項目があれば番号でお知らせください。
