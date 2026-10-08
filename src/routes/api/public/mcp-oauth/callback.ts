import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/mcp-oauth/callback")({
  server: {handlers: {GET: async ({request}) => {
    const { handleMcpCallback } = await import("@/lib/server/mcp-oauth.server");
    return handleMcpCallback(request);
  }}}
});
