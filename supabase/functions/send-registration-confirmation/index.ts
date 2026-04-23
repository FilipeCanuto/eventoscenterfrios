import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildConfirmation } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "Eventos Centerfrios <eventos@eventos.centerfrios.com>";
const REPLY_TO_ADDRESS = "contato@eventos.centerfrios.com";
const UNSUBSCRIBE_MAILTO = "contato@eventos.centerfrios.com";

interface Payload {
  registrationId: string;
  origin?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[send-registration-confirmation] invoked", { method: req.method });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      console.error("[send-registration-confirmation] Missing gateway secrets");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.registrationId || typeof body.registrationId !== "string") {
      return new Response(JSON.stringify({ error: "Missing registrationId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: reg, error: regErr } = await supabase
      .from("registrations")
      .select(`
        id, status, lead_email, lead_name, tracking,
        events ( id, name, event_date, event_end_date, timezone,
                 location_type, location_value, slug, primary_color, logo_url )
      `)
      .eq("id", body.registrationId)
      .maybeSingle();

    if (regErr || !reg) {
      console.warn("[send-registration-confirmation] Registration not found", body.registrationId);
      return new Response(JSON.stringify({ error: "Registration not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reg.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Registration cancelled" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmail = (reg.lead_email || "").trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "No valid email on registration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ev = (reg as any).events;
    if (!ev) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Schedule reminders (idempotent via UNIQUE constraint)
    try {
      await supabase.rpc("schedule_event_reminders", { p_registration_id: reg.id });
    } catch (e) {
      console.warn("[send-registration-confirmation] schedule_event_reminders failed", e);
    }

    const tracking = (reg.tracking as Record<string, unknown>) || {};
    if (tracking.confirmation_email_sent_at) {
      console.log("[send-registration-confirmation] Already sent, skipping", body.registrationId);
      return new Response(JSON.stringify({ ok: true, alreadySent: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin =
      body.origin?.replace(/\/$/, "") ||
      req.headers.get("origin")?.replace(/\/$/, "") ||
      "https://eventos.centerfrios.com";

    const built = buildConfirmation({
      registrationId: reg.id,
      recipientName: reg.lead_name || "",
      event: ev,
      origin,
    });

    const resp = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [recipientEmail],
        reply_to: REPLY_TO_ADDRESS,
        subject: built.subject,
        html: built.html,
        text: built.text,
        headers: {
          "List-Unsubscribe": `<mailto:${UNSUBSCRIBE_MAILTO}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "type", value: "registration_confirmation" },
          { name: "event_slug", value: (ev.slug || "unknown").slice(0, 50) },
        ],
      }),
    });

    const respBody = await resp.text();
    if (!resp.ok) {
      console.error("[send-registration-confirmation] Resend error", resp.status, respBody);
      if (resp.status === 401 || resp.status === 403) {
        return new Response(JSON.stringify({ error: "Email auth failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ ok: false, providerStatus: resp.status, providerBody: respBody }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("registrations")
      .update({
        tracking: { ...tracking, confirmation_email_sent_at: new Date().toISOString() },
      })
      .eq("id", body.registrationId);

    console.log("[send-registration-confirmation] Sent", recipientEmail);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-registration-confirmation] Unhandled", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
