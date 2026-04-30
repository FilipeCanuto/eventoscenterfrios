import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailLogRow {
  id: string;
  email_type: string;
  status: string;
  recipient_email: string | null;
  provider_status: number | null;
  error_message: string | null;
  created_at: string;
}

export interface ScheduledEmailRow {
  id: string;
  email_type: string;
  status: string;
  send_at: string;
  sent_at: string | null;
  attempts: number;
  error: string | null;
}

export interface RegistrationEmails {
  log: EmailLogRow[];
  scheduled: ScheduledEmailRow[];
  suppressed: { email: string; reason: string } | null;
}

export function useRegistrationEmails(registrationId: string | null, recipientEmail: string | null) {
  return useQuery({
    queryKey: ["registration-emails", registrationId, recipientEmail],
    enabled: !!registrationId,
    staleTime: 30_000,
    queryFn: async (): Promise<RegistrationEmails> => {
      const [logRes, schedRes, suppRes] = await Promise.all([
        supabase
          .from("email_send_log")
          .select("id, email_type, status, recipient_email, provider_status, error_message, created_at")
          .eq("registration_id", registrationId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("scheduled_emails")
          .select("id, email_type, status, send_at, sent_at, attempts, error")
          .eq("registration_id", registrationId!)
          .order("send_at", { ascending: true }),
        recipientEmail
          ? supabase.from("suppressed_emails").select("email,reason").eq("email", recipientEmail.toLowerCase()).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      return {
        log: (logRes.data || []) as EmailLogRow[],
        scheduled: (schedRes.data || []) as ScheduledEmailRow[],
        suppressed: (suppRes as any).data || null,
      };
    },
  });
}

export interface PendingCount {
  pending: number;
  total: number;
}

export async function fetchPendingConfirmations(eventId: string): Promise<PendingCount> {
  const { data, error } = await supabase.functions.invoke("backfill-confirmations", {
    body: { eventId, dryRun: true },
  });
  if (error) throw error;
  return { pending: (data as any)?.pending || 0, total: (data as any)?.total || 0 };
}

export async function runBackfillConfirmations(eventId: string) {
  const { data, error } = await supabase.functions.invoke("backfill-confirmations", {
    body: { eventId },
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    total_candidates: number;
    sent: number;
    skipped_delivered: number;
    skipped_suppressed: number;
    failed: number;
  };
}

export async function fetchEmailPreview(registrationId: string, templateType: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.functions.invoke("render-email-preview", {
    body: { registrationId, templateType, origin },
  });
  if (error) throw error;
  return data as { ok: boolean; subject: string; html: string; text: string };
}
