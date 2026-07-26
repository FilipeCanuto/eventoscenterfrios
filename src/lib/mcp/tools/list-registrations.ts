import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_registrations",
  title: "Listar inscritos",
  description:
    "Lista os inscritos de um evento com nome, e-mail, WhatsApp, status e horário de check-in. Permite buscar por nome/e-mail/telefone.",
  inputSchema: {
    event_id: z.string().describe("ID (uuid) do evento."),
    search: z.string().optional().describe("Busca por nome, e-mail ou WhatsApp."),
    status: z.string().optional().describe("Filtra pelo status da inscrição (ex.: pending, attended, cancelled)."),
    checked_in: z
      .boolean()
      .optional()
      .describe("true = apenas quem fez check-in; false = apenas quem ainda não fez."),
    limit: z.number().int().optional().describe("Máximo de inscritos (padrão 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id, search, status, checked_in, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const max = Math.min(Math.max(limit ?? 50, 1), 200);

    let query = supabaseForUser(ctx)
      .from("registrations")
      .select("id, event_id, lead_name, lead_email, lead_whatsapp, status, checked_in_at, created_at")
      .eq("event_id", event_id)
      .order("created_at", { ascending: false })
      .limit(max);

    if (status) query = query.eq("status", status as never);
    if (checked_in === true) query = query.not("checked_in_at", "is", null);
    if (checked_in === false) query = query.is("checked_in_at", null);
    if (search) {
      const term = search.replace(/[%,]/g, " ").trim();
      query = query.or(
        `lead_name.ilike.%${term}%,lead_email.ilike.%${term}%,lead_whatsapp.ilike.%${term}%`,
      );
    }

    const { data, error } = await query;
    if (error) return failure(error.message);
    return ok({ count: data?.length ?? 0, registrations: data ?? [] });
  },
});
