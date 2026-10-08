// Legacy web transport; business logic is shared with the standalone API.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export type { SearchHit } from "@/lib/server/retrieval.server";

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { createProject: operation } = await import("@/lib/operations/projects.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const ingestProjectBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { ingestProjectBatch: operation } = await import("@/lib/operations/projects.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const finalizeProjectIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { finalizeProjectIngest: operation } = await import("@/lib/operations/projects.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const searchProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { searchProject: operation } = await import("@/lib/operations/projects.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const readFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { readFile: operation } = await import("@/lib/operations/projects.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const askProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { askProject: operation } = await import("@/lib/operations/projects.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });
