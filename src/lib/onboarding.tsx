import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type OnboardingState = {
  loading: boolean;
  needsProfile: boolean;
  needsTutorial: boolean;
  reload: () => Promise<void>;
};

/**
 * OAuth（Google/Apple）などでメール・パスワードのみが登録された利用者に対し、
 * ユーザー名などの残りの項目を入力させ、その後チュートリアルを表示するための状態管理。
 */
export function useOnboarding(): OnboardingState {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [needsTutorial, setNeedsTutorial] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setNeedsProfile(false);
      setNeedsTutorial(false);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any).rpc("my_profile_private");
    const p = (data ?? {}) as any;
    setNeedsProfile(!p.onboarded_at);
    setNeedsTutorial(Boolean(p.onboarded_at) && !p.tutorial_done);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    reload();
  }, [authLoading, reload]);

  return { loading, needsProfile, needsTutorial, reload };
}
