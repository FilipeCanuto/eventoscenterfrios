import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "check_in_registration",
  title: "Fazer check-in de inscrito",
  description:
    "Registra o check-in (presença) de um inscrito pelo ID da inscrição. Se já houver check-in, informa o horário existente.",
  inputSchema: {
    registration_id: z.string().describe("ID (uuid) da inscrição."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ registration_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: existing, error: readError } = await supabase
      .from("registrations")
      .select("id, lead_name, lead_email, checked_in_at, event_id")
      .eq("id", registration_id)
      .maybeSingle();
    if (readError) return failure(readError.message);
    if (!existing) return failure("Inscrição não encontrada ou sem permissão de acesso.");
    if (existing.checked_in_at) {
      return ok({ already_checked_in: true, registration: existing });
    }

    const { data, error } = await supabase
      .from("registrations")
      .update({ checked_in_at: new Date().toISOString(), status: "attended" as never })
      .eq("id", registration_id)
      .select("id, lead_name, lead_email, status, checked_in_at, event_id")
      .maybeSingle();
    if (error) return failure(error.message);
    return ok({ already_checked_in: false, registration: data });
  },
});
