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

// Validação defensiva de e-mail (evita bounce por digitação ruim).
const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

interface Payload {
  registrationId: string;
  origin?: string | null;
  force?: boolean;
}

async function logAttempt(
  supabase: ReturnType<typeof createClient>,
  row: {
    registration_id: string;
    email_type: string;
    recipient_email: string | null;
    status: string;
    provider_status?: number | null;
    error_message?: string | null;
  },
) {
  try {
    await supabase.from("email_send_log").insert(row);
  } catch (e) {
    console.warn("[send-registration-confirmation] log insert failed", e);
  }
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

    // ─── Cooldown global ─────────────────────────────────────────────
    // Se o provedor está rejeitando todos os envios (ex.: domínio não
    // verificado), respeitamos um cooldown para não gerar cascata de erros
    // 403 e não consumir cota. O cooldown só bloqueia envios automáticos;
    // o reenvio manual (force=true) ainda passa para diagnóstico.
    if (!body.force) {
      try {
        const { data: state } = await supabase
          .from("email_send_state")
          .select("cooldown_until,last_provider_status,last_provider_error")
          .eq("id", 1)
          .maybeSingle();
        if (state?.cooldown_until && new Date(state.cooldown_until as string) > new Date()) {
          console.warn(
            "[send-registration-confirmation] in cooldown, skipping",
            state.cooldown_until,
            state.last_provider_status,
          );
          await logAttempt(supabase, {
            registration_id: body.registrationId,
            email_type: "confirmation",
            recipient_email: null,
            status: "skipped",
            error_message: `cooldown_until=${state.cooldown_until}`,
          });
          return new Response(
            JSON.stringify({ ok: false, skipped: true, reason: "cooldown" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (e) {
        console.warn("[send-registration-confirmation] cooldown check failed", e);
      }
    }

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

    const recipientEmail = (reg.lead_email || "").trim().toLowerCase();
    if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
      await logAttempt(supabase, {
        registration_id: reg.id,
        email_type: "confirmation",
        recipient_email: recipientEmail || null,
        status: "failed",
        error_message: "invalid_email_address",
      });
      return new Response(JSON.stringify({ error: "No valid email on registration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Supressão ────────────────────────────────────────────────────
    // Se o e-mail já foi marcado como suprimido (bounce, complaint, inválido),
    // não tentamos enviar novamente — isso protege a reputação do remetente.
    try {
      const { data: suppressed } = await supabase
        .from("suppressed_emails")
        .select("email,reason")
        .eq("email", recipientEmail)
        .maybeSingle();
      if (suppressed) {
        console.warn("[send-registration-confirmation] suppressed", recipientEmail, suppressed.reason);
        await logAttempt(supabase, {
          registration_id: reg.id,
          email_type: "confirmation",
          recipient_email: recipientEmail,
          status: "suppressed",
          error_message: suppressed.reason,
        });
        return new Response(
          JSON.stringify({ ok: false, suppressed: true, reason: suppressed.reason }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (e) {
      console.warn("[send-registration-confirmation] suppression check failed", e);
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
    if (tracking.confirmation_email_sent_at && !body.force) {
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

      const lower = respBody.toLowerCase();
      const isDomainConfigError =
        resp.status === 401 || resp.status === 403 ||
        lower.includes("domain is not verified") ||
        lower.includes("not verified") ||
        lower.includes("validation_error");
      const isInvalidRecipient =
        resp.status === 422 ||
        lower.includes("invalid `to`") ||
        lower.includes("invalid email") ||
        lower.includes("invalid_recipient");

      // Aciona cooldown global de 30 minutos quando o erro é de configuração
      // do remetente — evita rajada de tentativas falhas.
      if (isDomainConfigError) {
        try {
          await supabase
            .from("email_send_state")
            .upsert({
              id: 1,
              cooldown_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              last_provider_status: resp.status,
              last_provider_error: respBody.slice(0, 500),
              updated_at: new Date().toISOString(),
            });
        } catch (e) {
          console.warn("[send-registration-confirmation] cooldown set failed", e);
        }
      }

      // Suprime endereços claramente inválidos (4xx específicos do destinatário).
      if (isInvalidRecipient) {
        try {
          await supabase.from("suppressed_emails").upsert({
            email: recipientEmail,
            reason: "invalid_recipient",
            source: "send-registration-confirmation",
          });
        } catch (e) {
          console.warn("[send-registration-confirmation] suppression upsert failed", e);
        }
      }

      await logAttempt(supabase, {
        registration_id: reg.id,
        email_type: "confirmation",
        recipient_email: recipientEmail,
        status: "failed",
        provider_status: resp.status,
        error_message: respBody.slice(0, 500),
      });

      return new Response(
        JSON.stringify({ ok: false, providerStatus: resp.status, providerBody: respBody.slice(0, 500) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Envio OK: limpa cooldown se estava setado.
    try {
      await supabase
        .from("email_send_state")
        .update({ cooldown_until: null, updated_at: new Date().toISOString() })
        .eq("id", 1);
    } catch (e) {
      console.warn("[send-registration-confirmation] cooldown clear failed", e);
    }

    await supabase
      .from("registrations")
      .update({
        tracking: { ...tracking, confirmation_email_sent_at: new Date().toISOString() },
      })
      .eq("id", body.registrationId);

    await logAttempt(supabase, {
      registration_id: reg.id,
      email_type: "confirmation",
      recipient_email: recipientEmail,
      status: "sent",
      provider_status: resp.status,
    });

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
