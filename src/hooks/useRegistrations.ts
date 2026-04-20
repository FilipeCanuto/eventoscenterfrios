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
        .update({ status: "checked_in" })
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
