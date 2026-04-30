import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEmail } from "../_shared/email-templates.ts";
import { prepareEmailForSend } from "../_shared/email-validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "Eventos Centerfrios <eventos@eventos.centerfrios.com>";
const REPLY_TO_ADDRESS = "contato@eventos.centerfrios.com";
const PUBLIC_ORIGIN = "https://eventos.centerfrios.com";
const BATCH_SIZE = 15;
const PER_ITEM_DELAY_MS = 300; // ~3/s, bem abaixo do rate limit do Resend

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[process-reminder-queue] tick");

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ─── Cooldown global ──────────────────────────────────────────────
    try {
      const { data: state } = await supabase
        .from("email_send_state")
        .select("cooldown_until,last_provider_status")
        .eq("id", 1)
        .maybeSingle();
      if (state?.cooldown_until && new Date(state.cooldown_until as string) > new Date()) {
        console.warn("[process-reminder-queue] in cooldown, skipping cycle", state.cooldown_until);
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "cooldown", until: state.cooldown_until }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (e) {
      console.warn("[process-reminder-queue] cooldown check failed", e);
    }

    // Pré-carrega supressões.
    let suppressedSet = new Set<string>();
    try {
      const { data: sup } = await supabase.from("suppressed_emails").select("email");
      suppressedSet = new Set((sup || []).map((r: any) => (r.email || "").toLowerCase()));
    } catch (e) {
      console.warn("[process-reminder-queue] suppression load failed", e);
    }

    // Cancela qualquer reminder_7d remanescente (produto descontinuado).
    try {
      await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled", error: "reminder_7d_disabled", updated_at: new Date().toISOString() })
        .eq("email_type", "reminder_7d")
        .eq("status", "pending");
    } catch (e) {
      console.warn("[process-reminder-queue] cancel reminder_7d failed", e);
    }

    // ---- Catch-up: re-trigger missing confirmation emails ----
    let confirmationCatchUp = 0;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: missing } = await supabase
        .from("registrations")
        .select("id, lead_email, tracking")
        .gte("created_at", since)
        .neq("status", "cancelled")
        .not("lead_email", "is", null)
        .limit(50);
      const pending = (missing || []).filter((r: any) => {
        const t = r.tracking || {};
        if (t.confirmation_email_sent_at) return false;
        const e = (r.lead_email || "").toLowerCase();
        return e && !suppressedSet.has(e);
      });
      // Limita o catch-up para não gerar rajada se houver backlog grande.
      for (const r of pending.slice(0, 5)) {
        try {
          await supabase.functions.invoke("send-registration-confirmation", {
            body: { registrationId: r.id },
          });
          confirmationCatchUp++;
          await sleep(PER_ITEM_DELAY_MS);
        } catch (e) {
          console.warn("[process-reminder-queue] catch-up failed", r.id, e);
        }
      }
      if (confirmationCatchUp > 0) {
        console.log("[process-reminder-queue] catch-up sent", confirmationCatchUp);
      }
    } catch (e) {
      console.warn("[process-reminder-queue] catch-up scan failed", e);
    }

    // Pull batch of due pending emails (excluindo reminder_7d)
    const { data: due, error: dueErr } = await supabase
      .from("scheduled_emails")
      .select("id, registration_id, event_id, email_type, unsubscribe_token, attempts")
      .eq("status", "pending")
      .neq("email_type", "reminder_7d")
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (dueErr) {
      console.error("[process-reminder-queue] query error", dueErr);
      return new Response(JSON.stringify({ error: dueErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0, failed = 0, skipped = 0;

    for (const item of due) {
      try {
        // Anti-duplicação: se já existe envio bem-sucedido para
        // este (registration_id, email_type) em email_send_log,
        // marca este item como sent sem reenviar.
        try {
          const { data: prev } = await supabase
            .from("email_send_log")
            .select("id")
            .eq("registration_id", item.registration_id)
            .eq("email_type", item.email_type)
            .eq("status", "sent")
            .limit(1);
          if (prev && prev.length > 0) {
            await supabase.from("scheduled_emails")
              .update({ status: "sent", sent_at: new Date().toISOString(), error: "dedupe_already_sent" })
              .eq("id", item.id);
            skipped++;
            continue;
          }
        } catch (e) {
          console.warn("[process-reminder-queue] dedupe check failed", item.id, e);
        }

        // Load registration + event
        const { data: reg } = await supabase
          .from("registrations")
          .select(`id, status, lead_email, lead_name,
            events ( name, event_date, event_end_date, timezone, location_type, location_value, slug, primary_color, logo_url )`)
          .eq("id", item.registration_id)
          .maybeSingle();

        if (!reg || reg.status === "cancelled" || !reg.lead_email) {
          await supabase.from("scheduled_emails")
            .update({ status: "cancelled", error: "registration_unavailable" })
            .eq("id", item.id);
          skipped++;
          continue;
        }

        // Validação e normalização avançada
        const prep = prepareEmailForSend(reg.lead_email);
        if (!prep.ok) {
          await supabase.from("scheduled_emails")
            .update({ status: "failed", error: `invalid_email_address:${prep.reason}` })
            .eq("id", item.id);
          await supabase.from("email_send_log").insert({
            registration_id: reg.id,
            email_type: item.email_type,
            recipient_email: prep.email || null,
            status: "failed",
            error_message: `invalid_email_address: ${prep.reason}`,
          });
          if (prep.email) {
            await supabase.from("suppressed_emails").upsert({
              email: prep.email,
              reason: `invalid_format:${prep.reason}`,
              source: "process-reminder-queue",
            });
            suppressedSet.add(prep.email);
          }
          skipped++;
          continue;
        }
        const recipientEmail = prep.email;
        if (suppressedSet.has(recipientEmail)) {
          await supabase.from("scheduled_emails")
            .update({ status: "cancelled", error: "recipient_suppressed" })
            .eq("id", item.id);
          skipped++;
          continue;
        }

        const ev = (reg as any).events;
        if (!ev) {
          await supabase.from("scheduled_emails")
            .update({ status: "cancelled", error: "event_missing" })
            .eq("id", item.id);
          skipped++;
          continue;
        }

        const built = buildEmail(item.email_type as any, {
          registrationId: reg.id,
          recipientName: reg.lead_name || "",
          event: ev,
          origin: PUBLIC_ORIGIN,
          unsubscribeToken: item.unsubscribe_token,
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
              "List-Unsubscribe": `<${PUBLIC_ORIGIN}/unsubscribe-reminders/${item.unsubscribe_token}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            tags: [
              { name: "type", value: item.email_type },
              { name: "event_slug", value: (ev.slug || "unknown").slice(0, 50) },
            ],
          }),
        });

        const respBody = await resp.text();
        if (!resp.ok) {
          const lower = respBody.toLowerCase();
          const isDomainConfigError =
            resp.status === 401 || resp.status === 403 ||
            lower.includes("not verified") || lower.includes("validation_error");
          const isInvalidRecipient =
            resp.status === 422 ||
            lower.includes("invalid `to`") || lower.includes("invalid email");
          const isRateLimited = resp.status === 429;

          if (isDomainConfigError) {
            try {
              await supabase.from("email_send_state").upsert({
                id: 1,
                cooldown_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                last_provider_status: resp.status,
                last_provider_error: respBody.slice(0, 500),
                updated_at: new Date().toISOString(),
              });
            } catch (_) { /* noop */ }
          }
          if (isRateLimited) {
            try {
              await supabase.from("email_send_state").upsert({
                id: 1,
                cooldown_until: new Date(Date.now() + 60 * 1000).toISOString(),
                last_provider_status: 429,
                last_provider_error: respBody.slice(0, 500),
                updated_at: new Date().toISOString(),
              });
            } catch (_) { /* noop */ }
          }
          if (isInvalidRecipient) {
            try {
              await supabase.from("suppressed_emails").upsert({
                email: recipientEmail,
                reason: "invalid_recipient",
                source: "process-reminder-queue",
              });
              suppressedSet.add(recipientEmail);
            } catch (_) { /* noop */ }
          }

          const newAttempts = (item.attempts || 0) + 1;
          const status = isDomainConfigError || isInvalidRecipient
            ? "failed"
            : (newAttempts >= 3 ? "failed" : "pending");
          await supabase.from("scheduled_emails").update({
            attempts: newAttempts,
            status,
            error: `provider_${resp.status}: ${respBody.slice(0, 200)}`,
          }).eq("id", item.id);

          await supabase.from("email_send_log").insert({
            registration_id: reg.id,
            email_type: item.email_type,
            recipient_email: recipientEmail,
            status: "failed",
            provider_status: resp.status,
            error_message: respBody.slice(0, 500),
          });

          failed++;
          if (isDomainConfigError || isRateLimited) break; // aborta o ciclo
          await sleep(PER_ITEM_DELAY_MS);
          continue;
        }

        await supabase.from("scheduled_emails").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error: null,
        }).eq("id", item.id);
        await supabase.from("email_send_log").insert({
          registration_id: reg.id,
          email_type: item.email_type,
          recipient_email: recipientEmail,
          status: "sent",
          provider_status: resp.status,
        });
        sent++;
        await sleep(PER_ITEM_DELAY_MS);
      } catch (e) {
        console.error("[process-reminder-queue] item error", item.id, e);
        const newAttempts = (item.attempts || 0) + 1;
        const status = newAttempts >= 3 ? "failed" : "pending";
        await supabase.from("scheduled_emails").update({
          attempts: newAttempts, status,
          error: String((e as Error)?.message || e).slice(0, 200),
        }).eq("id", item.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: due.length, sent, failed, skipped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[process-reminder-queue] fatal", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
