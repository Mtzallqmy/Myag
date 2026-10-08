// Legacy web transport; business logic is shared with the standalone API.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { createProvider: operation } = await import("@/lib/operations/providers.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const updateProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { updateProvider: operation } = await import("@/lib/operations/providers.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const deleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { deleteProvider: operation } = await import("@/lib/operations/providers.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const testProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { testProvider: operation } = await import("@/lib/operations/providers.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const testModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { testModel: operation } = await import("@/lib/operations/providers.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });
