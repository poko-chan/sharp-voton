
-- 1) purchase_shop_item: invalid amount fix (price 0 or null safe)
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_item public.coin_shop_items; v_new_bal int; v_req_id uuid; v_price int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_item FROM public.coin_shop_items WHERE id=_item_id AND is_active;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'アイテムが見つかりません'; END IF;
  v_price := COALESCE(v_item.price, 0);
  IF v_price < 0 THEN RAISE EXCEPTION '価格が不正です'; END IF;
  IF NOT v_item.consumable AND v_item.auto_grant THEN
    IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id=v_user AND item_code=v_item.code) THEN
      RAISE EXCEPTION '既に所有しています';
    END IF;
  END IF;
  IF v_price > 0 THEN
    v_new_bal := public.spend_coins(v_price, 'shop:'||v_item.code, jsonb_build_object('item_id', v_item.id));
  ELSE
    SELECT COALESCE(balance,0) INTO v_new_bal FROM public.user_coins WHERE user_id=v_user;
    INSERT INTO public.coin_transactions(user_id, amount, reason, meta)
      VALUES (v_user, 0, 'shop_free:'||v_item.code, jsonb_build_object('item_id', v_item.id));
  END IF;
  INSERT INTO public.coin_purchases(user_id, item_id, price_paid, payload) VALUES (v_user, v_item.id, v_price, v_item.payload);

  IF v_item.auto_grant THEN
    INSERT INTO public.user_inventory(user_id, item_code, category, quantity, payload)
      VALUES (v_user, v_item.code, v_item.category, 1, v_item.payload)
      ON CONFLICT (user_id, item_code) DO UPDATE SET quantity = public.user_inventory.quantity + 1;
  ELSE
    INSERT INTO public.coin_redemption_requests(user_id, item_id, item_code, item_name, price_paid, payload)
    VALUES (v_user, v_item.id, v_item.code, v_item.name, v_price, v_item.payload)
    RETURNING id INTO v_req_id;
    INSERT INTO public.notifications(user_id, type, title, body, meta)
      SELECT ur.user_id, 'redemption_request', '引き換えリクエスト', v_item.name || ' (' || v_price || 'コイン)', jsonb_build_object('req_id', v_req_id, 'buyer', v_user)
      FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;
  RETURN jsonb_build_object('balance', v_new_bal, 'item', v_item.code, 'redemption', v_item.auto_grant = false);
END $function$;

-- 2) admin grant coins to all
CREATE OR REPLACE FUNCTION public.admin_grant_coins_to_all(_amount int, _reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'amount required'; END IF;

  WITH targets AS (SELECT id FROM public.profiles WHERE account_kind <> 'parent'),
  upserted AS (
    INSERT INTO public.user_coins(user_id, balance, total_earned)
      SELECT id, GREATEST(0,_amount), GREATEST(0,_amount) FROM targets
    ON CONFLICT (user_id) DO UPDATE SET
      balance = GREATEST(0, public.user_coins.balance + _amount),
      total_earned = public.user_coins.total_earned + GREATEST(0,_amount),
      updated_at = now()
    RETURNING user_id
  ), tx AS (
    INSERT INTO public.coin_transactions(user_id, amount, reason, meta)
      SELECT user_id, _amount, 'admin_grant_all', jsonb_build_object('by',auth.uid(),'msg',_reason) FROM upserted
    RETURNING user_id
  ), notif AS (
    INSERT INTO public.notifications(user_id, type, title, body, meta)
      SELECT user_id, 'admin_coin', '管理者からコインが届きました',
        COALESCE(_reason,'')||' ('||_amount||'コイン)',
        jsonb_build_object('amount',_amount) FROM upserted
    RETURNING user_id
  )
  SELECT count(*) INTO v_count FROM upserted;

  INSERT INTO public.admin_audit_log(admin_id,action,target_user,details)
    VALUES (auth.uid(),'grant_coins_all',NULL,jsonb_build_object('amount',_amount,'msg',_reason,'count',v_count));
  RETURN v_count;
END $$;

-- 3) makron_answers snapshot
ALTER TABLE public.makron_answers ADD COLUMN IF NOT EXISTS question_snapshot jsonb;

-- 4) delete pack RPC
CREATE OR REPLACE FUNCTION public.delete_makron_pack(_pack_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.makron_packs WHERE id=_pack_id
    AND (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.makron_answers a USING public.makron_questions q
    WHERE a.question_id = q.id AND q.pack_id = _pack_id;
  DELETE FROM public.makron_sessions WHERE pack_id = _pack_id;
  DELETE FROM public.makron_pack_attempts WHERE pack_id = _pack_id;
  DELETE FROM public.makron_questions WHERE pack_id = _pack_id;
  DELETE FROM public.makron_packs WHERE id = _pack_id;
END $$;

-- 5) class post / comment / DM notification triggers
CREATE OR REPLACE FUNCTION public.notify_class_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, meta)
  SELECT m.user_id, 'class_post', '新しい投稿があります', left(COALESCE(NEW.body, NEW.title, ''),120),
    jsonb_build_object('class_id', NEW.class_id, 'post_id', NEW.id)
  FROM public.class_members m
  WHERE m.class_id = NEW.class_id AND m.user_id <> NEW.author_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_class_post ON public.class_posts;
CREATE TRIGGER trg_notify_class_post AFTER INSERT ON public.class_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_class_post();

CREATE OR REPLACE FUNCTION public.notify_class_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, meta)
  SELECT p.author_id, 'class_comment', '投稿にコメントが付きました', left(COALESCE(NEW.body,''),120),
    jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id)
  FROM public.class_posts p WHERE p.id = NEW.post_id AND p.author_id <> NEW.author_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_class_comment ON public.class_post_comments;
CREATE TRIGGER trg_notify_class_comment AFTER INSERT ON public.class_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_class_comment();

CREATE OR REPLACE FUNCTION public.notify_dm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, body, meta)
      VALUES (NEW.recipient_id, 'dm', '新しいメッセージ', left(COALESCE(NEW.content,''),120),
        jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_dm ON public.chat_messages;
CREATE TRIGGER trg_notify_dm AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_dm();

-- 6) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 7) submit_official_request RPC
CREATE OR REPLACE FUNCTION public.submit_official_request(_pack_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.makron_packs WHERE id=_pack_id AND created_by = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.makron_packs SET status='pending' WHERE id=_pack_id;
  INSERT INTO public.notifications(user_id, type, title, body, meta)
    SELECT ur.user_id, 'pack_official_request', '公式申請が届きました',
      COALESCE((SELECT title FROM public.makron_packs WHERE id=_pack_id),'')||' '||COALESCE(_note,''),
      jsonb_build_object('pack_id', _pack_id)
    FROM public.user_roles ur WHERE ur.role='admin';
END $$;

-- 8) approve pack to official (admin)
CREATE OR REPLACE FUNCTION public.admin_review_pack(_pack_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_creator uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT created_by INTO v_creator FROM public.makron_packs WHERE id=_pack_id;
  UPDATE public.makron_packs SET
    status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    is_official = CASE WHEN _approve THEN true ELSE false END,
    reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id=_pack_id;
  IF v_creator IS NOT NULL AND v_creator <> auth.uid() THEN
    INSERT INTO public.notifications(user_id, type, title, body, meta)
      VALUES (v_creator,
        CASE WHEN _approve THEN 'pack_approved' ELSE 'pack_rejected' END,
        CASE WHEN _approve THEN 'パックが公式承認されました' ELSE 'パックが却下されました' END,
        '', jsonb_build_object('pack_id',_pack_id));
  END IF;
END $$;
