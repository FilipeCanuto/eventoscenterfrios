
CREATE OR REPLACE FUNCTION public.public_check_in_by_email(
  p_email text,
  p_event_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_reg record;
  v_open_count integer;
  v_any_count integer;
  v_events jsonb;
BEGIN
  v_email := lower(trim(coalesce(p_email, '')));

  IF v_email = '' OR length(v_email) > 255 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('status', 'invalid_email');
  END IF;

  -- Inscrições em eventos live, dentro da janela de check-in
  WITH open_regs AS (
    SELECT r.id, r.status, r.lead_name, r.checked_in_at,
           e.id AS event_id, e.name AS event_name, e.primary_color
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE lower(trim(coalesce(r.lead_email, ''))) = v_email
      AND r.status != 'cancelled'::registration_status
      AND e.status = 'live'::event_status
      AND e.event_date IS NOT NULL
      AND now() >= e.event_date - interval '4 hours'
      AND now() <= COALESCE(e.event_end_date, e.event_date) + interval '4 hours'
      AND (p_event_id IS NULL OR e.id = p_event_id)
  )
  SELECT count(*) INTO v_open_count FROM open_regs;

  IF v_open_count = 0 THEN
    -- Verifica se há inscrição mas fora da janela
    SELECT count(*) INTO v_any_count
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE lower(trim(coalesce(r.lead_email, ''))) = v_email
      AND r.status != 'cancelled'::registration_status
      AND e.status = 'live'::event_status;

    IF v_any_count > 0 THEN
      RETURN jsonb_build_object('status', 'outside_window');
    END IF;
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_open_count > 1 AND p_event_id IS NULL THEN
    SELECT jsonb_agg(DISTINCT jsonb_build_object('id', event_id, 'name', event_name))
    INTO v_events
    FROM (
      SELECT r.event_id, e.name AS event_name
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE lower(trim(coalesce(r.lead_email, ''))) = v_email
        AND r.status != 'cancelled'::registration_status
        AND e.status = 'live'::event_status
        AND e.event_date IS NOT NULL
        AND now() >= e.event_date - interval '4 hours'
        AND now() <= COALESCE(e.event_end_date, e.event_date) + interval '4 hours'
    ) sub;
    RETURN jsonb_build_object('status', 'multiple_events', 'events', v_events);
  END IF;

  -- Pega a inscrição (única ou filtrada por event_id)
  SELECT r.id, r.status, r.lead_name, r.checked_in_at,
         e.name AS event_name, e.primary_color
  INTO v_reg
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  WHERE lower(trim(coalesce(r.lead_email, ''))) = v_email
    AND r.status != 'cancelled'::registration_status
    AND e.status = 'live'::event_status
    AND e.event_date IS NOT NULL
    AND now() >= e.event_date - interval '4 hours'
    AND now() <= COALESCE(e.event_end_date, e.event_date) + interval '4 hours'
    AND (p_event_id IS NULL OR e.id = p_event_id)
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF v_reg.status = 'checked_in'::registration_status THEN
    RETURN jsonb_build_object(
      'status', 'already_checked_in',
      'name', v_reg.lead_name,
      'event_name', v_reg.event_name,
      'primary_color', v_reg.primary_color
    );
  END IF;

  UPDATE registrations
     SET status = 'checked_in'::registration_status,
         checked_in_at = now()
   WHERE id = v_reg.id
     AND status = 'registered'::registration_status;

  RETURN jsonb_build_object(
    'status', 'success',
    'name', v_reg.lead_name,
    'event_name', v_reg.event_name,
    'primary_color', v_reg.primary_color
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_check_in_by_email(text, uuid) TO anon, authenticated;
