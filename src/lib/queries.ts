// Browser-side reads. RLS guarantees each user only sees their own rows.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Provider = Database["public"]["Tables"]["ai_providers"]["Row"];
export type Model = Database["public"]["Tables"]["ai_models"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type RoutingPref = Database["public"]["Tables"]["routing_preferences"]["Row"];

export const qk = {
  providers: ["providers"] as const,
  models: ["models"] as const,
  routing: ["routing"] as const,
  conversations: ["conversations"] as const,
  messages: (id: string) => ["messages", id] as const,
  conversation: (id: string) => ["conversation", id] as const,
  profile: ["profile"] as const,
};

export const providersQuery = queryOptions({
  queryKey: qk.providers,
  queryFn: async (): Promise<Provider[]> => {
    const { data, error } = await supabase
      .from("ai_providers")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },
});

export const modelsQuery = queryOptions({
  queryKey: qk.models,
  queryFn: async (): Promise<Model[]> => {
    const all: Model[] = [];
    for (let from = 0; from < 6000; from += 1000) {
      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .order("display_name", { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    return all;
  },
});

export const routingQuery = queryOptions({
  queryKey: qk.routing,
  queryFn: async (): Promise<RoutingPref | null> => {
    const { data, error } = await supabase.from("routing_preferences").select("*").maybeSingle();
    if (error) throw error;
    if (data) return data;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;
    const { data: created } = await supabase
      .from("routing_preferences")
      .insert({ user_id: user.user.id })
      .select("*")
      .single();
    return created ?? null;
  },
});

export const conversationsQuery = queryOptions({
  queryKey: qk.conversations,
  queryFn: async (): Promise<Conversation[]> => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data;
  },
});

export const conversationQuery = (id: string) =>
  queryOptions({
    queryKey: qk.conversation(id),
    queryFn: async (): Promise<Conversation | null> => {
      const { data, error } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const messagesQuery = (id: string) =>
  queryOptions({
    queryKey: qk.messages(id),
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

export const profileQuery = queryOptions({
  queryKey: qk.profile,
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    return { email: u.user.email ?? "", profile: data };
  },
});
