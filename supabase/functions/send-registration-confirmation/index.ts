import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "Eventos Centerfrios <eventos@eventos.centerfrios.com>";

interface Payload {
  registrationId: string;
  origin?: string | null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function fmtDate(iso?: string | null, tz?: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
      timeZone: tz || "America/Sao_Paulo",
    }).format(d);
    const time = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit", minute: "2-digit",
      timeZone: tz || "America/Sao_Paulo",
    }).format(d);
    return { date, time };
  } catch { return null; }
}

const REPLY_TO_ADDRESS = "contato@eventos.centerfrios.com";
const UNSUBSCRIBE_MAILTO = "contato@eventos.centerfrios.com";

interface EmailContext {
  recipientEmail: string;
  recipientName: string;
  eventName: string;
  eventDate: string | null;
  eventEndDate: string | null;
  timezone: string | null;
  locationType: string | null;
  locationValue: string | null;
  eventSlug: string;
  primaryColor: string | null;
  logoUrl: string | null;
  flyerUrl: string | null;
}

function buildPlainText(p: EmailContext, origin: string) {
  const start = fmtDate(p.eventDate, p.timezone);
  const end = fmtDate(p.eventEndDate, p.timezone);
  let when = "Data a confirmar";
  if (start && end && p.eventDate?.slice(0, 10) !== p.eventEndDate?.slice(0, 10)) {
    when = `${start.date} a ${end.date} — ${start.time} às ${end.time}`;
  } else if (start && end) {
    when = `${start.date} — ${start.time} às ${end.time}`;
  } else if (start) {
    when = `${start.date} — ${start.time}`;
  }
  const isOnline = (p.locationType || "").toLowerCase() === "online";
  const where = p.locationValue
    ? `${isOnline ? "Link de acesso" : "Local"}: ${p.locationValue}`
    : "Local: a definir";
  const greet = p.recipientName?.trim() ? `Olá, ${p.recipientName.trim()}!` : "Olá!";
  const url = `${origin}/register/${encodeURIComponent(p.eventSlug)}`;
  const checkInUrl = `${origin}/check-in/${p.registrationId}`;
  const cleanName = sanitizeSubject(p.eventName);
  return [
    greet,
    "",
    `Sua inscrição em "${cleanName}" foi confirmada.`,
    "",
    `Quando: ${when}`,
    where,
    "",
    `Seu ingresso digital (check-in): ${checkInUrl}`,
    `Página do evento: ${url}`,
    "",
    "Guarde este e-mail como comprovante. Enviaremos lembretes próximos da data.",
    "",
    "Equipe Eventos Centerfrios",
    `Para parar de receber estes avisos, responda este e-mail com "sair".`,
  ].join("\n");
}

function sanitizeSubject(s: string) {
  return (s || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function buildHtml(p: EmailContext, origin: string) {
  const brand = p.primaryColor || "#E11D74";
  const safeName = escapeHtml(p.recipientName?.trim() || "");
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  const start = fmtDate(p.eventDate, p.timezone);
  const end = fmtDate(p.eventEndDate, p.timezone);

  let dateLine = "";
  if (start && end && p.eventDate?.slice(0, 10) !== p.eventEndDate?.slice(0, 10)) {
    dateLine = `${start.date} a ${end.date}<br/><strong>${start.time} – ${end.time}</strong>`;
  } else if (start && end) {
    dateLine = `${start.date}<br/><strong>${start.time} – ${end.time}</strong>`;
  } else if (start) {
    dateLine = `${start.date}<br/><strong>${start.time}</strong>`;
  } else {
    dateLine = "Data a confirmar";
  }

  const isOnline = (p.locationType || "").toLowerCase() === "online";
  const locationBlock = p.locationValue
    ? isOnline
      ? `<a href="${escapeHtml(p.locationValue)}" style="color:${brand};text-decoration:none">${escapeHtml(p.locationValue)}</a>`
      : escapeHtml(p.locationValue)
    : "A definir";
  const locationLabel = isOnline ? "Link de acesso" : "Local";

  const eventUrl = `${origin}/register/${encodeURIComponent(p.eventSlug)}`;
  const logoBlock = p.logoUrl
    ? `<img src="${escapeHtml(p.logoUrl)}" alt="" height="40" style="display:block;margin:0 auto 12px;max-height:40px"/>`
    : "";

  // Hero com a flyer do evento (se existir) — full width, sem cortar
  const heroBlock = p.flyerUrl
    ? `<tr><td style="background:#0f0f10;padding:0;text-align:center;line-height:0">
          <img src="${escapeHtml(p.flyerUrl)}" alt="${escapeHtml(p.eventName)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto"/>
        </td></tr>
        <tr><td style="background:${brand};padding:14px 24px;text-align:center;color:#fff">
          ${logoBlock ? `<div style="margin-bottom:8px">${logoBlock}</div>` : ""}
          <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.95;font-weight:600">Inscrição confirmada</div>
          <div style="font-size:20px;font-weight:700;margin-top:4px;line-height:1.25">${escapeHtml(p.eventName)}</div>
        </td></tr>`
    : `<tr><td style="background:${brand};padding:28px 24px;text-align:center;color:#fff">
          ${logoBlock}
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">Inscrição confirmada</div>
          <div style="font-size:22px;font-weight:700;margin-top:6px;line-height:1.25">${escapeHtml(p.eventName)}</div>
        </td></tr>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Inscrição confirmada</title></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Tudo certo! Guarde este e-mail como comprovante da sua inscrição.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        ${heroBlock}
        <tr><td style="padding:28px 28px 8px">
          <p style="margin:0 0 12px;font-size:16px">${greeting}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#444">
            Recebemos a sua inscrição. Guarde este e-mail — ele é a sua confirmação.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:14px;padding:18px 20px;margin:0 0 20px">
            <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;padding-bottom:6px">Quando</td></tr>
            <tr><td style="font-size:15px;color:#111;line-height:1.5;padding-bottom:14px">${dateLine}</td></tr>
            <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;padding-bottom:6px">${locationLabel}</td></tr>
            <tr><td style="font-size:15px;color:#111;line-height:1.5">${locationBlock}</td></tr>
          </table>
          <div style="text-align:center;margin:24px 0 8px">
            <a href="${eventUrl}" style="display:inline-block;background:${brand};color:#fff;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;font-size:15px">Ver página do evento</a>
          </div>
          <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.55">
            Adicione o evento à sua agenda e fique de olho nesta caixa de entrada — enviaremos lembretes próximos da data.
          </p>
        </td></tr>
        <tr><td style="padding:24px 28px 28px;text-align:center;color:#9ca3af;font-size:12px">
          Você está recebendo este e-mail porque se inscreveu em <strong style="color:#6b7280">${escapeHtml(p.eventName)}</strong>.<br/>
          <span style="opacity:.8">powered by meuevento</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.registrationId || typeof body.registrationId !== "string") {
      return new Response(JSON.stringify({ error: "Missing registrationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authoritative lookup: trust ONLY DB-stored values, ignore caller payload.
    // This blocks the "open relay" attack where an attacker supplies an arbitrary
    // recipientEmail with someone else's registrationId.
    const { data: reg, error: regErr } = await supabase
      .from("registrations")
      .select(`
        id, status, lead_email, lead_name, tracking,
        events ( id, name, event_date, event_end_date, timezone,
                 location_type, location_value, slug, primary_color, logo_url, background_image_url )
      `)
      .eq("id", body.registrationId)
      .maybeSingle();

    if (regErr || !reg) {
      console.warn("[send-registration-confirmation] Registration not found", body.registrationId);
      return new Response(JSON.stringify({ error: "Registration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reg.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Registration cancelled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmail = (reg.lead_email || "").trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "No valid email on registration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ev = (reg as any).events;
    if (!ev) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persistent idempotency: prevents replay-based abuse (sending the same
    // confirmation repeatedly by re-invoking the function).
    const tracking = (reg.tracking as Record<string, unknown>) || {};
    if (tracking.confirmation_email_sent_at) {
      console.log("[send-registration-confirmation] Already sent, skipping", body.registrationId);
      return new Response(JSON.stringify({ ok: true, alreadySent: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx: EmailContext = {
      recipientEmail,
      recipientName: reg.lead_name || "",
      eventName: ev.name,
      eventDate: ev.event_date,
      eventEndDate: ev.event_end_date,
      timezone: ev.timezone,
      locationType: ev.location_type,
      locationValue: ev.location_value,
      eventSlug: ev.slug,
      primaryColor: ev.primary_color,
      logoUrl: ev.logo_url,
      flyerUrl: ev.background_image_url,
    };

    const origin =
      body.origin?.replace(/\/$/, "") ||
      req.headers.get("origin")?.replace(/\/$/, "") ||
      "https://eventoscenterfrios.lovable.app";

    const html = buildHtml(ctx, origin);
    const text = buildPlainText(ctx, origin);
    const subject = `Inscrição confirmada — ${ctx.eventName}`;

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
        subject,
        html,
        text,
        headers: {
          "List-Unsubscribe": `<mailto:${UNSUBSCRIBE_MAILTO}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "type", value: "registration_confirmation" },
          { name: "event_slug", value: (ctx.eventSlug || "unknown").slice(0, 50) },
        ],
      }),
    });

    const respBody = await resp.text();
    if (!resp.ok) {
      console.error("[send-registration-confirmation] Resend error", resp.status, respBody);
      if (resp.status === 401 || resp.status === 403) {
        return new Response(JSON.stringify({ error: "Email auth failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ ok: false, providerStatus: resp.status, providerBody: respBody }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark sent for idempotency
    await supabase
      .from("registrations")
      .update({
        tracking: { ...tracking, confirmation_email_sent_at: new Date().toISOString() },
      })
      .eq("id", body.registrationId);

    console.log("[send-registration-confirmation] Sent", recipientEmail);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-registration-confirmation] Unhandled", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
