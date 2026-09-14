INSERT INTO public.coin_shop_items
  (code, name, description, price, category, payload, consumable, is_active, sort_order)
VALUES
  ('campus_compass_20260914', 'キャンパスコンパス', '今日の学習ルートを示すコレクションアイテム', 95, 'collection', '{"icon":"compass"}'::jsonb, false, true, 870),
  ('focus_whistle_20260914', '集中ホイッスル', '集中開始の合図を象徴するコレクションアイテム', 110, 'collection', '{"icon":"timer"}'::jsonb, false, true, 871),
  ('study_badge_20260914', 'スタディバッジ', '毎日の積み重ねを称えるコレクションアイテム', 135, 'collection', '{"icon":"award"}'::jsonb, false, true, 872),
  ('route_marker_20260914', 'ルートマーカー', '学習の現在地を記録するコレクションアイテム', 80, 'collection', '{"icon":"map-pin"}'::jsonb, false, true, 873),
  ('campus_ticket_20260914', 'キャンパスチケット', '新しい挑戦への一歩を記念するコレクションアイテム', 160, 'collection', '{"icon":"ticket"}'::jsonb, false, true, 874)
ON CONFLICT (code) DO NOTHING;