// OAuth redirect target for MCP servers. Validates single-use state (10 min), exchanges
// the code with PKCE server-side, stores tokens encrypted, then redirects to the app.
import { createFileRoute } from "@tanstack/react-router";
import { decryptSmall, storeMcpCredential } from "@/lib/server/secrets.server";
import { exchangeToken } from "@/lib/server/mcp.server";

const back = (origin: string, status: string) =>
  new Response(null, { status: 302, headers: { location: `${origin}/integrations?oauth=${status}`, "cache-control": "no-store" } });

export const Route = createFileRoute("/api/public/mcp-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        if (!state || state.length > 200) return back(url.origin, "invalid");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Single-use: mark used atomically.
        const { data: st } = await supabaseAdmin
          .from("mcp_oauth_states")
          .update({ used_at: new Date().toISOString() })
          .eq("state", state)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .select("*")
          .maybeSingle();
        if (!st) return back(url.origin, "expired");
        if (!code || url.searchParams.get("error")) return back(url.origin, "denied");
        try {
          const verifier = await decryptSmall(st.code_verifier_enc, `pkce:${state}`);
          const clientSecret = st.client_secret_enc ? await decryptSmall(st.client_secret_enc, `client:${state}`) : undefined;
          const t = await exchangeToken(st.token_endpoint, {
            grant_type: "authorization_code",
            code,
            redirect_uri: st.redirect_uri,
            client_id: st.client_id,
            code_verifier: verifier,
            ...(clientSecret ? { client_secret: clientSecret } : {}),
          });
          await storeMcpCredential(
            st.server_id,
            st.user_id,
            {
              type: "OAUTH",
              access_token: t.access_token,
              ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}),
              token_endpoint: st.token_endpoint,
              client_id: st.client_id,
              ...(clientSecret ? { client_secret: clientSecret } : {}),
            },
            { scopes: t.scope ?? st.scope, expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null },
          );
          await supabaseAdmin.from("mcp_servers").update({ status: "AUTHORIZED", last_error_code: null }).eq("id", st.server_id).eq("user_id", st.user_id);
          return back(url.origin, "ok");
        } catch {
          return back(url.origin, "failed");
        }
      },
    },
  },
});
