// Renderiza o HTML de um template de e-mail (confirmation, reminder_1d/2h)
// usando os dados reais do inscrito + evento. Usado pelo painel para
// mostrar uma prévia idêntica ao que será (ou foi) enviado.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEmail } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TemplateType = "confirmation" | "reminder_1d" | "reminder_2h";
const VALID: TemplateType[] = ["confirmation", "reminder_1d", "reminder_2h"];

interface Payload {
  registrationId: string;
  templateType: TemplateType;
  origin?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.registrationId || !VALID.includes(body.templateType)) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: reg } = await supabase
      .from("registrations")
      .select(`id, lead_name, lead_email, event_id,
        events ( id, name, event_date, event_end_date, timezone, location_type,
                 location_value, slug, primary_color, logo_url, user_id )`)
      .eq("id", body.registrationId).maybeSingle();

    if (!reg) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ev = (reg as any).events;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (ev.user_id !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Token fictício só para a prévia (URL de unsubscribe não-funcional)
    const previewToken = "00000000-0000-0000-0000-000000000000";
    const origin = body.origin?.replace(/\/$/, "") || "https://eventos.centerfrios.com";

    // Calcula o instante em que o e-mail será enviado para refletir
    // contagens regressivas reais (ex.: lembrete 1d => "24h", 2h => "2h").
    let referenceDate: Date | undefined;
    if (ev?.event_date) {
      const evMs = new Date(ev.event_date).getTime();
      if (body.templateType === "reminder_1d") {
        referenceDate = new Date(evMs - 24 * 60 * 60 * 1000);
      } else if (body.templateType === "reminder_2h") {
        referenceDate = new Date(evMs - 2 * 60 * 60 * 1000);
      }
    }

    const built = buildEmail(body.templateType, {
      registrationId: reg.id,
      recipientName: reg.lead_name || "",
      event: ev,
      origin,
      unsubscribeToken: body.templateType === "confirmation" ? null : previewToken,
      referenceDate,
    });

    return new Response(
      JSON.stringify({ ok: true, subject: built.subject, html: built.html, text: built.text }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[render-email-preview] unhandled", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
