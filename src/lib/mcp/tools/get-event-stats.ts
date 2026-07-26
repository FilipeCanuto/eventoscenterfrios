import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_event_stats",
  title: "Estatísticas do evento",
  description:
    "Retorna o resumo de um evento: total de inscrições, presentes (check-in), pendentes e cancelados.",
  inputSchema: {
    event_id: z.string().describe("ID (uuid) do evento."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, slug, status, event_date, event_end_date, capacity, registration_limit")
      .eq("id", event_id)
      .maybeSingle();
    if (eventError) return failure(eventError.message);
    if (!event) return failure("Evento não encontrado ou sem permissão de acesso.");

    const { data: rows, error } = await supabase
      .from("registrations")
      .select("status, checked_in_at")
      .eq("event_id", event_id);
    if (error) return failure(error.message);

    const registrations = rows ?? [];
    const byStatus: Record<string, number> = {};
    for (const row of registrations) {
      const key = String(row.status ?? "unknown");
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }
    const checkedIn = registrations.filter((r) => r.checked_in_at).length;
    const active = registrations.filter((r) => String(r.status) !== "cancelled").length;

    return ok({
      event,
      total_registrations: registrations.length,
      active_registrations: active,
      checked_in: checkedIn,
      attendance_rate_percent: active ? Math.round((checkedIn / active) * 1000) / 10 : 0,
      by_status: byStatus,
    });
  },
});
