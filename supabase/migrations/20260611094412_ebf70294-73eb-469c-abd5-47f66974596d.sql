
-- ============ Makron拡張 ============
ALTER TABLE public.makron_questions
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hint_text text;

ALTER TABLE public.makron_answers
  ADD COLUMN IF NOT EXISTS admin_override_score integer,
  ADD COLUMN IF NOT EXISTS admin_override_note text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_frame text,
  ADD COLUMN IF NOT EXISTS active_theme text,
  ADD COLUMN IF NOT EXISTS active_title text;

-- ============ ブックマーク ============
CREATE TABLE IF NOT EXISTS public.makron_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.makron_questions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_bookmarks TO authenticated;
GRANT ALL ON public.makron_bookmarks TO service_role;
ALTER TABLE public.makron_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookmarks" ON public.makron_bookmarks FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ 問題いいね/難易度投票 ============
CREATE TABLE IF NOT EXISTS public.makron_question_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.makron_questions(id) ON DELETE CASCADE,
  liked boolean,
  difficulty_vote int CHECK (difficulty_vote BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_question_likes TO authenticated;
GRANT ALL ON public.makron_question_likes TO service_role;
ALTER TABLE public.makron_question_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view all likes" ON public.makron_question_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "own likes write" ON public.makron_question_likes FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own likes update" ON public.makron_question_likes FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "own likes delete" ON public.makron_question_likes FOR DELETE TO authenticated USING (auth.uid()=user_id);

-- ============ コインショップ ============
CREATE TABLE IF NOT EXISTS public.coin_shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  description text,
  price integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  consumable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_shop_items TO authenticated;
GRANT ALL ON public.coin_shop_items TO service_role;
ALTER TABLE public.coin_shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view shop" ON public.coin_shop_items FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "admin manage shop" ON public.coin_shop_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.coin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.coin_shop_items(id) ON DELETE CASCADE,
  price_paid integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.coin_purchases TO authenticated;
GRANT ALL ON public.coin_purchases TO service_role;
ALTER TABLE public.coin_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases" ON public.coin_purchases FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "own purchase insert" ON public.coin_purchases FOR INSERT WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_inventory TO authenticated;
GRANT ALL ON public.user_inventory TO service_role;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inv" ON public.user_inventory FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ コイン取引履歴 ============
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.coin_transactions TO authenticated;
GRANT ALL ON public.coin_transactions TO service_role;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coin tx" ON public.coin_transactions FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "own coin tx insert" ON public.coin_transactions FOR INSERT WITH CHECK (auth.uid()=user_id);

-- ============ コイン送付 ============
CREATE TABLE IF NOT EXISTS public.coin_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.coin_gifts TO authenticated;
GRANT ALL ON public.coin_gifts TO service_role;
ALTER TABLE public.coin_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own gifts" ON public.coin_gifts FOR SELECT USING (auth.uid()=from_user OR auth.uid()=to_user);
CREATE POLICY "send own gifts" ON public.coin_gifts FOR INSERT WITH CHECK (auth.uid()=from_user);

-- ============ 称号 & バッジ ============
CREATE TABLE IF NOT EXISTS public.user_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, title)
);
GRANT SELECT, INSERT, DELETE ON public.user_titles TO authenticated;
GRANT ALL ON public.user_titles TO service_role;
ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view titles" ON public.user_titles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own titles" ON public.user_titles FOR INSERT WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_code)
);
GRANT SELECT, INSERT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view badges" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "own badge insert" ON public.user_badges FOR INSERT WITH CHECK (auth.uid()=user_id);

-- ============ シーズンランキング ============
CREATE TABLE IF NOT EXISTS public.season_xp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_key text NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, season_key)
);
GRANT SELECT, INSERT, UPDATE ON public.season_xp TO authenticated;
GRANT ALL ON public.season_xp TO service_role;
ALTER TABLE public.season_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view season" ON public.season_xp FOR SELECT TO authenticated USING (true);
CREATE POLICY "own season write" ON public.season_xp FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own season update" ON public.season_xp FOR UPDATE USING (auth.uid()=user_id);

-- ============ 教師→生徒アサイン ============
CREATE TABLE IF NOT EXISTS public.makron_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.makron_units(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  due_at timestamptz,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_assignments TO authenticated;
GRANT ALL ON public.makron_assignments TO service_role;
ALTER TABLE public.makron_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class members view assignments" ON public.makron_assignments FOR SELECT
  TO authenticated USING (public.is_class_member(class_id, auth.uid()));
CREATE POLICY "teachers manage assignments" ON public.makron_assignments FOR ALL
  TO authenticated USING (public.is_class_teacher(class_id, auth.uid())) WITH CHECK (public.is_class_teacher(class_id, auth.uid()));

-- ============ 一時的問題作成権限 ============
CREATE TABLE IF NOT EXISTS public.temp_question_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.temp_question_creators TO authenticated;
GRANT ALL ON public.temp_question_creators TO service_role;
ALTER TABLE public.temp_question_creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own temp" ON public.temp_question_creators FOR SELECT USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage temp" ON public.temp_question_creators FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.can_create_questions(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(_user_id,'admin') OR EXISTS (
    SELECT 1 FROM public.temp_question_creators WHERE user_id=_user_id AND expires_at > now()
  )
$$;

-- 既存 makron_questions の管理者専用INSERT/UPDATE/DELETEポリシーを拡張
DROP POLICY IF EXISTS "admins manage questions" ON public.makron_questions;
DROP POLICY IF EXISTS "admin write questions" ON public.makron_questions;
CREATE POLICY "creators write questions" ON public.makron_questions FOR INSERT TO authenticated
  WITH CHECK (public.can_create_questions(auth.uid()));
CREATE POLICY "creators update questions" ON public.makron_questions FOR UPDATE TO authenticated
  USING (public.can_create_questions(auth.uid())) WITH CHECK (public.can_create_questions(auth.uid()));
CREATE POLICY "creators delete questions" ON public.makron_questions FOR DELETE TO authenticated
  USING (public.can_create_questions(auth.uid()));

-- 単元も同様
DROP POLICY IF EXISTS "admin manage units" ON public.makron_units;
DROP POLICY IF EXISTS "admin write units" ON public.makron_units;
CREATE POLICY "creators write units" ON public.makron_units FOR INSERT TO authenticated
  WITH CHECK (public.can_create_questions(auth.uid()));
CREATE POLICY "creators update units" ON public.makron_units FOR UPDATE TO authenticated
  USING (public.can_create_questions(auth.uid())) WITH CHECK (public.can_create_questions(auth.uid()));
CREATE POLICY "creators delete units" ON public.makron_units FOR DELETE TO authenticated
  USING (public.can_create_questions(auth.uid()));

-- ============ 管理者: XP直接編集 ============
CREATE OR REPLACE FUNCTION public.admin_set_user_xp(_user_id uuid, _xp integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.makron_xp(user_id,xp,level)
    VALUES (_user_id, GREATEST(0,_xp), GREATEST(1, floor(sqrt(GREATEST(0,_xp)::numeric/50))::int + 1))
  ON CONFLICT (user_id) DO UPDATE SET xp=EXCLUDED.xp, level=EXCLUDED.level, updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_coins(_user_id uuid, _balance integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.user_coins(user_id, balance, total_earned)
    VALUES (_user_id, GREATEST(0,_balance), GREATEST(0,_balance))
  ON CONFLICT (user_id) DO UPDATE SET balance=GREATEST(0,_balance), updated_at=now();
END $$;

-- 管理者: 解答スコア上書き
CREATE OR REPLACE FUNCTION public.admin_override_answer_score(_answer_id uuid, _score integer, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.makron_answers
    SET admin_override_score = _score,
        admin_override_note = _note,
        manual_score = _score
  WHERE id = _answer_id;
END $$;

-- 管理者向けMakron分析
CREATE OR REPLACE FUNCTION public.admin_makron_analytics()
RETURNS TABLE(question_id uuid, prompt text, attempts bigint, correct bigint, accuracy numeric, likes bigint, avg_difficulty numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT q.id, q.prompt,
    COUNT(a.id) AS attempts,
    COUNT(*) FILTER (WHERE a.auto_correct = true OR (a.manual_score IS NOT NULL AND a.manual_score >= q.points)) AS correct,
    CASE WHEN COUNT(a.id)=0 THEN 0 ELSE
      ROUND(100.0 * COUNT(*) FILTER (WHERE a.auto_correct = true OR (a.manual_score IS NOT NULL AND a.manual_score >= q.points)) / COUNT(a.id), 1)
    END AS accuracy,
    COALESCE((SELECT COUNT(*) FROM public.makron_question_likes l WHERE l.question_id=q.id AND l.liked), 0) AS likes,
    COALESCE((SELECT AVG(difficulty_vote) FROM public.makron_question_likes l WHERE l.question_id=q.id AND l.difficulty_vote IS NOT NULL), 0) AS avg_difficulty
  FROM public.makron_questions q
  LEFT JOIN public.makron_answers a ON a.question_id = q.id
  GROUP BY q.id, q.prompt
  ORDER BY attempts DESC NULLS LAST
$$;

-- ============ コイン消費RPC（安全に残高チェック） ============
CREATE OR REPLACE FUNCTION public.spend_coins(_amount integer, _reason text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_bal int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  SELECT balance INTO v_bal FROM public.user_coins WHERE user_id=v_user FOR UPDATE;
  IF v_bal IS NULL OR v_bal < _amount THEN RAISE EXCEPTION 'コインが足りません'; END IF;
  UPDATE public.user_coins SET balance = balance - _amount, updated_at=now() WHERE user_id=v_user;
  INSERT INTO public.coin_transactions(user_id, amount, reason, meta) VALUES (v_user, -_amount, _reason, _meta);
  RETURN v_bal - _amount;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_item public.coin_shop_items; v_new_bal int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_item FROM public.coin_shop_items WHERE id=_item_id AND is_active;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'アイテムが見つかりません'; END IF;
  IF NOT v_item.consumable THEN
    IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id=v_user AND item_code=v_item.code) THEN
      RAISE EXCEPTION '既に所有しています';
    END IF;
  END IF;
  v_new_bal := public.spend_coins(v_item.price, 'shop:'||v_item.code, jsonb_build_object('item_id', v_item.id));
  INSERT INTO public.coin_purchases(user_id, item_id, price_paid, payload) VALUES (v_user, v_item.id, v_item.price, v_item.payload);
  INSERT INTO public.user_inventory(user_id, item_code, category, quantity, payload)
    VALUES (v_user, v_item.code, v_item.category, 1, v_item.payload)
    ON CONFLICT (user_id, item_code) DO UPDATE SET quantity = public.user_inventory.quantity + 1;
  RETURN jsonb_build_object('balance', v_new_bal, 'item', v_item.code);
END $$;

-- コインギフト送付
CREATE OR REPLACE FUNCTION public.send_coin_gift(_to uuid, _amount integer, _message text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_new int;
BEGIN
  IF v_user IS NULL OR _to IS NULL OR v_user = _to THEN RAISE EXCEPTION 'invalid'; END IF;
  IF NOT public.are_mutual_friends(v_user, _to) THEN RAISE EXCEPTION 'フレンドのみ送付可能'; END IF;
  v_new := public.spend_coins(_amount, 'gift:'||_to::text, jsonb_build_object('to',_to,'msg',_message));
  INSERT INTO public.user_coins(user_id, balance, total_earned)
    VALUES (_to, _amount, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.user_coins.balance + _amount,
      total_earned = public.user_coins.total_earned + _amount, updated_at=now();
  INSERT INTO public.coin_transactions(user_id, amount, reason, meta) VALUES (_to, _amount, 'gift_from:'||v_user::text, jsonb_build_object('from',v_user,'msg',_message));
  INSERT INTO public.coin_gifts(from_user, to_user, amount, message) VALUES (v_user, _to, _amount, _message);
  RETURN v_new;
END $$;

-- ============ シードコインショップ（盛りだくさん） ============
INSERT INTO public.coin_shop_items(code,category,name,description,price,payload,consumable,sort_order) VALUES
  ('frame_gold','frame','ゴールドフレーム','プロフィールに金色の枠',300,'{"frame":"gold"}',false,10),
  ('frame_rainbow','frame','レインボーフレーム','虹色アニメ枠',800,'{"frame":"rainbow"}',false,11),
  ('frame_sakura','frame','桜フレーム','桜の花びら枠',500,'{"frame":"sakura"}',false,12),
  ('frame_neon','frame','ネオンフレーム','光るネオン枠',600,'{"frame":"neon"}',false,13),
  ('frame_galaxy','frame','ギャラクシー','宇宙柄枠',900,'{"frame":"galaxy"}',false,14),
  ('theme_dark','theme','ダークテーマ','UI全体ダーク化',400,'{"theme":"dark"}',false,20),
  ('theme_ocean','theme','オーシャン','青系背景',400,'{"theme":"ocean"}',false,21),
  ('theme_forest','theme','フォレスト','緑系背景',400,'{"theme":"forest"}',false,22),
  ('theme_sunset','theme','サンセット','夕焼け',400,'{"theme":"sunset"}',false,23),
  ('theme_cyber','theme','サイバー','近未来UI',700,'{"theme":"cyber"}',false,24),
  ('title_master','title','〈勉強マスター〉',NULL,500,'{"title":"勉強マスター"}',false,30),
  ('title_genius','title','〈天才〉',NULL,1200,'{"title":"天才"}',false,31),
  ('title_grind','title','〈努力家〉',NULL,300,'{"title":"努力家"}',false,32),
  ('title_legend','title','〈レジェンド〉',NULL,2000,'{"title":"レジェンド"}',false,33),
  ('hint_pack5','hint','ヒント券×5','Makronで5回ヒント表示',150,'{"hints":5}',true,40),
  ('hint_pack20','hint','ヒント券×20',NULL,500,'{"hints":20}',true,41),
  ('revive','revive','ストリーク復活','切れたストリークを復活',200,'{"revive":1}',true,50),
  ('streak_freeze','revive','ストリーク凍結×3','3日分凍結',300,'{"freeze":3}',true,51),
  ('chest_small','chest','小宝箱','100-500コイン or アイテム',250,'{"chest":"small"}',true,60),
  ('chest_large','chest','大宝箱','500-3000コイン or レアアイテム',800,'{"chest":"large"}',true,61),
  ('emoji_pack','emoji','絵文字パック','バトル用絵文字×20',200,'{"pack":"basic"}',false,70),
  ('scratch_grid','scratch','方眼計算用紙',NULL,100,'{"scratch":"grid"}',false,80),
  ('scratch_dot','scratch','ドット計算用紙',NULL,100,'{"scratch":"dot"}',false,81),
  ('avatar_decor_crown','decor','王冠デコ','アバターに王冠',400,'{"decor":"crown"}',false,90),
  ('avatar_decor_glasses','decor','メガネデコ',NULL,200,'{"decor":"glasses"}',false,91),
  ('battle_boost','boost','バトルブースト×3','次の3戦XP1.5倍',350,'{"boost":3}',true,100),
  ('xp_boost_1h','boost','XP2倍 1時間',NULL,250,'{"xp_mult":2,"hours":1}',true,101),
  ('temp_creator_1d','privilege','問題作成権限24h','1日問題作成可能',1000,'{"hours":24}',true,110),
  ('temp_creator_7d','privilege','問題作成権限7日',NULL,5000,'{"hours":168}',true,111)
ON CONFLICT (code) DO NOTHING;

-- ============ デイリーミッション無限化（テンプレート大量追加） ============
-- 既存 daily_missions は user_id-scoped (typeof, target, ...) と推測。テンプレ用に別テーブル作成
CREATE TABLE IF NOT EXISTS public.daily_mission_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  target integer NOT NULL,
  reward_coins integer NOT NULL DEFAULT 5,
  reward_xp integer NOT NULL DEFAULT 0,
  category text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.daily_mission_templates TO authenticated;
GRANT ALL ON public.daily_mission_templates TO service_role;
ALTER TABLE public.daily_mission_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view templates" ON public.daily_mission_templates FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "admin manage tpl" ON public.daily_mission_templates FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.daily_mission_templates(code,title,description,target,reward_coins,reward_xp,category,sort_order) VALUES
  ('study_10m','10分勉強する','学習ログ10分',10,5,10,'study',1),
  ('study_30m','30分勉強する',NULL,30,10,30,'study',2),
  ('study_60m','60分勉強する',NULL,60,20,60,'study',3),
  ('study_120m','120分勉強する',NULL,120,40,120,'study',4),
  ('study_180m','3時間勉強する',NULL,180,70,180,'study',5),
  ('makron_1q','Makronで1問解く',NULL,1,3,5,'makron',10),
  ('makron_5q','Makronで5問解く',NULL,5,10,25,'makron',11),
  ('makron_10q','Makronで10問解く',NULL,10,20,50,'makron',12),
  ('makron_20q','Makronで20問解く',NULL,20,40,100,'makron',13),
  ('makron_50q','Makronで50問解く',NULL,50,100,250,'makron',14),
  ('makron_correct_5','正解5問',NULL,5,15,30,'makron',15),
  ('makron_correct_20','正解20問',NULL,20,50,120,'makron',16),
  ('makron_streak_3','3問連続正解',NULL,3,10,20,'makron',17),
  ('makron_streak_10','10問連続正解',NULL,10,40,80,'makron',18),
  ('battle_1','バトル1回プレイ',NULL,1,5,10,'battle',20),
  ('battle_win_1','バトル1勝',NULL,1,15,30,'battle',21),
  ('battle_3','バトル3回プレイ',NULL,3,20,40,'battle',22),
  ('battle_win_3','バトル3勝',NULL,3,50,100,'battle',23),
  ('chat_send_1','チャット1通送信',NULL,1,3,5,'social',30),
  ('chat_send_10','チャット10通送信',NULL,10,15,20,'social',31),
  ('friend_1','フレンドを1人増やす',NULL,1,20,30,'social',32),
  ('reflection','今日のふりかえり記入',NULL,1,10,15,'reflect',40),
  ('flashcard_10','フラッシュカード10枚',NULL,10,10,20,'flash',50),
  ('flashcard_50','フラッシュカード50枚',NULL,50,30,80,'flash',51),
  ('focus_25','集中タイマー25分',NULL,25,15,30,'focus',60),
  ('focus_60','集中タイマー60分',NULL,60,30,60,'focus',61),
  ('habit_stamp','習慣スタンプ1個',NULL,1,5,10,'habit',70),
  ('ocr_note','OCRノート1枚',NULL,1,10,15,'ocr',80),
  ('plan_review','学習計画を確認',NULL,1,5,5,'plan',90),
  ('goal_progress','目標を進める',NULL,1,10,15,'goal',91),
  ('bookmark_q','問題を1つブックマーク',NULL,1,3,5,'makron',100),
  ('like_q','問題に「いいね」',NULL,1,3,5,'makron',101),
  ('share_summary','学習サマリーを共有',NULL,1,15,20,'social',110),
  ('class_post','クラスに投稿',NULL,1,10,15,'class',120),
  ('teacher_feedback','先生からフィードバック受信',NULL,1,15,20,'class',121),
  ('login','ログイン',NULL,1,2,3,'meta',200),
  ('all_subjects','3教科以上で学習',NULL,3,20,40,'study',210),
  ('night_owl','22時以降に勉強',NULL,1,10,15,'time',220),
  ('early_bird','6-8時に勉強',NULL,1,10,15,'time',221),
  ('weekend_warrior','週末2時間以上',NULL,120,30,60,'time',222),
  ('comeback','3日ぶりに復帰',NULL,1,30,50,'meta',230),
  ('perfect_score','Makronセッション満点',NULL,1,50,100,'makron',240)
ON CONFLICT (code) DO NOTHING;

-- ============ コインボーナス: finalize_makron_sessionを更新（連続正解ボーナス追加） ============
-- 既存関数はそのまま使う（変更スコープ管理）

-- ============ Makron leaderboard with rank ============
-- 既存 get_makron_leaderboard は20件→そのまま
