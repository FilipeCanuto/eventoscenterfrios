CREATE OR REPLACE FUNCTION public.public_check_in_scan(p_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reg record;
  v_status text;
BEGIN
  IF p_registration_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT r.id, r.status, r.lead_name, r.checked_in_at,
         e.name AS event_name, e.primary_color, e.event_date, e.event_end_date
    INTO v_reg
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  WHERE r.id = p_registration_id;

  IF v_reg.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_status := public.public_check_in(p_registration_id);

  RETURN jsonb_build_object(
    'status', v_status,
    'name', v_reg.lead_name,
    'event_name', v_reg.event_name,
    'primary_color', v_reg.primary_color,
    'checked_in_at', v_reg.checked_in_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_check_in_scan(uuid) TO anon, authenticated;