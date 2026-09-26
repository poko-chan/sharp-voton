CREATE OR REPLACE FUNCTION public.org_edu_seed_starter(_org uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s uuid; u uuid; n integer := 0; subj record; q record;
BEGIN
  IF NOT (public.is_org_staff(_org, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR subj IN SELECT * FROM (VALUES
    (1,'数学','#3B82F6','正負の数'),(2,'英語','#EF4444','be動詞と一般動詞'),
    (3,'理科','#10B981','植物のつくり'),(4,'社会','#F59E0B','世界の地理')) AS t(o,name,color,unit)
  LOOP
    IF EXISTS (SELECT 1 FROM org_edu_units WHERE organization_id=_org AND title=subj.unit) THEN CONTINUE; END IF;
    SELECT id INTO s FROM org_edu_subjects WHERE organization_id=_org AND name=subj.name LIMIT 1;
    IF s IS NULL THEN
      INSERT INTO org_edu_subjects(organization_id,name,color,sort_order) VALUES (_org,subj.name,subj.color,subj.o) RETURNING id INTO s;
    END IF;
    INSERT INTO org_edu_units(organization_id,subject_id,title,level,sort_order) VALUES (_org,s,subj.unit,1,subj.o) RETURNING id INTO u;
    FOR q IN SELECT * FROM (VALUES
      ('数学',1,'choice','(-3)+(+5) を計算しなさい。','["2","-2","8","-8"]','2','符号の異なる数の和は、絶対値の差に大きい方の符号。'),
      ('数学',1,'choice','(-4)×(-6) を計算しなさい。','["24","-24","10","-10"]','24','負×負は正。'),
      ('数学',2,'short','-7 と 3 では、どちらが大きいか数で答えなさい。','[]','3','負の数は0より小さい。'),
      ('数学',2,'short','(-2)の3乗を計算しなさい。','[]','-8','(-2)×(-2)×(-2)=-8'),
      ('数学',1,'short','-5 の絶対値を答えなさい。','[]','5','絶対値は0からの距離。'),
      ('英語',1,'choice','I ( ) a student.','["am","is","are","be"]','am','主語Iにはam。'),
      ('英語',1,'choice','She ( ) tennis every day.','["play","plays","playing","is play"]','plays','三人称単数現在はsをつける。'),
      ('英語',1,'choice','They ( ) from Canada.','["am","is","are","be"]','are','複数の主語にはare。'),
      ('英語',2,'short','「私は犬が好きです」を英語で。(I ... dogs.)','[]','I like dogs.|I like dogs','likeは一般動詞。'),
      ('英語',2,'short','He ( ) not like milk. 空所に入る語は？','[]','does','三単現の否定はdoes not。'),
      ('理科',1,'choice','光合成を行う緑色の粒を何という？','["葉緑体","核","細胞壁","液胞"]','葉緑体','葉緑体で光合成が行われる。'),
      ('理科',1,'choice','根から吸収した水が通る管は？','["道管","師管","気孔","維管束鞘"]','道管','水は道管、養分は師管。'),
      ('理科',1,'short','葉の表皮にある、気体が出入りするすきまを何という？','[]','気孔','蒸散もここで行われる。'),
      ('理科',2,'short','光合成でつくられる気体は？','[]','酸素|O2','二酸化炭素と水から養分と酸素をつくる。'),
      ('理科',2,'choice','被子植物で、胚珠が包まれているつくりは？','["子房","花弁","がく","やく"]','子房','子房は成長して果実になる。'),
      ('社会',1,'choice','世界で最も面積が大きい大陸は？','["ユーラシア大陸","アフリカ大陸","北アメリカ大陸","南極大陸"]','ユーラシア大陸','六大陸で最大。'),
      ('社会',1,'choice','世界で最も面積が大きい海洋は？','["太平洋","大西洋","インド洋","北極海"]','太平洋','三大洋で最大。'),
      ('社会',1,'short','経度0度の線を何という？','[]','本初子午線','イギリスのグリニッジを通る。'),
      ('社会',2,'short','緯度0度の線を何という？','[]','赤道','地球を南北に分ける。'),
      ('社会',2,'choice','日本の標準時子午線が通る都市は？','["明石市","東京","大阪市","京都市"]','明石市','東経135度。')
    ) AS t(sub,lv,kind,body,ch,ans,ex) WHERE t.sub = subj.name
    LOOP
      INSERT INTO org_edu_questions(organization_id,unit_id,kind,body,choices,answer,explanation,level,sort_order,created_by)
      VALUES (_org,u,q.kind,q.body,q.ch::jsonb,q.ans,q.ex,q.lv,n,auth.uid());
      n := n + 1;
    END LOOP;
  END LOOP;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.org_edu_seed_starter(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.org_edu_seed_starter(uuid) TO authenticated;