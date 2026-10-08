export type { GhItem } from "@/lib/operations/github.server";
// Legacy web transport; business logic is shared with the standalone API.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const connectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { connectGithub: operation } = await import("@/lib/operations/github.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const refreshGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { refreshGithub: operation } = await import("@/lib/operations/github.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const disconnectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { disconnectGithub: operation } = await import("@/lib/operations/github.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const listRepoItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { listRepoItems: operation } = await import("@/lib/operations/github.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const importRepository = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { importRepository: operation } = await import("@/lib/operations/github.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });
