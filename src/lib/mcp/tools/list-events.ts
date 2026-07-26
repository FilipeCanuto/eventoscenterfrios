import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_events",
  title: "Listar eventos",
  description:
    "Lista os eventos visíveis para o usuário conectado, com data, status, local e limite de inscrições.",
  inputSchema: {
    status: z
      .enum(["draft", "published", "closed"])
      .optional()
      .describe("Filtra por status do evento."),
    search: z.string().optional().describe("Busca por parte do nome do evento."),
    limit: z.number().int().optional().describe("Máximo de eventos (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const max = Math.min(Math.max(limit ?? 25, 1), 100);

    let query = supabaseForUser(ctx)
      .from("events")
      .select(
        "id, name, slug, status, event_date, event_end_date, location_type, location_value, registration_limit, capacity, registration_deadline, created_at",
      )
      .order("event_date", { ascending: false })
      .limit(max);

    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query;
    if (error) return failure(error.message);
    return ok({ count: data?.length ?? 0, events: data ?? [] });
  },
});
