CREATE OR REPLACE FUNCTION public.get_registration_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  WHERE r.event_id = p_event_id
    AND e.status = 'live'::event_status
    AND r.status != 'cancelled'::registration_status;
$$;