INSERT INTO public.coin_shop_items (code, name, description, price, category, consumable, auto_grant, is_active, is_custom)
VALUES
 ('col_org_badge','役職バッジ','組織の役職を表すきらめくバッジ',180,'collection',false,true,true,false),
 ('col_staff_card','職員証ホルダー','首から下げるかっこいい職員証',220,'collection',false,true,true,false),
 ('col_school_bell','校舎のベル','授業の始まりを告げる真鍮のベル',260,'collection',false,true,true,false),
 ('col_class_flag','クラス旗','みんなで作ったオリジナルの旗',300,'collection',false,true,true,false),
 ('col_golden_key','管理者の金の鍵','すべての教室を開けられる伝説の鍵',420,'collection',false,true,true,false)
ON CONFLICT (code) DO NOTHING;