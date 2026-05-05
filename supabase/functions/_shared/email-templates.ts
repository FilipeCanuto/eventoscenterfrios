// Shared email templates for registration confirmation and warming reminders.
// Pt-BR, fixed templates with dynamic variables.

// QR Codes are served from our own edge function (no external dependency).
const QR_BASE =
  (typeof Deno !== "undefined" && Deno.env.get("SUPABASE_URL"))
    ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/qr-code`
    : "https://ahwecyjzzczcwunptxae.supabase.co/functions/v1/qr-code";

function qrUrl(checkInUrl: string, size: number) {
  return `${QR_BASE}?size=${size}&data=${encodeURIComponent(checkInUrl)}`;
}

export interface EventLike {
  name: string;
  event_date: string | null;
  event_end_date: string | null;
  timezone: string | null;
  location_type: string | null;
  location_value: string | null;
  slug: string;
  primary_color: string | null;
  logo_url: string | null;
}

export interface EmailContext {
  registrationId: string;
  recipientName: string;
  event: EventLike;
  origin: string;
  unsubscribeToken?: string | null; // for reminders only
  // Momento de referência usado para cálculos relativos (ex.: "faltam 24h").
  // Deve ser o instante em que o e-mail será (ou foi) enviado. Default: now().
  referenceDate?: Date;
}

export function escapeHtml(s: string) {
  return (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

export function sanitizeSubject(s: string) {
  return (s || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function fmtDate(iso?: string | null, tz?: string | null) {
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
    const weekday = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone: tz || "America/Sao_Paulo",
    }).format(d);
    return { date, time, weekday };
  } catch { return null; }
}

function whenLine(ev: EventLike) {
  const start = fmtDate(ev.event_date, ev.timezone);
  const end = fmtDate(ev.event_end_date, ev.timezone);
  if (start && end && ev.event_date?.slice(0, 10) !== ev.event_end_date?.slice(0, 10)) {
    return `${start.date} a ${end.date}<br/><strong>${start.time} – ${end.time}</strong>`;
  }
  if (start && end) return `${start.date}<br/><strong>${start.time} – ${end.time}</strong>`;
  if (start) return `${start.date}<br/><strong>${start.time}</strong>`;
  return "Data a confirmar";
}

function whenLineText(ev: EventLike) {
  const start = fmtDate(ev.event_date, ev.timezone);
  const end = fmtDate(ev.event_end_date, ev.timezone);
  if (start && end && ev.event_date?.slice(0, 10) !== ev.event_end_date?.slice(0, 10)) {
    return `${start.date} a ${end.date} — ${start.time} às ${end.time}`;
  }
  if (start && end) return `${start.date} — ${start.time} às ${end.time}`;
  if (start) return `${start.date} — ${start.time}`;
  return "Data a confirmar";
}

function locationBlocks(ev: EventLike, brand: string) {
  const isOnline = (ev.location_type || "").toLowerCase() === "online";
  const label = isOnline ? "Link de acesso" : "Local";
  const html = ev.location_value
    ? isOnline
      ? `<a href="${escapeHtml(ev.location_value)}" style="color:${brand};text-decoration:none">${escapeHtml(ev.location_value)}</a>`
      : escapeHtml(ev.location_value)
    : "A definir";
  const text = ev.location_value ? `${label}: ${ev.location_value}` : `${label}: a definir`;
  return { label, html, text };
}

// Generate Google Calendar add-event link
export function googleCalendarUrl(ev: EventLike, eventUrl: string) {
  if (!ev.event_date) return null;
  const start = new Date(ev.event_date);
  const end = ev.event_end_date ? new Date(ev.event_end_date) : new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.name,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Mais informações: ${eventUrl}`,
  });
  if (ev.location_value) params.set("location", ev.location_value);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function unsubscribeFooter(origin: string, token?: string | null, brand?: string) {
  if (!token) return "";
  const url = `${origin}/unsubscribe-reminders/${token}`;
  return `<div style="margin-top:14px;font-size:11px;color:#9ca3af">
    <a href="${url}" style="color:#9ca3af;text-decoration:underline">Não quero mais receber lembretes deste evento</a>
  </div>`;
}

function unsubscribeFooterText(origin: string, token?: string | null) {
  if (!token) return "";
  return `\n\nPara não receber mais lembretes deste evento: ${origin}/unsubscribe-reminders/${token}`;
}

function shellHtml(opts: {
  brand: string;
  eventName: string;
  badge: string;
  body: string;
  origin: string;
  unsubscribeToken?: string | null;
  logoUrl?: string | null;
}) {
  const logo = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="" height="40" style="display:block;margin:0 auto 12px;max-height:40px"/>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(opts.eventName)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <tr><td style="background:${opts.brand};padding:28px 24px;text-align:center;color:#fff">
          ${logo}
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">${escapeHtml(opts.badge)}</div>
          <div style="font-size:22px;font-weight:700;margin-top:6px;line-height:1.25">${escapeHtml(opts.eventName)}</div>
        </td></tr>
        <tr><td style="padding:28px 28px 8px">${opts.body}</td></tr>
        <tr><td style="padding:24px 28px 28px;text-align:center;color:#9ca3af;font-size:12px">
          Você está recebendo este e-mail porque se inscreveu em <strong style="color:#6b7280">${escapeHtml(opts.eventName)}</strong>.<br/>
          <span style="opacity:.8">powered by CENTERFRIOS</span>
          ${unsubscribeFooter(opts.origin, opts.unsubscribeToken, opts.brand)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function qrBlock(qrSrc: string, checkInUrl: string, brand: string, size: number) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eef0f3;border-radius:14px;padding:20px;margin:0 0 8px">
    <tr><td style="text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;padding-bottom:10px">Seu ingresso digital</td></tr>
    <tr><td style="text-align:center;padding-bottom:10px">
      <a href="${checkInUrl}" style="display:inline-block;text-decoration:none">
        <img src="${qrSrc}" alt="QR Code de check-in" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border:0;margin:0 auto"/>
      </a>
    </td></tr>
    <tr><td style="text-align:center;font-size:13px;color:#6b7280;line-height:1.5">
      Apresente este QR Code na entrada do evento.<br/>
      <a href="${checkInUrl}" style="color:${brand};text-decoration:none;font-weight:600">Ou clique aqui para fazer check-in</a>
    </td></tr>
  </table>`;
}

function metaBlock(ev: EventLike, brand: string) {
  const loc = locationBlocks(ev, brand);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:14px;padding:18px 20px;margin:0 0 20px">
    <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;padding-bottom:6px">Quando</td></tr>
    <tr><td style="font-size:15px;color:#111;line-height:1.5;padding-bottom:14px">${whenLine(ev)}</td></tr>
    <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;padding-bottom:6px">${loc.label}</td></tr>
    <tr><td style="font-size:15px;color:#111;line-height:1.5">${loc.html}</td></tr>
  </table>`;
}

function ctaButtons(eventUrl: string, gcalUrl: string | null, brand: string) {
  const gcal = gcalUrl
    ? `<a href="${gcalUrl}" style="display:inline-block;background:#ffffff;color:#111;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:999px;font-size:14px;border:1px solid #e5e7eb;margin:6px">📅 Adicionar à agenda</a>`
    : "";
  return `<div style="text-align:center;margin:20px 0 8px">
    <a href="${eventUrl}" style="display:inline-block;background:${brand};color:#fff;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;font-size:15px;margin:6px">Ver página do evento</a>
    ${gcal}
  </div>`;
}

function hoursUntil(eventDate: string | null, reference?: Date) {
  if (!eventDate) return null;
  const refMs = reference ? reference.getTime() : Date.now();
  const diffMs = new Date(eventDate).getTime() - refMs;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}

// ===== CONFIRMATION (sent immediately) =====
export function buildConfirmation(ctx: EmailContext) {
  const ev = ctx.event;
  const brand = ev.primary_color || "#E11D74";
  const safeName = escapeHtml(ctx.recipientName?.trim() || "");
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  const eventUrl = `${ctx.origin}/register/${encodeURIComponent(ev.slug)}`;
  const checkInUrl = `${ctx.origin}/check-in/${ctx.registrationId}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=2&data=${encodeURIComponent(checkInUrl)}`;
  const gcal = googleCalendarUrl(ev, eventUrl);

  const body = `
    <p style="margin:0 0 12px;font-size:16px">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#444">
      Recebemos a sua inscrição. Guarde este e-mail — ele é a sua confirmação.
    </p>
    ${metaBlock(ev, brand)}
    ${qrBlock(qrSrc, checkInUrl, brand, 220)}
    ${ctaButtons(eventUrl, gcal, brand)}
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.55">
      Adicione o evento à sua agenda e fique de olho nesta caixa de entrada — enviaremos lembretes próximos da data.
    </p>`;

  const html = shellHtml({
    brand, eventName: ev.name, badge: "Inscrição confirmada",
    body, origin: ctx.origin, unsubscribeToken: null, logoUrl: ev.logo_url,
  });

  const loc = locationBlocks(ev, brand);
  const text = [
    greeting, "",
    `Sua inscrição em "${sanitizeSubject(ev.name)}" foi confirmada.`,
    "", `Quando: ${whenLineText(ev)}`, loc.text,
    "", `Seu ingresso digital (check-in): ${checkInUrl}`,
    `Página do evento: ${eventUrl}`,
    gcal ? `Adicionar à agenda: ${gcal}` : "",
    "", "Guarde este e-mail como comprovante. Enviaremos lembretes próximos da data.",
    "", "Equipe Eventos Centerfrios",
  ].filter(Boolean).join("\n");

  const subject = sanitizeSubject(`Inscrição confirmada — ${ev.name}`);
  return { html, text, subject };
}

// ===== REMINDER 7 days =====
export function buildReminder7d(ctx: EmailContext) {
  const ev = ctx.event;
  const brand = ev.primary_color || "#E11D74";
  const safeName = escapeHtml(ctx.recipientName?.trim() || "");
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  const eventUrl = `${ctx.origin}/register/${encodeURIComponent(ev.slug)}`;
  const checkInUrl = `${ctx.origin}/check-in/${ctx.registrationId}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(checkInUrl)}`;
  const gcal = googleCalendarUrl(ev, eventUrl);

  const body = `
    <p style="margin:0 0 12px;font-size:16px">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#444">
      Faltam <strong>7 dias</strong> para <strong>${escapeHtml(ev.name)}</strong>! É hora de começar a se preparar.
    </p>
    ${metaBlock(ev, brand)}
    <div style="background:#fffbeb;border-radius:14px;padding:18px 20px;margin:0 0 20px;font-size:14px;color:#78350f;line-height:1.6">
      <strong>Dica:</strong> adicione o evento à sua agenda agora para não esquecer e bloquear o horário.
    </div>
    ${qrBlock(qrSrc, checkInUrl, brand, 160)}
    ${ctaButtons(eventUrl, gcal, brand)}`;

  const html = shellHtml({
    brand, eventName: ev.name, badge: "Faltam 7 dias",
    body, origin: ctx.origin, unsubscribeToken: ctx.unsubscribeToken, logoUrl: ev.logo_url,
  });

  const loc = locationBlocks(ev, brand);
  const text = [
    greeting, "",
    `Faltam 7 dias para "${sanitizeSubject(ev.name)}".`,
    "", `Quando: ${whenLineText(ev)}`, loc.text,
    "", `Seu ingresso digital (check-in): ${checkInUrl}`,
    `Página do evento: ${eventUrl}`,
    gcal ? `Adicionar à agenda: ${gcal}` : "",
    "", "Equipe Eventos Centerfrios",
    unsubscribeFooterText(ctx.origin, ctx.unsubscribeToken),
  ].filter(Boolean).join("\n");

  const subject = sanitizeSubject(`Faltam 7 dias para ${ev.name} — prepare-se`);
  return { html, text, subject };
}

// ===== REMINDER 1 day =====
export function buildReminder1d(ctx: EmailContext) {
  const ev = ctx.event;
  const brand = ev.primary_color || "#E11D74";
  const safeName = escapeHtml(ctx.recipientName?.trim() || "");
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  const eventUrl = `${ctx.origin}/register/${encodeURIComponent(ev.slug)}`;
  const checkInUrl = `${ctx.origin}/check-in/${ctx.registrationId}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=${encodeURIComponent(checkInUrl)}`;
  const gcal = googleCalendarUrl(ev, eventUrl);
  const hours = hoursUntil(ev.event_date, ctx.referenceDate);

  const countdown = hours !== null ? `
    <div style="background:${brand};color:#fff;border-radius:14px;padding:22px;margin:0 0 20px;text-align:center">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">Faltam</div>
      <div style="font-size:42px;font-weight:800;line-height:1;margin:6px 0">${hours}h</div>
      <div style="font-size:13px;opacity:.9">para o evento começar</div>
    </div>` : "";

  const body = `
    <p style="margin:0 0 12px;font-size:16px">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#444">
      <strong>Amanhã é o dia!</strong> Tudo pronto para <strong>${escapeHtml(ev.name)}</strong>?
    </p>
    ${countdown}
    ${metaBlock(ev, brand)}
    ${qrBlock(qrSrc, checkInUrl, brand, 220)}
    ${ctaButtons(eventUrl, gcal, brand)}`;

  const html = shellHtml({
    brand, eventName: ev.name, badge: "Amanhã é o dia",
    body, origin: ctx.origin, unsubscribeToken: ctx.unsubscribeToken, logoUrl: ev.logo_url,
  });

  const loc = locationBlocks(ev, brand);
  const text = [
    greeting, "",
    `Amanhã é o dia! "${sanitizeSubject(ev.name)}" está chegando.`,
    hours !== null ? `Faltam aproximadamente ${hours} horas.` : "",
    "", `Quando: ${whenLineText(ev)}`, loc.text,
    "", `Seu ingresso digital (check-in): ${checkInUrl}`,
    `Página do evento: ${eventUrl}`,
    "", "Equipe Eventos Centerfrios",
    unsubscribeFooterText(ctx.origin, ctx.unsubscribeToken),
  ].filter(Boolean).join("\n");

  const subject = sanitizeSubject(`Amanhã é o dia! Tudo pronto para ${ev.name}?`);
  return { html, text, subject };
}

// ===== REMINDER 2 hours =====
export function buildReminder2h(ctx: EmailContext) {
  const ev = ctx.event;
  const brand = ev.primary_color || "#E11D74";
  const safeName = escapeHtml(ctx.recipientName?.trim() || "");
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  const eventUrl = `${ctx.origin}/register/${encodeURIComponent(ev.slug)}`;
  const checkInUrl = `${ctx.origin}/check-in/${ctx.registrationId}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=2&data=${encodeURIComponent(checkInUrl)}`;
  const loc = locationBlocks(ev, brand);

  const body = `
    <p style="margin:0 0 12px;font-size:16px">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#444">
      <strong>Começa em ~2 horas!</strong> Seu QR Code está pronto — basta apresentar este e-mail na entrada.
    </p>
    ${qrBlock(qrSrc, checkInUrl, brand, 300)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:14px;padding:18px 20px;margin:14px 0 8px">
      <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;padding-bottom:6px">${loc.label}</td></tr>
      <tr><td style="font-size:15px;color:#111;line-height:1.5">${loc.html}</td></tr>
    </table>
    <p style="margin:18px 0 0;font-size:13px;color:#6b7280;line-height:1.55">
      Chegue com alguns minutos de antecedência para fazer o check-in com tranquilidade.
    </p>`;

  const html = shellHtml({
    brand, eventName: ev.name, badge: "Começa em 2 horas",
    body, origin: ctx.origin, unsubscribeToken: ctx.unsubscribeToken, logoUrl: ev.logo_url,
  });

  const text = [
    greeting, "",
    `Começa em ~2 horas: "${sanitizeSubject(ev.name)}".`,
    "", loc.text,
    "", `Seu ingresso digital (check-in): ${checkInUrl}`,
    `Página do evento: ${eventUrl}`,
    "", "Chegue com alguns minutos de antecedência para fazer o check-in com tranquilidade.",
    "", "Equipe Eventos Centerfrios",
    unsubscribeFooterText(ctx.origin, ctx.unsubscribeToken),
  ].filter(Boolean).join("\n");

  const subject = sanitizeSubject(`Começa em 2h — seu QR Code está pronto para o check-in`);
  return { html, text, subject };
}

export function buildEmail(type: "reminder_7d" | "reminder_1d" | "reminder_2h" | "confirmation", ctx: EmailContext) {
  switch (type) {
    case "confirmation": return buildConfirmation(ctx);
    case "reminder_7d": return buildReminder7d(ctx);
    case "reminder_1d": return buildReminder1d(ctx);
    case "reminder_2h": return buildReminder2h(ctx);
  }
}
