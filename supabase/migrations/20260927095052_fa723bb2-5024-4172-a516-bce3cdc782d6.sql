INSERT INTO public.coin_shop_items (code, name, description, price, category, consumable, auto_grant, is_active, is_custom)
VALUES
 ('col_login_card','ログインカード','QRでさっとログインできる思い出のカード', 140,'collection', false, true, true, false),
 ('col_watch_lamp','見守りランプ','おうちの人がそっと見守るあかり', 190,'collection', false, true, true, false),
 ('col_family_album','家族アルバム','がんばりの記録をとじこむアルバム', 240,'collection', false, true, true, false),
 ('col_parent_note','おやこ手帳','親子でやりとりする小さな手帳', 280,'collection', false, true, true, false),
 ('col_guard_bell','まもりの鈴','安全を知らせる澄んだ音の鈴', 360,'collection', false, true, true, false)
ON CONFLICT (code) DO NOTHING;