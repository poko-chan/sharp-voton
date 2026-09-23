
-- 1) 公開(anon)読み取りをログイン中のみに絞る（学習コンテンツ）
DROP POLICY IF EXISTS "subjects readable" ON public.makron_subjects;
CREATE POLICY "subjects readable" ON public.makron_subjects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fields readable" ON public.makron_fields;
CREATE POLICY "fields readable" ON public.makron_fields FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read badges" ON public.badges;
CREATE POLICY "read badges" ON public.badges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read daily three" ON public.daily_three;
CREATE POLICY "read daily three" ON public.daily_three FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read roadmap" ON public.unit_roadmap;
CREATE POLICY "read roadmap" ON public.unit_roadmap FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "daily sets readable" ON public.makron_daily_sets;
CREATE POLICY "daily sets readable" ON public.makron_daily_sets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "mu_select" ON public.makron_units;
CREATE POLICY "mu_select" ON public.makron_units FOR SELECT TO authenticated USING (true);

-- 2) 問題: 承認済み/自分の作成分/管理者のみ
DROP POLICY IF EXISTS "mq_select" ON public.makron_questions;
CREATE POLICY "mq_select" ON public.makron_questions FOR SELECT TO authenticated
USING (
  coalesce(status, 'approved') = 'approved'
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3) 問題集: 公開中/自分の作成分/組織メンバー/管理者
DROP POLICY IF EXISTS "packs select all" ON public.makron_packs;
CREATE POLICY "packs select all" ON public.makron_packs FOR SELECT TO authenticated
USING (
  (organization_id IS NULL AND coalesce(is_active, true) AND coalesce(status, 'approved') = 'approved')
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4) プランテンプレート置き場: ログイン中のみ
DROP POLICY IF EXISTS "read all plan templates" ON public.plan_template_marketplace;
CREATE POLICY "read all plan templates" ON public.plan_template_marketplace FOR SELECT TO authenticated
USING (true);

-- 5) チャット画像: 送信者本人と受信者のみ
CREATE OR REPLACE FUNCTION public.can_read_chat_image(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    split_part(_path, '/', 1) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.recipient_id = auth.uid()
        AND m.content LIKE '%' || _path || '%'
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_group_messages gm
      JOIN public.chat_group_members gmem
        ON gmem.group_id = gm.group_id AND gmem.user_id = auth.uid()
      WHERE gm.content LIKE '%' || _path || '%'
    )
$$;

REVOKE ALL ON FUNCTION public.can_read_chat_image(text) FROM public;
GRANT EXECUTE ON FUNCTION public.can_read_chat_image(text) TO authenticated;

DROP POLICY IF EXISTS "chat_img_select" ON storage.objects;
CREATE POLICY "chat_img_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images' AND public.can_read_chat_image(name));
