REVOKE SELECT ON public.makron_questions FROM authenticated, anon;
GRANT SELECT (
  id, unit_id, pack_id, prompt, image_url, type, options, explanation, points,
  grading, hint_text, order_idx, is_active, status, created_by, submitted_at,
  reviewed_at, reviewed_by, created_at, updated_at
) ON public.makron_questions TO authenticated;

REVOKE SELECT ON public.org_edu_questions FROM authenticated, anon;
GRANT SELECT (
  id, organization_id, unit_id, kind, body, choices, hint_text, audience,
  level, sort_order, created_by, created_at, updated_at
) ON public.org_edu_questions TO authenticated;

INSERT INTO public.coin_shop_items
  (code, name, description, price, category, payload, consumable, is_active, sort_order)
VALUES
  ('precision_ruler_20260914', '精密ルーラー', '学習計画を整えるコレクションアイテム', 90, 'collection', '{"icon":"ruler"}'::jsonb, false, true, 865),
  ('study_beacon_20260914', '学習ビーコン', '次の目標を照らすコレクションアイテム', 120, 'collection', '{"icon":"lamp"}'::jsonb, false, true, 866),
  ('archive_key_20260914', '記録庫の鍵', '積み重ねた記録を象徴するコレクションアイテム', 150, 'collection', '{"icon":"key"}'::jsonb, false, true, 867),
  ('focus_prism_20260914', '集中プリズム', '集中した時間を記念するコレクションアイテム', 180, 'collection', '{"icon":"gem"}'::jsonb, false, true, 868),
  ('progress_flag_20260914', '前進の旗', '一歩ずつ進む学習を応援するコレクションアイテム', 75, 'collection', '{"icon":"flag"}'::jsonb, false, true, 869)
ON CONFLICT (code) DO NOTHING;