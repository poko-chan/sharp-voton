INSERT INTO public.coin_shop_items
  (code, name, description, price, category, payload, consumable, is_active, sort_order)
VALUES
  ('kanji_ink_202608', '漢字の墨', '漢字練習を応援するコレクションアイテム', 90, 'collection', '{"icon":"brush"}'::jsonb, false, true, 860),
  ('focus_lens_202608', '集中レンズ', '今日の集中を象徴するコレクションアイテム', 110, 'collection', '{"icon":"scan"}'::jsonb, false, true, 861),
  ('study_compass_202608', '学習コンパス', '次に進む方向を示すコレクションアイテム', 140, 'collection', '{"icon":"compass"}'::jsonb, false, true, 862),
  ('notebook_leaf_202608', 'ノートの若葉', '毎日の積み重ねを記念するコレクションアイテム', 70, 'collection', '{"icon":"leaf"}'::jsonb, false, true, 863),
  ('model_crystal_202608', 'モデルクリスタル', '端末内AIの準備完了を祝うコレクションアイテム', 160, 'collection', '{"icon":"sparkles"}'::jsonb, false, true, 864)
ON CONFLICT (code) DO NOTHING;