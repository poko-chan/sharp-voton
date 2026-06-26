INSERT INTO public.coin_shop_items(code,name,description,price,category,consumable,payload,is_active) VALUES
 ('frame_sunrise','サンライズフレーム','朝焼け色のアバター枠',340,'frame',false,'{"frame":"sunrise"}'::jsonb,true),
 ('title_helper','ヘルパー','他ユーザーを助けた称号',180,'title',false,'{"title":"ヘルパー"}'::jsonb,true),
 ('ticket_focus_30','集中30分券','タイマー30分ボーナス +20%XP',90,'ticket',true,'{"focus_minutes":30}'::jsonb,true),
 ('boost_xp_3h','XP 1.5倍ブースト(3時間)','3時間XP 1.5倍',260,'boost',true,'{"xp_mult":1.5,"hours":3}'::jsonb,true),
 ('cosmetic_login_bg','ログイン背景：星空','ログイン画面の背景を星空に',420,'cosmetic',false,'{"login_bg":"starry"}'::jsonb,true)
ON CONFLICT (code) DO NOTHING;