import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "me_visitor_id";
const SESSION_KEY = "me_session_id";

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = genId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return genId();
  }
}

export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = genId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return genId();
  }
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|iphone|android.*mobile/.test(ua)) return "mobile";
  if (/tablet|ipad/.test(ua)) return "tablet";
  return "desktop";
}

export type TrackPayload = {
  referrer?: string;
  landing_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  device_type?: string;
  user_agent?: string;
  partial_email?: string;
  partial_name?: string;
  partial_whatsapp?: string;
  form_started?: boolean;
  form_abandoned?: boolean;
  converted_registration_id?: string;
};

export async function trackPageView(eventId: string, payload: TrackPayload = {}): Promise<void> {
  try {
    const visitor_id = getVisitorId();
    const session_id = getSessionId();
    const data: TrackPayload = {
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      landing_url: typeof window !== "undefined" ? window.location.href : undefined,
      device_type: detectDevice(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      ...payload,
    };
    await supabase.rpc("track_page_view", {
      p_event_id: eventId,
      p_visitor_id: visitor_id,
      p_session_id: session_id,
      p_data: data as any,
    });
  } catch (err) {
    // Silencioso — tracking nunca deve quebrar a UX
    console.warn("[trackPageView] failed", err);
  }
}

export function buildInitialPayload(searchParams: URLSearchParams): TrackPayload {
  return {
    utm_source: searchParams.get("utm_source") || undefined,
    utm_medium: searchParams.get("utm_medium") || undefined,
    utm_campaign: searchParams.get("utm_campaign") || undefined,
    utm_term: searchParams.get("utm_term") || undefined,
    utm_content: searchParams.get("utm_content") || undefined,
  };
}
