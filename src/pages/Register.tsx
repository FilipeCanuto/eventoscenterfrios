import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, MapPin, Video, Globe, Loader2, Zap, Mail, QrCode, Clock, MessageCircle, Copy, Check, CheckCircle2 } from "lucide-react";
import { useEventBySlug, Event } from "@/hooks/useEvents";
import { useFormFields } from "@/hooks/useFormFields";
import { useCreateRegistration } from "@/hooks/useRegistrations";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";
import { trackPageView, buildInitialPayload } from "@/lib/visitorTracking";

type FormField = Tables<"form_fields">;

// ─── Helper: format event date/time with timezone ───
type EventDateTimeParts = {
  dateRange: string;
  durationLabel?: string;
  timeRange?: string;
  tzLabel?: string;
};

function formatTimeBR(date: Date, tz: string) {
  const t = date.toLocaleTimeString("pt-BR", { hour: "numeric", minute: "2-digit", timeZone: tz, hour12: false });
  // "14:00" -> "14h", "14:30" -> "14h30"
  const [h, m] = t.split(":");
  return m === "00" ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h${m}`;
}

function getPartsInTz(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    weekday: get("weekday").replace(".", ""),
  };
}

function formatEventDateTimeParts(event: Event): EventDateTimeParts | null {
  const tz = event.timezone || "America/Sao_Paulo";
  if (!event.event_date) return null;

  const start = new Date(event.event_date);
  const sp = getPartsInTz(start, tz);

  const tzAbbr = start.toLocaleTimeString("pt-BR", { timeZone: tz, timeZoneName: "short" }).split(" ").pop() || "";
  const tzLabel = tz === "America/Sao_Paulo" ? "horário de Brasília" : tzAbbr;

  const startTime = formatTimeBR(start, tz);

  if (!event.event_end_date) {
    return {
      dateRange: `${sp.day} de ${sp.month} de ${sp.year}`,
      timeRange: `Às ${startTime}`,
      tzLabel,
    };
  }

  const end = new Date(event.event_end_date);
  const ep = getPartsInTz(end, tz);
  const endTime = formatTimeBR(end, tz);

  // Build a compact date range
  let dateRange: string;
  if (sp.year === ep.year && sp.month === ep.month && sp.day === ep.day) {
    dateRange = `${sp.day} de ${sp.month} de ${sp.year}`;
  } else if (sp.year === ep.year && sp.month === ep.month) {
    dateRange = `${sp.day} – ${ep.day} de ${sp.month} de ${sp.year}`;
  } else if (sp.year === ep.year) {
    dateRange = `${sp.day} de ${sp.month} – ${ep.day} de ${ep.month} de ${sp.year}`;
  } else {
    dateRange = `${sp.day} de ${sp.month} de ${sp.year} – ${ep.day} de ${ep.month} de ${ep.year}`;
  }

  // Duration in days (inclusive), based on calendar days in tz
  const startDayKey = `${sp.year}-${sp.month}-${sp.day}`;
  const endDayKey = `${ep.year}-${ep.month}-${ep.day}`;
  let durationLabel: string | undefined;
  if (startDayKey !== endDayKey) {
    const msPerDay = 24 * 60 * 60 * 1000;
    // Use UTC midnights for a stable diff
    const startMid = new Date(start.toLocaleDateString("en-CA", { timeZone: tz }));
    const endMid = new Date(end.toLocaleDateString("en-CA", { timeZone: tz }));
    const days = Math.round((endMid.getTime() - startMid.getTime()) / msPerDay) + 1;
    durationLabel = `${days} dias · ${sp.weekday} a ${ep.weekday}`;
  }

  // Time range — if both extremes share the same daily window, show single range
  const timeRange = startTime === endTime ? `Às ${startTime}` : `Das ${startTime} às ${endTime}`;

  return { dateRange, durationLabel, timeRange, tzLabel };
}

function formatEventDateTime(event: Event): string {
  const dt = formatEventDateTimeParts(event);
  if (!dt) return "";
  const parts = [dt.dateRange];
  if (dt.timeRange) parts.push(dt.timeRange);
  if (dt.tzLabel) parts.push(dt.tzLabel);
  return parts.join(" · ");
}

// ─── Extracted stable components ───

// ─── WhatsApp helpers ───
function isWhatsAppField(label: string) {
  const l = label.toLowerCase();
  return l.includes("whatsapp") || l.includes("celular") || l.includes("telefone");
}
function maskBRPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
function isValidBRPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

const SuccessCard = ({
  brandColor,
  event,
  name,
  shareUrl,
}: {
  brandColor: string;
  event: Event;
  name: string;
  shareUrl: string;
}) => {
  const firstName = (name || "").trim().split(/\s+/)[0] || "";
  const [copied, setCopied] = useState(false);
  const dt = formatEventDateTimeParts(event);
  const logoUrl = event.logo_url;
  const locationLabel = event.location_type === "physical" ? "Presencial" : event.location_type === "hybrid" ? "Híbrido" : "Online";

  useEffect(() => {
    const colors = [brandColor, "#FFD166", "#06D6A0", "#118AB2", "#EF476F"];
    const fire = (delay: number, opts: confetti.Options) => {
      setTimeout(() => confetti({ colors, ...opts }), delay);
    };
    fire(0, { particleCount: 120, spread: 80, origin: { y: 0.6 } });
    fire(250, { particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
    fire(500, { particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
  }, [brandColor]);

  const shareText = `Acabei de garantir minha vaga em ${event.name}! Garanta a sua também:`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 110, damping: 18 }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Logo do evento acima do card */}
      {logoUrl && (
        <div className="flex justify-center mb-8">
          <img src={logoUrl} alt={event.name} className="h-12 md:h-14 w-auto object-contain" />
        </div>
      )}

      {/* Bloco 1 — Selo + título ENORME */}
      <div className="text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 180, damping: 14 }}
          className="mx-auto flex items-center justify-center rounded-full shadow-xl"
          style={{
            width: 96,
            height: 96,
            background: brandColor,
            boxShadow: `0 20px 60px -15px ${brandColor}80`,
          }}
        >
          <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ background: `${brandColor}1A`, color: brandColor }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: brandColor }} />
            Confirmação
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold tracking-[-0.03em] leading-[1.05] text-foreground">
            Inscrição confirmada
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto">
            {firstName ? `${firstName}, você` : "Você"} está garantido(a) em{" "}
            <strong className="text-foreground font-semibold">{event.name}</strong>.
          </p>
        </motion.div>
      </div>

      {/* Bloco 2 — Mensagem principal em destaque */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-10 rounded-3xl px-6 py-7 sm:px-8 sm:py-8 text-center"
        style={{
          background: `${brandColor}0F`,
          borderTop: `3px solid ${brandColor}`,
        }}
      >
        <div className="flex items-center justify-center gap-2 text-foreground">
          <Mail className="w-5 h-5" style={{ color: brandColor }} />
          <p className="text-base sm:text-lg font-medium">
            Enviamos os detalhes da sua inscrição para o seu e-mail.
          </p>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Salve a data e prepare-se. Apresente o QR Code recebido por e-mail no dia do evento.
        </p>
      </motion.div>

      {/* Bloco 3 — Detalhes do evento (secundário) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6 grid sm:grid-cols-2 gap-3"
      >
        {dt && (
          <div className="rounded-2xl bg-muted/40 px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Quando</div>
            <div className="mt-1.5 text-sm font-display font-semibold text-foreground leading-snug">
              {dt.dateRange}
            </div>
            {dt.timeRange && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {dt.timeRange}{dt.tzLabel ? ` · ${dt.tzLabel}` : ""}
              </div>
            )}
          </div>
        )}
        <div className="rounded-2xl bg-muted/40 px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Onde</div>
          <div className="mt-1.5 text-sm font-display font-semibold text-foreground leading-snug">
            {locationLabel}
          </div>
          {event.location_value && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{event.location_value}</div>
          )}
        </div>
      </motion.div>

      {/* Bloco 4 — CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="mt-8 space-y-3"
      >
        <p className="text-xs text-center text-muted-foreground uppercase tracking-[0.12em] font-semibold">
          Convide alguém para vir com você
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" className="flex-1 rounded-full h-12">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" /> Compartilhar no WhatsApp
            </a>
          </Button>
          <Button onClick={handleCopy} variant="outline" className="flex-1 rounded-full h-12">
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copiado" : "Copiar link"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const EventInfo = ({ event, className = "" }: { event: Event; className?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const locationIcon = event.location_type === "physical" ? <MapPin className="w-4 h-4" /> : event.location_type === "hybrid" ? <Globe className="w-4 h-4" /> : <Video className="w-4 h-4" />;
  const locationLabel = event.location_type === "physical" ? "Presencial" : event.location_type === "hybrid" ? "Híbrido" : "Virtual";
  const dt = formatEventDateTimeParts(event);

  // Truncate to first 2 sentences
  const description = event.description || "";
  const sentences = description.match(/[^.!?]*[.!?]+/g) || [description];
  const isTruncatable = sentences.length > 1;
  const truncated = isTruncatable ? sentences.slice(0, 1).join("").trim() + "…" : description;

  return (
    <div className={`pt-6 md:pt-0 ${className}`}>
      {dt && (
        <div className="mb-4 space-y-1.5">
          <div className="flex items-start gap-2.5">
            <CalendarDays className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
            <div className="leading-tight">
              <div className="font-display font-semibold text-base md:text-lg text-foreground">
                {dt.dateRange}
              </div>
              {dt.durationLabel && (
                <div className="text-xs text-muted-foreground mt-0.5">{dt.durationLabel}</div>
              )}
            </div>
          </div>
          {dt.timeRange && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                <span className="text-foreground font-medium">{dt.timeRange}</span>
                {dt.tzLabel && <span className="text-muted-foreground"> · {dt.tzLabel}</span>}
              </span>
            </div>
          )}
        </div>
      )}
      <h1 className="text-2xl sm:text-4xl font-display font-extrabold whitespace-pre-line md:text-6xl">{event.name}</h1>
      {description && (
        <div className="mt-4 mb-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {expanded || !isTruncatable ? description : truncated}
          </p>
          {isTruncatable && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-sm font-medium mt-1 hover:underline"
              style={{ color: "hsl(var(--primary))" }}
            >
              {expanded ? "Ver menos" : "Ler mais"}
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {locationIcon} {locationLabel}
      </div>
    </div>
  );
};

const RegistrationForm = ({
  formFields,
  formData,
  onFieldChange,
  onFieldBlur,
  consent,
  onConsentChange,
  onSubmit,
  isPending,
  brandColor,
  urgencyText,
  className = "",
}: {
  formFields: FormField[] | undefined;
  formData: Record<string, string>;
  onFieldChange: (label: string, value: string) => void;
  onFieldBlur?: (label: string, value: string) => void;
  consent: boolean;
  onConsentChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  brandColor: string;
  urgencyText?: string;
  className?: string;
}) => (
  <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
    {urgencyText && (
      <div
      className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium border-secondary-foreground bg-blue-200"
      style={{ color: brandColor }}
      >
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{urgencyText}</span>
      </div>
    )}
    {formFields?.map((field) => {
      const isPhone = isWhatsAppField(field.label);
      const value = formData[field.label] || "";
      const phoneInvalid = isPhone && field.required && value.length > 0 && !isValidBRPhone(value);
      const isSelect = field.field_type === "select";
      const options = Array.isArray((field as any).options) ? ((field as any).options as string[]) : [];
      return (
        <div key={field.id} className="space-y-2">
          <Label>{field.label}{field.required && " *"}</Label>
          {isSelect ? (
            <Select
              value={value}
              onValueChange={(v) => onFieldChange(field.label, v)}
            >
              <SelectTrigger className="h-12 text-base rounded-md" style={{ fontSize: "16px" }}>
                <SelectValue placeholder={field.placeholder || `Selecione ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                type={field.field_type === "email" ? "email" : isPhone ? "tel" : field.field_type === "tel" ? "tel" : "text"}
                inputMode={isPhone ? "tel" : undefined}
                placeholder={isPhone ? "(11) 99999-9999" : field.placeholder || field.label}
                required={field.required}
                value={value}
                onChange={e => onFieldChange(field.label, isPhone ? maskBRPhone(e.target.value) : e.target.value)}
                onBlur={e => onFieldBlur?.(field.label, e.target.value)}
                aria-invalid={phoneInvalid || undefined}
                className="h-12 text-base"
                style={{ fontSize: "16px" }}
              />
              {phoneInvalid && (
                <p className="text-xs text-destructive">Informe um WhatsApp válido com DDD, ex.: (11) 99999-9999.</p>
              )}
            </>
          )}
        </div>
      );
    })}
    <div className="flex items-start gap-2 pt-2">
      <Checkbox id="gdpr" checked={consent} onCheckedChange={(c) => onConsentChange(!!c)} />
      <Label htmlFor="gdpr" className="text-xs text-muted-foreground leading-relaxed">
        Concordo em receber comunicações sobre este evento e consinto com o processamento dos meus dados de acordo com a Política de Privacidade.
      </Label>
    </div>
    <Button
      type="submit"
      className="w-full h-12 text-base font-semibold border-0 text-white rounded-full shadow-lg bg-primary"
      disabled={isPending}
    >
      {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inscrevendo…</> : "Garantir minha vaga"}
    </Button>
  </form>
);


const PoweredBy = () => (
  <p className="text-center text-xs text-muted-foreground mt-6">
    Powered by <span className="font-semibold">CENTERFRIOS</span>
  </p>
);

// ─── Main component ───

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const UTM_STORAGE_KEY = "lead_utms";

function captureUtms(searchParams: URLSearchParams): Record<string, string> {
  const fromUrl: Record<string, string> = {};
  UTM_KEYS.forEach(k => {
    const v = searchParams.get(k);
    if (v) fromUrl[k] = v;
  });
  if (Object.keys(fromUrl).length > 0) {
    try { sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl)); } catch {}
    return fromUrl;
  }
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

const Register = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { data: event, isLoading: eventLoading } = useEventBySlug(slug);
  const { data: formFields, isLoading: fieldsLoading } = useFormFields(event?.id);
  const createReg = useCreateRegistration();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const utmsRef = useRef<Record<string, string>>({});
  const formStartedRef = useRef(false);
  const lastTrackedRef = useRef<{ email?: string; name?: string; whatsapp?: string }>({});

  useEffect(() => {
    utmsRef.current = captureUtms(searchParams);
  }, [searchParams]);

  // Tracking: registra a visita assim que o evento é carregado
  useEffect(() => {
    if (!event?.id) return;
    trackPageView(event.id, buildInitialPayload(searchParams));
  }, [event?.id, searchParams]);

  // Tracking: marca abandono quando o usuário sai sem submeter
  useEffect(() => {
    if (!event?.id) return;
    const handleAbandon = () => {
      if (formStartedRef.current && !submitted) {
        trackPageView(event.id, { form_abandoned: true });
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") handleAbandon();
    };
    window.addEventListener("beforeunload", handleAbandon);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", handleAbandon);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [event?.id, submitted]);

  const handleFieldChange = useCallback((label: string, value: string) => {
    setFormData(prev => ({ ...prev, [label]: value }));
    if (!formStartedRef.current && event?.id) {
      formStartedRef.current = true;
      trackPageView(event.id, { form_started: true });
    }
  }, [event?.id]);

  const handleFieldBlur = useCallback((label: string, value: string) => {
    if (!event?.id || !value?.trim()) return;
    const lower = label.toLowerCase();
    const payload: Parameters<typeof trackPageView>[1] = {};
    if (lower.includes("e-mail") || lower.includes("email")) {
      if (lastTrackedRef.current.email === value) return;
      lastTrackedRef.current.email = value;
      payload.partial_email = value;
    } else if (lower.includes("nome") || lower.includes("name")) {
      if (lastTrackedRef.current.name === value) return;
      lastTrackedRef.current.name = value;
      payload.partial_name = value;
    } else if (isWhatsAppField(label)) {
      if (lastTrackedRef.current.whatsapp === value) return;
      lastTrackedRef.current.whatsapp = value;
      payload.partial_whatsapp = value;
    } else {
      return;
    }
    trackPageView(event.id, payload);
  }, [event?.id]);

  useEffect(() => {
    if (!event) return;
    const title = `Inscreva-se · ${event.name}`;
    const description = (event.description || `Faça sua inscrição gratuita em ${event.name}.`).slice(0, 160);
    const image = event.background_image_url || "";
    const url = typeof window !== "undefined" ? window.location.href : "";
    const canonical = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";

    document.title = title;

    const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
      if (!content) return;
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:type"]', "property", "og:type", "website");
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:url"]', "property", "og:url", url);
    if (image) setMeta('meta[property="og:image"]', "property", "og:image", image);
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    if (image) setMeta('meta[name="twitter:image"]', "name", "twitter:image", image);

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonical);
  }, [event]);

  const seoHead = null;

  if (eventLoading || fieldsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-display font-bold mb-2">Evento não encontrado</h1>
            <p className="text-muted-foreground">Este evento pode ter sido encerrado ou o link é inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Aceite a política de privacidade para se inscrever.");
      return;
    }
    const missing = formFields?.filter(f => f.required && !formData[f.label]?.trim());
    if (missing && missing.length > 0) {
      toast.error(`Preencha: ${missing.map(f => f.label).join(", ")}`);
      return;
    }
    const invalidPhone = formFields?.find(f => f.required && isWhatsAppField(f.label) && !isValidBRPhone(formData[f.label] || ""));
    if (invalidPhone) {
      toast.error("Informe um WhatsApp válido com DDD (ex.: (11) 99999-9999).");
      return;
    }
    try {
      const utms = utmsRef.current || {};
      const registrationId = (await createReg.mutateAsync({ event_id: event.id, data: formData, tracking: utms })) as unknown as string;
      // Marca conversão na visita rastreada
      if (registrationId) {
        trackPageView(event.id, { converted_registration_id: registrationId });
      }
      // Analytics-ready event (Meta Pixel / GA4 / GTM can hook into this)
      try {
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).dataLayer.push({ event: "lead_registered", event_name: event.name, event_id: event.id, ...utms });
      } catch {}
      // Fire-and-forget confirmation email. The edge function looks up
      // recipient/event details from the DB by registrationId — we never
      // pass an email from the client (prevents open-relay abuse).
      try {
        if (registrationId) {
          console.log("[confirmation-email] invoking", { registrationId });
          supabase.functions
            .invoke("send-registration-confirmation", {
              body: {
                registrationId,
                origin: typeof window !== "undefined" ? window.location.origin : null,
              },
            })
            .then(({ data, error }) => {
              if (error) {
                console.error("[confirmation-email] invoke error", {
                  message: error.message,
                  status: (error as any).status,
                  context: (error as any).context,
                  data,
                });
              } else {
                console.log("[confirmation-email] invoke ok", data);
              }
            })
            .catch((err) =>
              console.error("[confirmation-email] invoke threw", err),
            );
        } else {
          console.warn("[confirmation-email] no registrationId returned, skipping");
        }
      } catch (err) {
        console.error("[confirmation-email] dispatch exception", err);
      }
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Falha na inscrição");
    }
  };

  const brandColor = event.primary_color || "#7C3AED";
  const template = event.template || "split";
  const flyerUrl = event.background_image_url;
  const isDark = (event as any).color_mode === "dark";
  const urgencyText = "Inscrição gratuita · leva menos de 1 minuto";

  const formProps = {
    formFields,
    formData,
    onFieldChange: handleFieldChange,
    onFieldBlur: handleFieldBlur,
    consent,
    onConsentChange: setConsent,
    onSubmit: handleSubmit,
    isPending: createReg.isPending,
    brandColor,
    urgencyText,
  };

  const wrapDark = (content: React.ReactNode) => (
    <div className={isDark ? "dark" : ""}>
      {seoHead}
      {content}
    </div>
  );

  if (submitted) {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/register/${event.slug}` : "";
    return wrapDark(
      <div
        className="min-h-screen bg-background text-foreground relative overflow-hidden"
        style={{
          background: isDark
            ? `radial-gradient(ellipse at top, ${brandColor}25, transparent 60%), hsl(var(--background))`
            : `radial-gradient(ellipse at top, ${brandColor}22, transparent 55%), linear-gradient(180deg, ${brandColor}08, hsl(var(--background)) 70%)`,
        }}
      >
        <div className="relative min-h-screen flex items-center justify-center px-4 py-16 sm:py-20">
          <SuccessCard brandColor={brandColor} event={event} name={formData["Nome Completo"] || formData["Nome"] || formData["Name"] || ""} shareUrl={shareUrl} />
        </div>
      </div>
    );
  }

  // ─── MINIMAL ───
  if (template === "minimal") {
    return wrapDark(
      <div className="min-h-screen relative bg-background text-foreground">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${brandColor}15, ${brandColor}05)` }} />
        <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
            <Card className="border-border shadow-2xl">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}>
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <EventInfo event={event} />
                </div>
                <RegistrationForm {...formProps} />
                <PoweredBy />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── SPLIT SCREEN ───
  if (template === "split") {
    return wrapDark(
      <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
        {/* Left: flyer image — top-aligned on mobile */}
        <div className="md:w-1/2 bg-muted flex items-start md:items-center justify-center p-0 md:p-6 min-h-[250px] md:min-h-screen">
          {flyerUrl ? (
            <img src={flyerUrl} alt={event.name} className="w-full md:max-w-full md:max-h-full object-contain md:rounded-lg" />
          ) : (
            <div className="text-center p-6">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}>
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-display font-bold">{event.name}</h2>
            </div>
          )}
        </div>
        {/* Right: form */}
        <div className="md:w-1/2 flex items-center justify-center px-4 py-8 md:px-8 md:py-12">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-[85%]">
            <EventInfo event={event} className="mb-8" />
            <RegistrationForm {...formProps} />
            <PoweredBy />
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── STACKED ───
  if (template === "stacked") {
    return wrapDark(
      <div className="min-h-screen bg-background text-foreground" style={{ background: isDark ? undefined : `linear-gradient(135deg, ${brandColor}15, ${brandColor}05)` }}>
        {flyerUrl ? (
          <div className="w-full bg-muted flex items-start justify-center" style={{ maxHeight: "50vh" }}>
            <img src={flyerUrl} alt={event.name} className="w-full h-full object-contain" style={{ maxHeight: "50vh" }} />
          </div>
        ) : (
          <div className="w-full py-16 text-center" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}>
            <h1 className="text-4xl font-display font-bold text-white">{event.name}</h1>
            {event.description && <p className="text-white/80 mt-2 max-w-lg mx-auto">{event.description}</p>}
          </div>
        )}
        <div className="max-w-lg mx-auto px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border shadow-2xl">
              <CardContent className="p-8">
                <EventInfo event={event} className="mb-6" />
                <RegistrationForm {...formProps} />
                <PoweredBy />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── LANDING PAGE ───
  if (template === "landing") {
    return wrapDark(
      <div className="min-h-screen bg-background text-foreground">
        <div className="relative w-full flex items-start justify-center" style={{ minHeight: "50vh" }}>
          {flyerUrl ? (
            <>
              <img src={flyerUrl} alt={event.name} className="absolute inset-0 w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/60" />
            </>
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }} />
          )}
          <div className="relative text-center text-white px-4 py-16 z-10">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-display font-bold mb-4 truncate max-w-3xl mx-auto">{event.name}</h1>
            {event.description && <p className="text-white/80 max-w-xl mx-auto text-lg leading-relaxed mt-3">{event.description}</p>}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-white/70">
              {event.event_date && (
                <span className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  {formatEventDateTime(event)}
                </span>
              )}
              <span className="flex items-center gap-2">
                {event.location_type === "physical" ? <MapPin className="w-5 h-5" /> : event.location_type === "hybrid" ? <Globe className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                {event.location_type === "physical" ? "Presencial" : event.location_type === "hybrid" ? "Híbrido" : "Virtual"}
              </span>
            </div>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-12 -mt-8 relative z-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border shadow-2xl">
              <CardContent className="p-8">
                <h2 className="text-xl font-display font-bold mb-6 text-center">Inscreva-se</h2>
                <RegistrationForm {...formProps} />
                <PoweredBy />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── CARD GRID ───
  if (template === "cards") {
    return wrapDark(
      <div className="min-h-screen bg-background text-foreground" style={{ background: isDark ? undefined : `linear-gradient(135deg, ${brandColor}15, ${brandColor}05)` }}>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            {flyerUrl && (
              <div className="mb-6 flex justify-center">
                <img src={flyerUrl} alt={event.name} className="max-h-64 object-contain rounded-lg" />
              </div>
            )}
            <EventInfo event={event} />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-display font-semibold mb-3">Detalhes do evento</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{event.description || "Participe deste evento incrível."}</p>
                {event.event_date && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="w-4 h-4" />
                    {formatEventDateTime(event)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border shadow-xl">
              <CardContent className="p-6">
                <h3 className="font-display font-semibold mb-4">Inscreva-se</h3>
                <RegistrationForm {...formProps} />
              </CardContent>
            </Card>
          </div>
          <PoweredBy />
        </div>
      </div>
    );
  }

  // Fallback
  return wrapDark(
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background text-foreground" style={{ background: isDark ? undefined : `linear-gradient(135deg, ${brandColor}15, ${brandColor}05)` }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <Card className="border-border shadow-2xl">
          <CardContent className="p-8">
            <EventInfo event={event} className="text-center mb-8" />
            <RegistrationForm {...formProps} />
            <PoweredBy />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Register;
