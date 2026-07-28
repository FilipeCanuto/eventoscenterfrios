// Renderiza o HTML de um template de e-mail (confirmation, reminder_1d/2h).
// Suporta três modos:
//  1) { registrationId, templateType } -> e-mail real do inscrito
//  2) { eventId, templateType, draftSubject, draftBody } -> prévia de rascunho
//  3) { logId } -> snapshot exato do e-mail entregue (quando existir)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEmail } from "../_shared/email-templates.ts";
import { loadCustomTemplate } from "../_shared/custom-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TemplateType = "confirmation" | "reminder_1d" | "reminder_2h";
const VALID: TemplateType[] = ["confirmation", "reminder_1d", "reminder_2h"];

interface Payload {
  registrationId?: string;
  eventId?: string;
  logId?: string;
  templateType?: TemplateType;
  draftSubject?: string;
  draftBody?: string;
  origin?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EVENT_FIELDS =
  "id, name, event_date, event_end_date, timezone, location_type, location_value, slug, primary_color, logo_url, background_image_url, user_id";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const body = (await req.json()) as Payload;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const origin = body.origin?.replace(/\/$/, "") || "https://eventos.centerfrios.com";
    const previewToken = "00000000-0000-0000-0000-000000000000";

    // ---- Modo 3: snapshot armazenado ----
    if (body.logId) {
      const { data: log } = await supabase
        .from("email_send_log")
        .select("id, registration_id, email_type, rendered_html, rendered_subject, created_at, recipient_email")
        .eq("id", body.logId)
        .maybeSingle();
      if (!log) return json({ error: "not_found" }, 404);

      if (!isAdmin && log.registration_id) {
        const { data: reg } = await supabase
          .from("registrations")
          .select("id, events ( user_id )")
          .eq("id", log.registration_id)
          .maybeSingle();
        if ((reg as any)?.events?.user_id !== userId) return json({ error: "forbidden" }, 403);
      }

      if (log.rendered_html) {
        return json({
          ok: true,
          snapshot: true,
          subject: log.rendered_subject || "",
          html: log.rendered_html,
          text: "",
        });
      }
      // Sem snapshot: reconstrói a partir do template atual
      body.registrationId = log.registration_id || undefined;
      body.templateType = (log.email_type === "registration_confirmation"
        ? "confirmation"
        : log.email_type) as TemplateType;
      if (!body.registrationId || !VALID.includes(body.templateType)) {
        return json({ error: "no_snapshot" }, 404);
      }
    }

    const templateType = body.templateType;
    if (!templateType || !VALID.includes(templateType)) return json({ error: "invalid_payload" }, 400);

    let ev: any = null;
    let registrationId = "00000000-0000-0000-0000-000000000000";
    let recipientName = "Maria Silva";
    let vendedor: string | null = null;

    if (body.registrationId) {
      const { data: reg } = await supabase
        .from("registrations")
        .select(`id, lead_name, lead_email, event_id, tracking, events ( ${EVENT_FIELDS} )`)
        .eq("id", body.registrationId)
        .maybeSingle();
      if (!reg) return json({ error: "not_found" }, 404);
      ev = (reg as any).events;
      registrationId = reg.id;
      recipientName = reg.lead_name || "";
      vendedor = ((reg as any).tracking || {})?.vendedor || null;
    } else if (body.eventId) {
      const { data: evRow } = await supabase
        .from("events").select(EVENT_FIELDS).eq("id", body.eventId).maybeSingle();
      if (!evRow) return json({ error: "not_found" }, 404);
      ev = evRow;
      // usa um inscrito real (se existir) para deixar a prévia mais fiel
      const { data: sample } = await supabase
        .from("registrations")
        .select("id, lead_name, tracking")
        .eq("event_id", body.eventId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sample) {
        registrationId = sample.id;
        recipientName = sample.lead_name || recipientName;
        vendedor = ((sample as any).tracking || {})?.vendedor || null;
      }
    } else {
      return json({ error: "invalid_payload" }, 400);
    }

    if (ev.user_id !== userId && !isAdmin) return json({ error: "forbidden" }, 403);

    let referenceDate: Date | undefined;
    if (ev?.event_date) {
      const evMs = new Date(ev.event_date).getTime();
      if (templateType === "reminder_1d") referenceDate = new Date(evMs - 24 * 60 * 60 * 1000);
      else if (templateType === "reminder_2h") referenceDate = new Date(evMs - 2 * 60 * 60 * 1000);
    }

    const hasDraft =
      typeof body.draftBody === "string" || typeof body.draftSubject === "string";
    const customTemplate = hasDraft
      ? { subject: body.draftSubject ?? null, body: body.draftBody ?? null }
      : await loadCustomTemplate(supabase, ev.id, templateType);

    const built = buildEmail(templateType, {
      registrationId,
      recipientName,
      event: ev,
      origin,
      unsubscribeToken: templateType === "confirmation" ? null : previewToken,
      referenceDate,
      vendedor,
      customTemplate,
    });

    return json({ ok: true, snapshot: false, subject: built.subject, html: built.html, text: built.text });
  } catch (e) {
    console.error("[render-email-preview] unhandled", e);
    return json({ error: "internal_error" }, 500);
  }
});
