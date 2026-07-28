// Envia um e-mail de teste do template (rascunho ou salvo) para o e-mail
// do usuário logado. Só o dono do evento (ou admin) pode disparar.
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

type TemplateType = "confirmation" | "reminder_1d" | "reminder_2h";
const VALID: TemplateType[] = ["confirmation", "reminder_1d", "reminder_2h"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Rate-limit simples em memória: 1 envio a cada 30s por usuário.
const lastSend = new Map<string, number>();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) return json({ error: "email_not_configured" }, 502);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    const user = u?.user;
    if (!user?.id || !user.email) return json({ error: "unauthorized" }, 401);

    const now = Date.now();
    const prev = lastSend.get(user.id) || 0;
    if (now - prev < 30_000) {
      return json({ error: "rate_limited", retryInSeconds: Math.ceil((30_000 - (now - prev)) / 1000) }, 429);
    }

    const body = (await req.json()) as {
      eventId?: string;
      templateType?: TemplateType;
      subject?: string;
      bodyHtml?: string;
    };

    if (!body?.eventId || !body.templateType || !VALID.includes(body.templateType)) {
      return json({ error: "invalid_payload" }, 400);
    }
    if ((body.bodyHtml || "").length > 50_000 || (body.subject || "").length > 300) {
      return json({ error: "payload_too_large" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: ev } = await supabase
      .from("events")
      .select("id, name, event_date, event_end_date, timezone, location_type, location_value, slug, primary_color, logo_url, background_image_url, user_id")
      .eq("id", body.eventId)
      .maybeSingle();
    if (!ev) return json({ error: "not_found" }, 404);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (ev.user_id !== user.id && !isAdmin) return json({ error: "forbidden" }, 403);

    const built = buildEmail(body.templateType, {
      registrationId: "00000000-0000-0000-0000-000000000000",
      recipientName: (user.email || "").split("@")[0],
      event: ev as any,
      origin: PUBLIC_ORIGIN,
      unsubscribeToken: body.templateType === "confirmation" ? null : "00000000-0000-0000-0000-000000000000",
      vendedor: "Equipe",
      customTemplate: { subject: body.subject ?? null, body: body.bodyHtml ?? null },
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
        to: [user.email],
        reply_to: REPLY_TO_ADDRESS,
        subject: `[TESTE] ${built.subject}`,
        html: built.html,
        text: built.text,
      }),
    });

    const respBody = await resp.text();
    if (!resp.ok) {
      console.error("[send-test-email] provider error", resp.status, respBody);
      return json({ error: "provider_error", status: resp.status, details: respBody.slice(0, 500) }, resp.status);
    }

    lastSend.set(user.id, now);
    return json({ ok: true, sentTo: user.email });
  } catch (e) {
    console.error("[send-test-email] unhandled", e);
    return json({ error: "internal_error" }, 500);
  }
});
