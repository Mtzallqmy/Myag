// Legacy web transport; business logic is shared with the standalone API.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { getMyAccess: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { claimFirstAdmin: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const addMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { addMemory: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { globalSearch: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const getUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { getUsage: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminOverview: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminList: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminAudit: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminFlags: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminSetFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminSetFlag: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminSetKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminSetKillSwitch: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminSetPlan: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminSetRole: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const adminHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { adminHealth: operation } = await import("@/lib/operations/stage3.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });
