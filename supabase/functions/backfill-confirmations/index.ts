// Reenvia confirmações de inscrição para inscritos que ainda não receberam.
// Antes de enviar, consulta a API do Resend para confirmar que a mensagem
// não foi marcada como "delivered" — assim evitamos duplicar envio para
// inscritos que de fato receberam (mesmo que nosso log local não saiba).
//
// Ritmo seguro: envios SEQUENCIAIS, lotes de 5, 400ms entre cada item e
// 2s entre lotes. Resultado ≈ 2 envios/seg — bem abaixo dos 10/s do Resend.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { prepareEmailForSend } from "../_shared/email-validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_BASE = "https://api.resend.com";
const BATCH_SIZE = 5;
const PER_ITEM_DELAY_MS = 400;
const PER_BATCH_DELAY_MS = 2000;
const DEDUPE_WINDOW_DAYS = 30;

interface Payload {
  eventId?: string | null;
  dryRun?: boolean;
  registrationIds?: string[] | null;
  force?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function alreadyDeliveredOnResend(
  email: string,
  resendApiKey: string,
): Promise<boolean> {
  try {
    const url = `${RESEND_API_BASE}/emails?to=${encodeURIComponent(email)}&limit=20`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });
    if (!resp.ok) return false;
    const json = (await resp.json()) as any;
    const items: any[] = json?.data || json?.emails || [];
    return items.some((it) => {
      const status = String(it?.last_event || it?.status || "").toLowerCase();
      return status === "delivered";
    });
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY_RAW = Deno.env.get("RESEND_API_KEY") || "";
    const resendNativeKey = RESEND_API_KEY_RAW.startsWith("re_") ? RESEND_API_KEY_RAW : "";

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const targetEventId = body.eventId || null;
    const dryRun = body.dryRun === true;
    const force = body.force === true;
    const explicitIds = Array.isArray(body.registrationIds)
      ? body.registrationIds.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 500)
      : null;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId, _role: "admin",
    });

    if (targetEventId) {
      const { data: ev } = await supabase
        .from("events").select("id,user_id").eq("id", targetEventId).maybeSingle();
      if (!ev) {
        return new Response(JSON.stringify({ error: "event_not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (ev.user_id !== userId && !isAdmin) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (explicitIds && explicitIds.length > 0) {
      // Quando vêm IDs explícitos, valida que todos pertencem a eventos do usuário (ou admin).
      if (!isAdmin) {
        const { data: regsCheck } = await supabase
          .from("registrations")
          .select("id, event_id, events!inner(user_id)")
          .in("id", explicitIds);
        const ok = (regsCheck || []).every((r: any) => r.events?.user_id === userId);
        if (!ok || (regsCheck || []).length === 0) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let regsQuery = supabase
      .from("registrations")
      .select("id, lead_email, event_id, tracking, created_at, status")
      .neq("status", "cancelled")
      .order("created_at", { ascending: true })
      .limit(500);
    if (explicitIds && explicitIds.length > 0) {
      regsQuery = regsQuery.in("id", explicitIds);
    } else if (targetEventId) {
      regsQuery = regsQuery.eq("event_id", targetEventId);
    }

    const { data: regs, error: regsErr } = await regsQuery;
    if (regsErr) throw regsErr;

    // Quem já tem 'sent' em email_send_log para confirmação
    const ids = (regs || []).map((r) => r.id);
    let sentSet = new Set<string>();
    if (ids.length) {
      const { data: logs } = await supabase
        .from("email_send_log")
        .select("registration_id")
        .in("registration_id", ids)
        .in("email_type", ["confirmation", "registration_confirmation"])
        .eq("status", "sent");
      sentSet = new Set((logs || []).map((l) => l.registration_id as string));
    }

    // Anti-duplicação cross-registration: e-mails que já receberam confirmação
    // para o mesmo evento nos últimos 30 dias (em outra inscrição).
    const recentSince = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86400 * 1000).toISOString();
    let recentlyEmailedByEvent = new Map<string, Set<string>>(); // eventId -> Set(email)
    try {
      const { data: recentLogs } = await supabase
        .from("email_send_log")
        .select("recipient_email, registration_id")
        .in("email_type", ["confirmation", "registration_confirmation"])
        .eq("status", "sent")
        .gte("created_at", recentSince);
      const regIds = (recentLogs || []).map((l: any) => l.registration_id).filter(Boolean);
      if (regIds.length > 0) {
        const { data: regsForLogs } = await supabase
          .from("registrations")
          .select("id, event_id")
          .in("id", regIds);
        const regToEvent = new Map<string, string>(
          (regsForLogs || []).map((r: any) => [r.id, r.event_id]),
        );
        for (const log of recentLogs || []) {
          const eid = regToEvent.get((log as any).registration_id);
          const em = ((log as any).recipient_email || "").toLowerCase();
          if (!eid || !em) continue;
          if (!recentlyEmailedByEvent.has(eid)) recentlyEmailedByEvent.set(eid, new Set());
          recentlyEmailedByEvent.get(eid)!.add(em);
        }
      }
    } catch (e) {
      console.warn("[backfill] cross-dedupe load failed", e);
    }

    // Supressão
    const emails = (regs || [])
      .map((r) => (r.lead_email || "").toLowerCase().trim())
      .filter(Boolean);
    let suppressedSet = new Set<string>();
    if (emails.length) {
      const { data: supp } = await supabase
        .from("suppressed_emails").select("email").in("email", emails);
      suppressedSet = new Set((supp || []).map((s) => s.email as string));
    }

    let skipped_invalid = 0, skipped_dedupe_event = 0;

    const candidates = (regs || []).filter((r) => {
      const prep = prepareEmailForSend(r.lead_email);
      if (!prep.ok) { skipped_invalid++; return false; }
      if (sentSet.has(r.id)) return false;
      if ((r.tracking as any)?.confirmation_email_sent_at) return false;
      if (suppressedSet.has(prep.email)) return false;
      const evSet = recentlyEmailedByEvent.get(r.event_id);
      if (evSet && evSet.has(prep.email)) { skipped_dedupe_event++; return false; }
      return true;
    });

    if (dryRun) {
      return new Response(
        JSON.stringify({
          ok: true, pending: candidates.length, total: regs?.length || 0,
          skipped_invalid, skipped_dedupe_event,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sent = 0, skipped_delivered = 0, skipped_suppressed = 0, failed = 0;
    let aborted = false;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      if (aborted) break;
      const batch = candidates.slice(i, i + BATCH_SIZE);

      // SEQUENCIAL para garantir o espaçamento real
      for (const r of batch) {
        if (aborted) break;
        const prep = prepareEmailForSend(r.lead_email);
        if (!prep.ok) { skipped_invalid++; continue; }
        const email = prep.email;

        // Verifica cooldown global antes de cada envio (provedor pode ter caído mid-batch)
        try {
          const { data: state } = await supabase
            .from("email_send_state").select("cooldown_until").eq("id", 1).maybeSingle();
          if (state?.cooldown_until && new Date(state.cooldown_until as string) > new Date()) {
            console.warn("[backfill] cooldown ativo, abortando lote");
            aborted = true; break;
          }
        } catch (_) { /* noop */ }

        // Resend "already delivered"
        if (resendNativeKey) {
          const delivered = await alreadyDeliveredOnResend(email, resendNativeKey);
          if (delivered) {
            skipped_delivered++;
            await supabase.from("email_send_log").insert({
              registration_id: r.id,
              email_type: "confirmation",
              recipient_email: email,
              status: "sent",
              error_message: "backfill: already delivered on resend",
            });
            await supabase.from("registrations").update({
              tracking: { ...(r.tracking as any || {}), confirmation_email_sent_at: new Date().toISOString() },
            }).eq("id", r.id);
            await sleep(PER_ITEM_DELAY_MS);
            continue;
          }
        }

        // Reenvio através da função existente
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-registration-confirmation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE}`,
            },
            body: JSON.stringify({ registrationId: r.id }),
          });
          const json = await resp.json().catch(() => ({}));
          if (resp.ok && (json as any)?.ok) sent++;
          else if ((json as any)?.suppressed) skipped_suppressed++;
          else if ((json as any)?.alreadySent) skipped_delivered++;
          else if ((json as any)?.skipped) { /* cooldown */ aborted = true; }
          else failed++;
        } catch (e) {
          console.error("[backfill] send error", r.id, e);
          failed++;
        }
        await sleep(PER_ITEM_DELAY_MS);
      }
      if (i + BATCH_SIZE < candidates.length && !aborted) await sleep(PER_BATCH_DELAY_MS);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_candidates: candidates.length,
        sent, skipped_delivered, skipped_suppressed, skipped_invalid, skipped_dedupe_event,
        failed, aborted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[backfill-confirmations] unhandled", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
