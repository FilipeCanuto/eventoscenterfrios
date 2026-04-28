import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, Json } from "@/integrations/supabase/types";

export type Registration = Tables<"registrations"> & {
  events?: { name: string } | null;
};

export function useRegistrations() {
  return useQuery({
    queryKey: ["registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*, events(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Registration[];
    },
  });
}

export function useRegistrationsByEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["registrations", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables<"registrations">[];
    },
    enabled: !!eventId,
  });
}

function detectDevice(): "mobile" | "tablet" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

function buildTracking(extra: Record<string, string>): Record<string, string> {
  const tracking: Record<string, string> = { ...extra };
  if (typeof window !== "undefined") {
    try {
      tracking.landing_page = window.location.href.slice(0, 500);
      const ref = document.referrer;
      if (ref) tracking.referrer = ref.slice(0, 500);
    } catch {}
  }
  tracking.device_type = detectDevice();
  tracking.captured_at = new Date().toISOString();
  return tracking;
}

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      event_id,
      data,
      tracking = {},
    }: {
      event_id: string;
      data: Record<string, string>;
      tracking?: Record<string, string>;
    }) => {
      const fullTracking = buildTracking(tracking);
      const { data: result, error } = await supabase.rpc("register_for_event", {
        p_event_id: event_id,
        p_data: data as unknown as Json,
        p_tracking: fullTracking as unknown as Json,
      } as never);
      if (error) {
        // Fallback for older RPC signature without p_tracking
        if (/p_tracking|function .* does not exist|argument/i.test(error.message || "")) {
          const merged: Record<string, string> = { ...data };
          Object.entries(fullTracking).forEach(([k, v]) => { merged[`__${k}`] = v; });
          const { data: result2, error: error2 } = await supabase.rpc("register_for_event", {
            p_event_id: event_id,
            p_data: merged as unknown as Json,
          });
          if (error2) throw error2;
          return result2;
        }
        throw error;
      }
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
  });
}

export function useCancelRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("registrations")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["registration-stats"] });
    },
  });
}

export function useCheckInRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("registrations")
        .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["registration-stats"] });
    },
  });
}

export function useRevertCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("registrations")
        .update({ status: "registered", checked_in_at: null })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["registration-stats"] });
    },
  });
}

export type RegistrationEdits = {
  lead_name?: string | null;
  lead_email?: string | null;
  lead_whatsapp?: string | null;
  data?: Record<string, string>;
};

export function useUpdateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      current,
      edits,
    }: {
      id: string;
      current: Tables<"registrations">;
      edits: RegistrationEdits;
    }) => {
      const prevTracking = (current.tracking || {}) as Record<string, any>;
      const prevData = (current.data || {}) as Record<string, string>;

      const newName = edits.lead_name !== undefined ? edits.lead_name : current.lead_name;
      const newEmail = edits.lead_email !== undefined ? edits.lead_email : current.lead_email;
      const newWhats = edits.lead_whatsapp !== undefined ? edits.lead_whatsapp : current.lead_whatsapp;
      const mergedData = edits.data ? { ...prevData, ...edits.data } : prevData;

      // Track which fields were edited
      const changedFields: string[] = [];
      if (edits.lead_name !== undefined && (current.lead_name || "") !== (newName || "")) changedFields.push("lead_name");
      if (edits.lead_email !== undefined && (current.lead_email || "").toLowerCase() !== (newEmail || "").toLowerCase()) changedFields.push("lead_email");
      if (edits.lead_whatsapp !== undefined && (current.lead_whatsapp || "") !== (newWhats || "")) changedFields.push("lead_whatsapp");
      if (edits.data) {
        Object.keys(edits.data).forEach((k) => {
          if ((prevData[k] || "") !== (edits.data![k] || "")) changedFields.push(`data.${k}`);
        });
      }

      const emailChanged = changedFields.includes("lead_email");
      const editEntry = {
        at: new Date().toISOString(),
        fields: changedFields,
      };

      const newTracking: Record<string, any> = {
        ...prevTracking,
        edits: [...((prevTracking.edits as any[]) || []), editEntry],
      };
      // Force re-send when email changes
      if (emailChanged) {
        delete newTracking.confirmation_email_sent_at;
      }

      const { error } = await supabase
        .from("registrations")
        .update({
          lead_name: newName,
          lead_email: newEmail,
          lead_whatsapp: newWhats,
          data: mergedData as unknown as Json,
          tracking: newTracking as unknown as Json,
        })
        .eq("id", id);
      if (error) throw error;

      const wasSent = !!prevTracking.confirmation_email_sent_at;
      const shouldSendConfirmation = emailChanged || !wasSent;

      return { id, changedFields, emailChanged, shouldSendConfirmation };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["registration-stats"] });
    },
  });
}

export function useResendConfirmation() {
  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { data, error } = await supabase.functions.invoke("send-registration-confirmation", {
        body: { registrationId, force: true },
      });
      if (error) throw error;
      return data;
    },
  });
}

export async function checkDuplicateEmailForEvent(eventId: string, email: string, excludeId: string): Promise<number> {
  const target = email.trim().toLowerCase();
  if (!target) return 0;
  const { data, error } = await supabase
    .from("registrations")
    .select("id, lead_email, status, data")
    .eq("event_id", eventId)
    .neq("id", excludeId)
    .neq("status", "cancelled");
  if (error) return 0;
  return (data || []).filter((r: any) => {
    const d = (r.data || {}) as Record<string, string>;
    const e = (r.lead_email || d["Endereço de E-mail"] || d["E-mail"] || d["Email Address"] || d["Email"] || "").toString().trim().toLowerCase();
    return e === target;
  }).length;
}

export function useRegistrationStats() {
  return useQuery({
    queryKey: ["registration-stats"],
    queryFn: async () => {
      const { data: registrations, error } = await supabase
        .from("registrations")
        .select("created_at, event_id, status");
      if (error) throw error;
      
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, name, status");
      if (eventsError) throw eventsError;

      const total = registrations?.length ?? 0;
      const activeEvents = events?.filter(e => e.status === "live").length ?? 0;

      // Group by month
      const byMonth: Record<string, number> = {};
      registrations?.forEach(r => {
        const month = new Date(r.created_at).toLocaleString("default", { month: "short" });
        byMonth[month] = (byMonth[month] || 0) + 1;
      });

      const chartData = Object.entries(byMonth).map(([date, registrations]) => ({ date, registrations }));

      return { total, activeEvents, chartData, registrations, events };
    },
  });
}
