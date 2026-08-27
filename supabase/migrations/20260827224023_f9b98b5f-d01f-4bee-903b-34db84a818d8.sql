DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'admin_fulfill_redemption','admin_list_daily_sets','admin_makron_analytics',
        'admin_override_answer_score','admin_review_creator_application','admin_review_pack',
        'admin_review_question','admin_set_daily_set','admin_upsert_shop_item',
        'assignment_quiz_key','can_create_questions','get_user_study_stats','group_org',
        'join_group_room_by_code','makron_correct_answer_text','makron_daily_status',
        'makron_delete_answer','makron_eval','makron_get_or_create_daily_set',
        'makron_start_daily_session','makron_start_weakness_session','makron_update_answer_score',
        'makron_weakness_questions','my_org_ids','org_create','poll_results','purchase_shop_item',
        'review_material_edit','spend_coins','submit_official_request'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;