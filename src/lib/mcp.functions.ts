// Legacy web transport; business logic is shared with the standalone API.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const addMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { addMcpServer: operation } = await import("@/lib/operations/mcp.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const refreshMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { refreshMcpServer: operation } = await import("@/lib/operations/mcp.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const startMcpOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { startMcpOAuth: operation } = await import("@/lib/operations/mcp.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const setMcpToolState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { setMcpToolState: operation } = await import("@/lib/operations/mcp.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const callMcpTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { callMcpTool: operation } = await import("@/lib/operations/mcp.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });
