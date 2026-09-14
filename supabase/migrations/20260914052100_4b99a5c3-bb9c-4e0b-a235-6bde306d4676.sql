INSERT INTO public.coin_shop_items
  (code, name, description, price, category, payload, consumable, is_active, sort_order)
VALUES
  ('study_os_signal_pin_20260914', 'シグナルピン', '学習の現在地を示すコレクションアイテム', 90, 'collection', '{"icon":"map-pin"}'::jsonb, false, true, 875),
  ('study_os_focus_core_20260914', 'フォーカスコア', '集中の起動を象徴するコレクションアイテム', 125, 'collection', '{"icon":"zap"}'::jsonb, false, true, 876),
  ('study_os_memory_loop_20260914', 'メモリーループ', '復習と定着の循環を表すコレクションアイテム', 145, 'collection', '{"icon":"refresh-cw"}'::jsonb, false, true, 877),
  ('study_os_rhythm_meter_20260914', 'リズムメーター', '毎日の学習リズムを刻むコレクションアイテム', 105, 'collection', '{"icon":"activity"}'::jsonb, false, true, 878),
  ('study_os_master_key_20260914', 'スタディOSキー', '学習の全工程を完了した証のコレクションアイテム', 180, 'collection', '{"icon":"key-round"}'::jsonb, false, true, 879)
ON CONFLICT (code) DO NOTHING;