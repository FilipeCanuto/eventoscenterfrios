// Reenvia confirmações de inscrição para inscritos que ainda não receberam.
// Antes de enviar, consulta a API do Resend para confirmar que a mensagem
// não foi marcada como "delivered" — assim evitamos duplicar envio para
// inscritos que de fato receberam (mesmo que nosso log local não saiba).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_BASE = "https://api.resend.com";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const BATCH_SIZE = 8;
const DELAY_MS = 1100; // ~6 mensagens/seg <<< 10/s do plano Resend padrão

interface Payload {
  eventId?: string | null;
  // dryRun apenas calcula quantos seriam enviados sem realmente disparar
  dryRun?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Resend não tem endpoint "list emails by recipient" estável,
// então usamos a API de busca: GET /emails?to={email}&limit=10
// Se o plano não suportar, o try/catch mantém o fluxo seguro
// (default: assume não entregue → envia).
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
    // O secret pode estar como connection-key (não começa com re_); só usamos
    // para a checagem direta do Resend se for um api key real.
    const resendNativeKey = RESEND_API_KEY_RAW.startsWith("re_") ? RESEND_API_KEY_RAW : "";

    // Verifica se o caller é admin OU dono do evento solicitado
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

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Permissão: admin global OU dono do evento alvo (se eventId fornecido)
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
    } else if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar inscrições candidatas
    let regsQuery = supabase
      .from("registrations")
      .select("id, lead_email, event_id, tracking, created_at, status")
      .eq("status", "registered")
      .order("created_at", { ascending: true })
      .limit(500);
    if (targetEventId) regsQuery = regsQuery.eq("event_id", targetEventId);

    const { data: regs, error: regsErr } = await regsQuery;
    if (regsErr) throw regsErr;

    // Mapear quem já tem registro 'sent' em email_send_log para confirmação
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

    const candidates = (regs || []).filter((r) => {
      const email = (r.lead_email || "").toLowerCase().trim();
      if (!email) return false;
      if (sentSet.has(r.id)) return false;
      // Tracking flag legado do envio inline
      if ((r.tracking as any)?.confirmation_email_sent_at) return false;
      if (suppressedSet.has(email)) return false;
      return true;
    });

    if (dryRun) {
      return new Response(
        JSON.stringify({ ok: true, pending: candidates.length, total: regs?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sent = 0, skipped_delivered = 0, skipped_suppressed = 0, failed = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (r) => {
        const email = (r.lead_email || "").toLowerCase().trim();

        // Checagem opcional contra Resend (se temos a chave nativa)
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
            // marca tracking para não reaparecer
            await supabase.from("registrations").update({
              tracking: { ...(r.tracking as any || {}), confirmation_email_sent_at: new Date().toISOString() },
            }).eq("id", r.id);
            return;
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
            body: JSON.stringify({ registrationId: r.id, force: true }),
          });
          const json = await resp.json().catch(() => ({}));
          if (resp.ok && (json as any)?.ok) sent++;
          else if ((json as any)?.suppressed) skipped_suppressed++;
          else failed++;
        } catch (e) {
          console.error("[backfill] send error", r.id, e);
          failed++;
        }
      }));
      if (i + BATCH_SIZE < candidates.length) await sleep(DELAY_MS);
    }

    return new Response(
      JSON.stringify({ ok: true, total_candidates: candidates.length, sent, skipped_delivered, skipped_suppressed, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[backfill-confirmations] unhandled", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
