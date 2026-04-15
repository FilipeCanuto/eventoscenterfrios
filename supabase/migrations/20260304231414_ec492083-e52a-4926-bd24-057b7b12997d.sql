
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id uuid,
  p_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE id = p_event_id AND status = 'live'::event_status
  ) THEN
    RAISE EXCEPTION 'Event not found or not accepting registrations';
  END IF;

  INSERT INTO registrations (event_id, data)
  VALUES (p_event_id, p_data)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
