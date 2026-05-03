// Resend Webhook Receiver
// Endpoint público (verify_jwt = false) que recebe eventos do Resend
// (delivered, bounced, complained, delivery_delayed, opened) e atualiza
// public.email_send_log com o status real de entrega, além de alimentar
// public.suppressed_emails em caso de hard bounce ou reclamação.
//
// Autenticação: Resend usa Svix para assinar webhooks. Validamos os headers
// `svix-id`, `svix-timestamp`, `svix-signature` com o segredo
// RESEND_WEBHOOK_SECRET configurado no painel do Resend.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string; subType?: string; message?: string } | string;
    [k: string]: unknown;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!SECRET) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[resend-webhook] missing svix headers");
    return new Response(JSON.stringify({ error: "Missing signature headers" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event: ResendEvent;
  try {
    const wh = new Webhook(SECRET);
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendEvent;
  } catch (e) {
    console.warn("[resend-webhook] invalid signature", e);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const emailId = event.data?.email_id;
  const eventType = event.type;
  const eventTs = event.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString();
  const recipients = Array.isArray(event.data?.to)
    ? event.data?.to
    : event.data?.to ? [event.data.to as string] : [];
  const recipientEmail = recipients[0]?.toLowerCase() ?? null;

  console.log("[resend-webhook] event", { eventType, emailId, recipientEmail });

  if (!emailId) {
    return new Response(JSON.stringify({ ok: true, ignored: "missing email_id" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const update: Record<string, unknown> = {};
  let suppression: { reason: string } | null = null;

  switch (eventType) {
    case "email.delivered":
      update.delivered_at = eventTs;
      break;
    case "email.bounced": {
      const bounceObj = typeof event.data?.bounce === "object" ? event.data.bounce : null;
      const bounceType = bounceObj?.type ?? (typeof event.data?.bounce === "string" ? event.data.bounce : "unknown");
      update.bounced_at = eventTs;
      update.bounce_type = String(bounceType).slice(0, 50);
      update.status = "failed";
      update.error_message = `bounced:${bounceType}`;
      // Hard bounce → adiciona à supressão
      if (String(bounceType).toLowerCase().includes("hard") ||
          String(bounceType).toLowerCase() === "permanent") {
        suppression = { reason: `hard_bounce:${bounceType}` };
      }
      break;
    }
    case "email.complained":
      update.complained_at = eventTs;
      update.status = "failed";
      update.error_message = "complained";
      suppression = { reason: "complaint" };
      break;
    case "email.opened":
      update.opened_at = eventTs;
      break;
    case "email.delivery_delayed":
      // não muda status, só registra a tentativa no log de erro
      update.error_message = "delivery_delayed";
      break;
    default:
      console.log("[resend-webhook] event ignored", eventType);
      return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }

  // 1) Atualiza a linha do log que tem este provider_message_id
  const { data: updated, error: updErr } = await supabase
    .from("email_send_log")
    .update(update)
    .eq("provider_message_id", emailId)
    .select("id, recipient_email");

  if (updErr) {
    console.error("[resend-webhook] update error", updErr);
  } else {
    console.log("[resend-webhook] rows updated", updated?.length ?? 0);
  }

  // 2) Se não encontrou pelo provider_message_id (envio antigo, sem ID),
  //    tenta correlacionar pelo recipient_email mais recente como fallback.
  if ((!updated || updated.length === 0) && recipientEmail) {
    const { data: fallback } = await supabase
      .from("email_send_log")
      .select("id")
      .eq("recipient_email", recipientEmail)
      .eq("status", "sent")
      .is("provider_message_id", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (fallback && fallback.length > 0) {
      await supabase.from("email_send_log")
        .update({ ...update, provider_message_id: emailId })
        .eq("id", fallback[0].id);
      console.log("[resend-webhook] fallback updated by recipient", recipientEmail);
    }
  }

  // 3) Supressão para bounces/complaints
  if (suppression && recipientEmail) {
    try {
      await supabase.from("suppressed_emails").upsert({
        email: recipientEmail,
        reason: suppression.reason,
        source: "resend-webhook",
      });
    } catch (e) {
      console.warn("[resend-webhook] suppression upsert failed", e);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
