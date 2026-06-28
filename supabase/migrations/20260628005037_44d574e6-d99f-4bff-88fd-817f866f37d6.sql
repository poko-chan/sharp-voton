
-- Exam tracker tables
CREATE TABLE public.exam_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_series TO authenticated;
GRANT ALL ON public.exam_series TO service_role;
ALTER TABLE public.exam_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own series" ON public.exam_series FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  series_id UUID REFERENCES public.exam_series(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exams" ON public.exams FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX exams_series_idx ON public.exams(series_id);

CREATE TABLE public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_score INT NOT NULL DEFAULT 100,
  target_score INT,
  actual_score INT,
  exam_date DATE,
  order_no INT NOT NULL DEFAULT 0,
  duration_min INT,
  study_subject_ids UUID[] NOT NULL DEFAULT '{}',
  reflection TEXT,
  time_satisfaction INT,
  content_satisfaction INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_subjects TO authenticated;
GRANT ALL ON public.exam_subjects TO service_role;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exam_subjects" ON public.exam_subjects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX exam_subjects_exam_idx ON public.exam_subjects(exam_id);

CREATE TABLE public.exam_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_subject_id UUID NOT NULL REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOL NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  coin_awarded BOOL NOT NULL DEFAULT false,
  order_no INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_todos TO authenticated;
GRANT ALL ON public.exam_todos TO service_role;
ALTER TABLE public.exam_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exam_todos" ON public.exam_todos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX exam_todos_subject_idx ON public.exam_todos(exam_subject_id);

CREATE OR REPLACE FUNCTION public.complete_exam_todo(_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_todo RECORD;
  v_awarded INT := 0;
BEGIN
  SELECT * INTO v_todo FROM public.exam_todos WHERE id = _id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'todo not found'; END IF;
  IF NOT v_todo.done THEN
    UPDATE public.exam_todos SET done = true, done_at = now() WHERE id = _id;
    IF NOT v_todo.coin_awarded THEN
      UPDATE public.exam_todos SET coin_awarded = true WHERE id = _id;
      INSERT INTO public.user_coins (user_id, balance, total_earned)
        VALUES (v_uid, 10, 10)
        ON CONFLICT (user_id) DO UPDATE SET balance = public.user_coins.balance + 10, total_earned = public.user_coins.total_earned + 10;
      INSERT INTO public.coin_transactions (user_id, amount, reason, metadata)
        VALUES (v_uid, 10, 'exam_todo', jsonb_build_object('todo_id', _id));
      v_awarded := 10;
    END IF;
  ELSE
    UPDATE public.exam_todos SET done = false, done_at = NULL WHERE id = _id;
  END IF;
  RETURN jsonb_build_object('awarded', v_awarded);
END;$$;

-- Material enhancements
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS favorite BOOL NOT NULL DEFAULT false;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS material_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.study_logs ADD COLUMN IF NOT EXISTS material_ids UUID[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS materials_fav_idx ON public.materials(favorite);
CREATE INDEX IF NOT EXISTS time_entries_mat_gin ON public.time_entries USING GIN(material_ids);
CREATE INDEX IF NOT EXISTS study_logs_mat_gin ON public.study_logs USING GIN(material_ids);
