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

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ event_id, data }: { event_id: string; data: Record<string, string> }) => {
      const { data: result, error } = await supabase
        .rpc("register_for_event", {
          p_event_id: event_id,
          p_data: data as unknown as Json,
        });
      if (error) {
        throw error;
      }
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
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
