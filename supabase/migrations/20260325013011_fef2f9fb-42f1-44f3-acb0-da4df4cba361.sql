
-- Remove the overly permissive public SELECT policy
DROP POLICY "Public can view registration counts for live events" ON public.registrations;

-- Create a secure function for public registration counts (no PII exposed)
CREATE OR REPLACE FUNCTION public.get_registration_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM registrations
  WHERE event_id = p_event_id
    AND status != 'cancelled'::registration_status
$$;
