# 実装計画

要望が大量なので、3ターンに分けて実装します。各ターン終了時に動作確認できます。

## ターン1: 基盤・認証まわり（軽め・即着手）

1. **フィードバック機能**
   - `feedback` テーブル新規（user_id nullable, email, category, body, route, user_agent, status, created_at, admin_reply）
   - ログイン画面・ログイン後の右下に共通フローティングボタン `<FeedbackWidget />`
   - 管理者画面に閲覧・返信タブ追加

2. **ログイン画面のお知らせ**
   - 既存 `announcements` テーブルに `show_on_login boolean` 追加
   - 管理画面で投稿時にチェック可
   - login.tsx 上部に最新3件カード表示

3. **プライバシーポリシー / 利用規約**
   - `/privacy` `/terms` ルート新規（私が日本語で起草、最終更新日を表示）
   - login と footer からリンク
   - 中身は `src/content/legal/*.tsx` に分離し、サイト更新時に私が追記

4. **新規登録に表示名**
   - signup フォームに display_name 入力追加
   - `signUp` の `options.data.display_name` に渡す（既存 trigger が拾う）

5. **MCJP_ ユーザー権限固定**
   - email or username が `mcjp_` で始まるユーザーは `user_roles` の変更を拒否
   - admin 画面のセレクトを disabled に
   - DB trigger でも保護（INSERT/UPDATE/DELETE on user_roles を block）

6. **超厳格アカウント削除**
   - 設定 → アカウント削除フロー：
     1. パスワード再入力
     2. メール宛 6桁コード送信→入力
     3. 「DELETE 自分のメール」を完全一致で入力
     4. 削除理由テキスト必須(20文字以上)
     5. 30日猶予（`profiles.deletion_scheduled_at` に日時記録、ログインのたびに「取り消す」案内）
     6. 30日経過後にバックグラウンドで物理削除（cron 用 server route）

## ターン2: 町を 3D 化＋ロジック刷新

7. **3D 町（react-three-fiber）**
   - `bun add three @react-three/fiber @react-three/drei`
   - `Town3D.tsx` 新規：見下ろし固定カメラ、回転のみ可、移動なし
   - ステージに応じて建物の高さ・密度・電車線路・公園・川などを手続き的に生成
   - 既存 `Town.tsx` の2D版は削除

8. **町ロジック刷新（AI送信廃止、勉強量比例）**
   - 「目標をAIに送って判定」は廃止
   - 新ルール（server fn `recomputeTown`）：
     - 過去7日の学習分(min) → スコア化
     - 平均比で stage を +1/-1/維持
     - 7日全く勉強なし → -2、3日連続0 → -1
     - 1日400分超の異常値は捨てる
     - max_stage_reached を超えたら新しい町を作るUI誘導
   - 自動再計算は学習ログ追加時 & ダッシュボード初回ロード時

## ターン3: 学習しない人向け＋UI

9. **マイクロ学習・受動学習・AIコーチ（全部）**
   - 新ルート `/micro`: AI 生成の1問1分クイズ
   - 新ルート `/listen`: 教科要約をAIで作って音声(Web Speech API)で再生
   - ダッシュボードに「AIコーチ」カード：未学習日数を見て声かけメッセージ
   - 連続未学習3日以上で町から通知

10. **新サイドバーボタン（その他＋カスタマイズ）**
    - サイドバーの全ナビ項目を `localStorage` で表示順・表示有無カスタマイズ
    - 設定 → 「サイドバー設定」UI
    - 非表示項目は「その他」ボタン展開で表示
    - プロフィール画像をサイドバー上部・ヘッダーに常時表示

11. **ダッシュボード反映遅延の修正**
    - React Query 化、`staleTime: 0`, ログ追加時に `invalidateQueries`
    - skeleton から実データ表示までの遷移を保証
    - 失敗時はリトライUI

## 技術メモ
- 3D は client-only。SSR 回避のため `ClientOnly` ラッパー使用
- 削除 30日 cron は `/api/public/cron/purge-accounts` + ヘッダ署名検証
- フィードバックは未ログイン挿入可にするため RLS で `user_id IS NULL` を許可

## 進め方
ターン1から順に実装し、各ターン終了で確認をもらいます。次は **ターン1** から着手してよいですか？
