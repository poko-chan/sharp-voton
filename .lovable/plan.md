# Makron 問題演習ツール — 実装計画

巨大な機能群なので、構成を明確に整理してから一気に実装します。

---

## 1. Makron 全体像

専用ルート `/makron/*` を作り、`_authenticated` 配下に置きつつ **AppShellを使わない独自レイアウト**（フルスクリーン + 上部専用バー）にします。AIは絶対に使いません（lovable gatewayの）

- `/makron` … ダッシュボード（単元一覧、ランキング、自分のXP/レベル）
- `/makron/admin` … 管理者専用：単元作成、問題作成・編集
- `/makron/unit/$unitId` … 単元詳細（問題開始）
- `/makron/session/$sessionId` … 問題演習画面（1問ずつ進む、計算用紙付き）
- `/makron/result/$sessionId` … 採点ダッシュボード（点数・プロンプト生成・報告）
- `/makron/history` … 過去の受験履歴

上部バー：左にMakronロゴ＆メニュー（戻る）、中央に単元/進捗、右に「管理者」ボタン（非管理者は disabled）。

---

## 2. データベース設計（新規テーブル）

```text
makron_units             単元
  id, title, subject, field, unit, description, created_by, order_idx
makron_questions         問題
  id, unit_id, order_idx, prompt, image_url, type(single|multi|text|written|file),
  options (jsonb), correct_options (jsonb), accepted_answers (jsonb 文字列配列),
  model_answer (text), explanation, points (int), grading (auto|manual)
makron_sessions          受験セッション
  id, user_id, unit_id, started_at, finished_at, scratchpad (jsonb)
makron_answers           各回答
  id, session_id, question_id, answer (jsonb), file_url, auto_correct (bool|null),
  manual_score (int|null), manual_comment,feedback_prompt, awarded_points
makron_xp                XP / レベル
  user_id pk, xp int, level int, coins_earned int
makron_reports           報告（不正確等）
  id, user_id, question_id, category (12種以上), suggested_answer, note, status
```

XPはトリガではなくサーバーfn内で加算（合否確定時のみ）。コインも同様にこのfn内で `user_coins` 加算。

---

## 3. 演習フロー

- セッション開始 → 順番に問題表示。回答を保存しながら次へ進める。前にも戻れる。
- 各問題横に「計算用紙」（canvas落書き）。`session.scratchpad` に保存。「ダウンロード」(.png)も可能。
- 自動採点可能タイプ（single/multi/text）はサブミット時に判定。manualは pending。
- 完了 → `/makron/result/:sessionId` で採点ダッシュボード。
  - トップ：合計点 / 満点（manual未採点は分母から除外して「-」表示）
  - 各問：合否バッジ、配点、自分の答え、模範解答（複数列挙）、解説
  - 下部：「このセッションについてAIに質問」プロンプを生成。ただし、lovableのgatewayのAIは使わない。あくまで別のAIに送るためのプロンプトを生成するだけ
  - さらに下：「問題を報告」ボタン → 12種カテゴリのダイアログ（問題が不正確/誤字/画像不明/答えが間違い/解説不足/重複/カテゴリ違い/難易度違い/不適切/古い情報/著作権懸念/その他）

---

## 4. XP / ランキング / コイン

- 合否 1問正解 = +10 XP、誤答 = +2 XP（参加賞）
- Level = floor(sqrt(xp/50)) + 1
- `/makron` ダッシュボード上部に「自分の順位＋XP＋Level」。
- ランキングは XP上位20位。自分が圏外なら「圏外」と表示。
- コインは合格1問につき +2、誤答 0。既存の `user_coins` に加算。

RPC `get_makron_leaderboard()` を作成。

---

## 5. バグ修正：勉強ルーム

`rooms.$roomId.tsx` で `upsert` する際 `joined_at` が無いとRLSやNOT NULLで失敗する可能性。`group_room_members` の構造を確認し、メンバー登録なしでも開始できるよう「参加→開始」を一発に。 `onConflict: 'room_id,user_id'` を明示。

また `rooms.index.tsx` で作成後の遷移不具合があれば修正。

---

## 6. バトル拡張

`battle.tsx` を以下に強化：

- ジャンル選択（教科）、問題数 5/10/20、制限時間（10s/問）
- リアルタイム同期：相手の進捗バー、絵文字スタンプ（事前定義の8種）
- 終了後：両者スコア、勝敗、獲得XP、リマッチボタン
- ベストスコア記録テーブル `quiz_battles` に追加カラム（time_taken, genre）

---

## 7. ファイル構成

```text
src/routes/_authenticated/makron.tsx                (layout: 専用シェル)
src/routes/_authenticated/makron.index.tsx          (ダッシュボード)
src/routes/_authenticated/makron.admin.tsx
src/routes/_authenticated/makron.unit.$unitId.tsx
src/routes/_authenticated/makron.session.$sessionId.tsx
src/routes/_authenticated/makron.result.$sessionId.tsx
src/routes/_authenticated/makron.history.tsx
src/components/makron/MakronShell.tsx
src/components/makron/ScratchPad.tsx
src/components/makron/ReportDialog.tsx
src/components/makron/AskAIPanel.tsx
src/lib/makron.functions.ts                         (createServerFn群)
supabase/migrations/<ts>_makron.sql
```

加えて：

- AppShellの左バーに「Makron」を追加（admin_nav_config 対応）
- `src/routes/_authenticated/rooms.$roomId.tsx` 修正
- `src/routes/_authenticated/battle.tsx` 拡張

---

## 8. テクニカルメモ

- 専用バー用に、`_authenticated/makron.tsx` で AppShell を経由せず `<Outlet />` を直接返す。AppShellは親 `_authenticated.tsx` で適用されているので、makron.tsx で「shell解除」のため `Outlet` のみ返してCSSで `position: fixed; inset: 0; z-index` で全画面表示。
- 画像添付は storage バケット `makron-files`（新規・public）。
- 手動採点（記述・writtenのmanual補助）は将来拡張。今回は manualは管理者画面で手動採点UI。手動採点にAIは使わない。
- 自動採点 text タイプは accepted_answers 配列の trim/小文字比較で判定。

---

## 範囲外（できたら行う）

- 管理者採点自動化（manualは手動UIのみ）
- リアルタイム多人数同時受験

今回はすべてを実装。範囲外も。すべて。クレジットは考えずに