// Carrega o template customizado do evento (quando existir e estiver ativo).
// Se não houver, retorna null e o sistema usa o template padrão em código.
export async function loadCustomTemplate(
  supabase: any,
  eventId: string,
  templateType: "confirmation" | "reminder_1d" | "reminder_2h",
): Promise<{ subject: string | null; body: string | null } | null> {
  try {
    const { data } = await supabase
      .from("email_templates")
      .select("subject, body, enabled")
      .eq("event_id", eventId)
      .eq("template_type", templateType)
      .maybeSingle();
    if (!data || data.enabled === false) return null;
    if (!(data.body || "").trim() && !(data.subject || "").trim()) return null;
    return { subject: data.subject ?? null, body: data.body ?? null };
  } catch (_) {
    return null;
  }
}
