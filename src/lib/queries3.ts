// Stage 3 browser reads (RLS-scoped).
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MemoryKind } from "@/lib/memory/validate";
import { MEMORY_TABLE } from "@/lib/memory/validate";

export const qk3 = {
  notifications: ["notifications"] as const,
  unread: ["notifications-unread"] as const,
  memory: (k: MemoryKind) => ["memory", k] as const,
  history: (section: string) => ["history", section] as const,
  access: ["access"] as const,
};

const must = <D>(r: { data: D | null; error: unknown }): D => {
  if (r.error) throw r.error;
  return r.data as D;
};

export const notificationsQuery = queryOptions({
  queryKey: qk3.notifications,
  queryFn: async () => must(await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)),
});

export const unreadCountQuery = queryOptions({
  queryKey: qk3.unread,
  queryFn: async () => {
    const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    if (error) throw error;
    return count ?? 0;
  },
});

export const memoryQuery = (k: MemoryKind) =>
  queryOptions({
    queryKey: qk3.memory(k),
    queryFn: async () => must(await supabase.from(MEMORY_TABLE[k]).select("id, source, summary, confidence, created_at, expires_at").order("created_at", { ascending: false }).limit(200)),
  });

export const HISTORY_SECTIONS = ["conversations", "jobs", "github", "mcp", "approvals", "changes", "tests"] as const;
export type HistorySection = (typeof HISTORY_SECTIONS)[number];

export interface HistoryRow {
  id: string;
  title: string;
  status: string | null;
  at: string;
  href?: { to: "/chats/$id" | "/tasks/$id" | "/projects/$id"; id: string } | undefined;
}

export const historyQuery = (section: HistorySection) =>
  queryOptions({
    queryKey: qk3.history(section),
    queryFn: async (): Promise<HistoryRow[]> => {
      switch (section) {
        case "conversations":
          return must(await supabase.from("conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(100)).map((r) => ({
            id: r.id, title: r.title ?? "—", status: null, at: r.updated_at, href: { to: "/chats/$id", id: r.id },
          }));
        case "jobs":
          return must(await supabase.from("agent_jobs").select("id, request_text, status, created_at").order("created_at", { ascending: false }).limit(100)).map((r) => ({
            id: r.id, title: r.request_text, status: r.status, at: r.created_at, href: { to: "/tasks/$id", id: r.id },
          }));
        case "github":
          return must(await supabase.from("audit_logs").select("id, action, entity_type, created_at").or("action.ilike.%GITHUB%,action.ilike.%REPO%,action.ilike.%PUSH%,action.ilike.%PR_%").order("created_at", { ascending: false }).limit(100)).map((r) => ({
            id: r.id, title: r.action, status: r.entity_type, at: r.created_at,
          }));
        case "mcp":
          return must(await supabase.from("audit_logs").select("id, action, entity_type, created_at").ilike("action", "%MCP%").order("created_at", { ascending: false }).limit(100)).map((r) => ({
            id: r.id, title: r.action, status: r.entity_type, at: r.created_at,
          }));
        case "approvals":
          return must(await supabase.from("approvals").select("id, action_type, status, created_at, job_id").order("created_at", { ascending: false }).limit(100)).map((r) => ({
            id: r.id, title: r.action_type, status: r.status, at: r.created_at, href: r.job_id ? { to: "/tasks/$id", id: r.job_id } : undefined,
          }));
        case "changes":
          return must(await supabase.from("change_sets").select("id, summary, status, created_at, job_id").order("created_at", { ascending: false }).limit(100)).map((r) => ({
            id: r.id, title: r.summary || "—", status: r.status, at: r.created_at, href: r.job_id ? { to: "/tasks/$id", id: r.job_id } : undefined,
          }));
        case "tests":
          return must(await supabase.from("validation_runs").select("id, status, created_at, job_id").order("created_at", { ascending: false }).limit(100)).map((r: any) => ({
            id: r.id, title: r.job_id ?? "—", status: r.status, at: r.created_at, href: r.job_id ? { to: "/tasks/$id", id: r.job_id } : undefined,
          }));
      }
    },
  });
