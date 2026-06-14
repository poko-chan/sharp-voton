
ALTER TABLE public.user_prefs ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'system';

UPDATE public.daily_mission_templates SET is_active = false
WHERE category IN ('battle','ocr') OR code IN ('chat_send_1','chat_send_10');

UPDATE public.daily_mission_templates SET reward_coins = 1, reward_xp = 2 WHERE code = 'login';
UPDATE public.daily_mission_templates SET reward_coins = 2, reward_xp = 5  WHERE code = 'study_10m';
UPDATE public.daily_mission_templates SET reward_coins = 5, reward_xp = 15 WHERE code = 'study_30m';
UPDATE public.daily_mission_templates SET reward_coins = 1, reward_xp = 2  WHERE code IN ('bookmark_q','like_q');
UPDATE public.daily_mission_templates SET reward_coins = 1, reward_xp = 2  WHERE code = 'makron_1q';
UPDATE public.daily_mission_templates SET reward_coins = 2, reward_xp = 4, target = 2 WHERE code = 'habit_stamp';
UPDATE public.daily_mission_templates SET reward_coins = 3, reward_xp = 8  WHERE code = 'plan_review';

INSERT INTO public.daily_mission_templates (code, title, description, category, target, reward_coins, reward_xp, is_active, sort_order)
VALUES
  ('study_240m','4時間勉強する','合計240分の学習','study',240,100,260,true,6),
  ('study_300m','5時間勉強する','合計300分の学習','study',300,150,400,true,7),
  ('study_5subjects','5教科以上で学習','幅広く取り組む','study',5,40,80,true,211),
  ('makron_100q','Makronで100問解く','超本気','makron',100,180,420,true,19),
  ('makron_correct_50','Makron正解50問','精度勝負','makron',50,120,250,true,20),
  ('makron_perfect_unit','単元を100%正解で完走','満点クリア','makron',1,80,150,true,21),
  ('makron_streak_25','25問連続正解','超集中','makron',25,100,200,true,22),
  ('flashcard_100','フラッシュカード100枚','記憶定着','flash',100,60,150,true,52),
  ('focus_120','集中タイマー120分','深い集中','focus',120,60,120,true,62),
  ('focus_240','集中タイマー240分','超長集中','focus',240,120,240,true,63),
  ('habit_3','習慣スタンプ3個','一日コンプリート','habit',3,10,20,true,71),
  ('habit_all','習慣を全て達成','100%達成','habit',1,30,60,true,72),
  ('reflect_detailed','振り返りを100文字以上','じっくり書く','reflect',1,15,30,true,41),
  ('reflect_week_streak','7日連続で振り返り','継続','reflect',7,80,150,true,42),
  ('plan_create','新しい学習計画を作成','次の一歩','plan',1,10,20,true,92),
  ('plan_complete','学習計画タスクを完了','達成','plan',1,15,25,true,93),
  ('goal_complete','目標を1つ完了','ゴール！','goal',1,40,80,true,94),
  ('class_comment','クラスにコメント','交流','class',1,5,10,true,122),
  ('class_post_3','クラスに3回投稿','活発','class',3,30,60,true,123),
  ('streak_3','3日連続ログイン','継続','streak',3,15,30,true,220),
  ('streak_7','7日連続ログイン','一週間','streak',7,50,100,true,221),
  ('streak_14','14日連続ログイン','二週間','streak',14,120,250,true,222),
  ('streak_30','30日連続ログイン','一ヶ月','streak',30,300,600,true,223),
  ('morning_study','朝7時前に学習開始','朝活','morning',1,15,25,true,230),
  ('night_study','22時以降に学習','夜活','night',1,10,20,true,231),
  ('coin_gift_send','コインを誰かに贈る','分かち合い','coin',1,5,10,true,240),
  ('share_summary_2','学習サマリーを2回共有','拡散','social',2,20,30,true,250),
  ('friend_chat_class','クラスメイトに激励','励まし','social',1,10,15,true,251),
  ('shop_purchase','ショップで1点購入','コインを使う','coin',1,10,20,true,260),
  ('apply_creator','問題作成権限を申請','貢献','meta',1,5,10,true,270)
ON CONFLICT (code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category,
      target = EXCLUDED.target, reward_coins = EXCLUDED.reward_coins, reward_xp = EXCLUDED.reward_xp,
      is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order;

INSERT INTO public.coin_shop_items (code, name, description, category, price, is_active, sort_order, consumable)
VALUES
  ('frame_night_sky','夜空フレーム','深い藍と星のアバターフレーム','frame',180,true,500,false),
  ('bg_wagara','和柄背景セット','市松・青海波・麻の葉','background',220,true,501,false),
  ('title_doryoku','称号「努力家」','プロフィールに表示','title',150,true,502,false),
  ('hint_ticket_5','ヒント券（5枚）','問題のヒントを5回開示','hint',120,true,503,true),
  ('revive_ticket_3','復活券（3枚）','連続正解を1回守る×3','revive',200,true,504,true)
ON CONFLICT (code) DO NOTHING;
