import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventPageView = {
  id: string;
  event_id: string;
  visitor_id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  referrer: string | null;
  landing_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  device_type: string | null;
  user_agent: string | null;
  partial_email: string | null;
  partial_name: string | null;
  partial_whatsapp: string | null;
  form_started_at: string | null;
  form_abandoned_at: string | null;
  converted_registration_id: string | null;
};

export const useEventPageViews = (eventId: string | undefined) => {
  return useQuery({
    queryKey: ["event-page-views", eventId],
    queryFn: async (): Promise<EventPageView[]> => {
      if (!eventId) return [];
      const { data, error } = await (supabase as any)
        .from("event_page_views")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as EventPageView[];
    },
    enabled: !!eventId,
  });
};
