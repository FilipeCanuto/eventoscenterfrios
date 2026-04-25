import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEmail } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "Eventos Centerfrios <eventos@eventos.centerfrios.com>";
const REPLY_TO_ADDRESS = "contato@eventos.centerfrios.com";
const PUBLIC_ORIGIN = "https://eventos.centerfrios.com";
const BATCH_SIZE = 25;

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

    // ---- Catch-up: re-trigger missing confirmation emails ----
    // Idempotent safety net for cases where the client never reached
    // send-registration-confirmation (network drop, function cold-start 503,
    // browser closed before the fire-and-forget fetch completed, etc.).
    // The target function self-skips when tracking.confirmation_email_sent_at
    // is already set, so re-invoking is safe.
    let confirmationCatchUp = 0;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: missing } = await supabase
        .from("registrations")
        .select("id, tracking")
        .gte("created_at", since)
        .neq("status", "cancelled")
        .not("lead_email", "is", null)
        .limit(50);
      const pending = (missing || []).filter((r: any) => {
        const t = r.tracking || {};
        return !t.confirmation_email_sent_at;
      });
      for (const r of pending) {
        try {
          await supabase.functions.invoke("send-registration-confirmation", {
            body: { registrationId: r.id },
          });
          confirmationCatchUp++;
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

    // Pull batch of due pending emails
    const { data: due, error: dueErr } = await supabase
      .from("scheduled_emails")
      .select("id, registration_id, event_id, email_type, unsubscribe_token, attempts")
      .eq("status", "pending")
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
            to: [reg.lead_email],
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
          const newAttempts = (item.attempts || 0) + 1;
          const status = newAttempts >= 3 ? "failed" : "pending";
          await supabase.from("scheduled_emails").update({
            attempts: newAttempts,
            status,
            error: `provider_${resp.status}: ${respBody.slice(0, 200)}`,
          }).eq("id", item.id);
          failed++;
          continue;
        }

        await supabase.from("scheduled_emails").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error: null,
        }).eq("id", item.id);
        sent++;
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
