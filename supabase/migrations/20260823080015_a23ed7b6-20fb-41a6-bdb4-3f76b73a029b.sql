INSERT INTO public.coin_shop_items (code, name, description, price, category, payload, consumable, auto_grant, sort_order) VALUES
('theme_glass_aurora','グラスオーロラ テーマ','半透明のガラス質感に淡いオーロラを重ねた限定テーマ',900,'theme','{"theme":"glass_aurora"}'::jsonb,false,true,240),
('frame_crystal_prism','クリスタルプリズム フレーム','光を反射するプリズム調のアイコンフレーム',700,'frame','{"frame":"crystal_prism"}'::jsonb,false,true,241),
('title_seiri_meijin','称号「整理の名人」','こつこつ片付ける人へ贈られる称号',500,'title','{"title":"整理の名人"}'::jsonb,false,true,242),
('boost_xp_30m','XPブースト30分','30分間、獲得XPが1.5倍になります',450,'boost','{"kind":"xp","multiplier":1.5,"minutes":30}'::jsonb,true,false,243),
('sticker_summer_pack','夏のステッカーパック','記録や投稿に貼れる夏デザインのステッカー10種',350,'sticker','{"pack":"summer"}'::jsonb,false,true,244)
ON CONFLICT (code) DO NOTHING;