import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type PublicEvent = Tables<"events">;

/**
 * Fetches all live events publicly (no auth required).
 * Relies on the "Public can view live events" RLS policy.
 */
export function usePublicEvents(search?: string) {
  return useQuery({
    queryKey: ["public-events", search],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*")
        .eq("status", "live")
        .order("event_date", { ascending: true });

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PublicEvent[];
    },
  });
}
