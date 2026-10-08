import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

export function useNewChat() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useI18n();
  return useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("UNAUTHORIZED");
      const { data: pref } = await supabase.from("routing_preferences").select("mode, preferred_model_id").maybeSingle();
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: u.user.id,
          routing_mode: pref?.mode ?? "AUTO",
          active_model_id: pref?.mode === "MANUAL" ? (pref.preferred_model_id ?? null) : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: qk.conversations });
      navigate({ to: "/chats/$id", params: { id } });
    },
    onError: () => toast.error(t.common.error),
  });
}
