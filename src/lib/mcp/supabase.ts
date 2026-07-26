import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Supabase client bound to the MCP caller's verified access token so that
 * Row Level Security runs as that user. Never called at module load time.
 */
export function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function unauthenticated() {
  return {
    content: [
      { type: "text" as const, text: "Não autenticado. Conecte-se novamente." },
    ],
    isError: true,
  };
}

export function failure(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function ok(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}
