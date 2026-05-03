import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EmailBucket = "delivered" | "failed" | "suppressed" | "never";

export interface AuditRow {
  registration_id: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_whatsapp: string | null;
  created_at: string;
  bucket: EmailBucket;
  last_attempt_at: string | null;
  last_error: string | null;
}

export interface AuditSummary {
  total: number;
  delivered: number;
  failed: number;
  suppressed: number;
  never: number;
  rows: AuditRow[];
}

const CONFIRMATION_TYPES = ["confirmation", "registration_confirmation"];
const DELIVERED_STATUSES = new Set(["sent", "delivered"]);

export function useEventEmailAudit(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["event-email-audit", eventId],
    enabled: !!eventId,
    staleTime: 30_000,
    queryFn: async (): Promise<AuditSummary> => {
      const { data: regs, error: regsErr } = await supabase
        .from("registrations")
        .select("id, lead_name, lead_email, lead_whatsapp, created_at, status")
        .eq("event_id", eventId!)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (regsErr) throw regsErr;

      const ids = (regs || []).map((r) => r.id);
      const emails = Array.from(
        new Set(
          (regs || [])
            .map((r) => (r.lead_email || "").trim().toLowerCase())
            .filter(Boolean),
        ),
      );

      const [{ data: logs }, { data: supp }] = await Promise.all([
        ids.length
          ? supabase
              .from("email_send_log")
              .select("registration_id, email_type, status, error_message, created_at")
              .in("registration_id", ids)
              .in("email_type", CONFIRMATION_TYPES)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        emails.length
          ? supabase.from("suppressed_emails").select("email").in("email", emails)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // último log por inscrição
      const latestByReg = new Map<string, any>();
      for (const l of logs || []) {
        if (!latestByReg.has(l.registration_id)) latestByReg.set(l.registration_id, l);
      }
      const deliveredSet = new Set(
        (logs || [])
          .filter((l: any) => DELIVERED_STATUSES.has(l.status))
          .map((l: any) => l.registration_id),
      );
      const suppressedSet = new Set((supp || []).map((s: any) => s.email));

      const rows: AuditRow[] = (regs || []).map((r: any) => {
        const email = (r.lead_email || "").trim().toLowerCase();
        const last = latestByReg.get(r.id);
        let bucket: EmailBucket;
        if (deliveredSet.has(r.id)) bucket = "delivered";
        else if (email && suppressedSet.has(email)) bucket = "suppressed";
        else if (last && last.status === "failed") bucket = "failed";
        else bucket = "never";

        return {
          registration_id: r.id,
          lead_name: r.lead_name,
          lead_email: r.lead_email,
          lead_whatsapp: r.lead_whatsapp,
          created_at: r.created_at,
          bucket,
          last_attempt_at: last?.created_at || null,
          last_error: last?.error_message || null,
        };
      });

      const summary: AuditSummary = {
        total: rows.length,
        delivered: rows.filter((r) => r.bucket === "delivered").length,
        failed: rows.filter((r) => r.bucket === "failed").length,
        suppressed: rows.filter((r) => r.bucket === "suppressed").length,
        never: rows.filter((r) => r.bucket === "never").length,
        rows,
      };
      return summary;
    },
  });
}

export async function resendForRegistrations(
  registrationIds: string[],
  force: boolean = false,
) {
  const { data, error } = await supabase.functions.invoke("backfill-confirmations", {
    body: { registrationIds, force },
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    sent: number;
    skipped_delivered: number;
    skipped_suppressed: number;
    skipped_invalid: number;
    failed: number;
  };
}
