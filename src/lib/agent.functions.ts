// Legacy web transport; business logic is shared with the standalone API.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createAgentJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { createAgentJob: operation } = await import("@/lib/operations/agent.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const runAgentJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { runAgentJob: operation, executeAgentPipeline } = await import("@/lib/operations/agent.server");
    // Preserve legacy behavior until its deployment opts into the queue migration.
    if (process.env["WAKEEL_WORKER_ENABLED"] !== "true") return executeAgentPipeline(operation.validate(data), {...context,request:getRequest()});
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const cancelAgentJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { cancelAgentJob: operation } = await import("@/lib/operations/agent.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const requestGitAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { requestGitAction: operation } = await import("@/lib/operations/agent.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { decideApproval: operation } = await import("@/lib/operations/agent.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });

export const getRuntimeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => raw as any)
  .handler(async ({data,context}) => {
    const { getRuntimeStatus: operation } = await import("@/lib/operations/agent.server");
    return operation.execute({data:operation.validate(data),context:{...context, request:getRequest()}});
  });
