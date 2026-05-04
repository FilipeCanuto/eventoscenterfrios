
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id uuid, p_data jsonb, p_tracking jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_event record;
  v_current_count integer;
  v_email text;
  v_email_count integer;
  v_name text;
  v_whatsapp text;
  v_whatsapp_count integer;
BEGIN
  SELECT id, status, capacity, registration_limit, registration_deadline
  INTO v_event
  FROM events
  WHERE id = p_event_id AND status = 'live'::event_status
  FOR UPDATE;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found or not accepting registrations';
  END IF;

  IF v_event.registration_deadline IS NOT NULL AND now() > v_event.registration_deadline THEN
    RAISE EXCEPTION 'Registration deadline has passed';
  END IF;

  SELECT count(*) INTO v_current_count
  FROM registrations
  WHERE event_id = p_event_id AND status != 'cancelled'::registration_status;

  IF v_event.capacity IS NOT NULL AND v_current_count >= v_event.capacity THEN
    RAISE EXCEPTION 'Event is at full capacity';
  END IF;

  IF v_event.registration_limit IS NOT NULL AND v_current_count >= v_event.registration_limit THEN
    RAISE EXCEPTION 'Registration limit reached';
  END IF;

  IF p_data IS NULL OR p_data = '{}'::jsonb THEN
    RAISE EXCEPTION 'Registration data is required';
  END IF;

  IF octet_length(p_data::text) > 4096 THEN
    RAISE EXCEPTION 'Registration data too large';
  END IF;

  IF octet_length(COALESCE(p_tracking, '{}'::jsonb)::text) > 2048 THEN
    RAISE EXCEPTION 'Tracking data too large';
  END IF;

  v_email := lower(trim(COALESCE(
    p_data->>'Endereço de E-mail',
    p_data->>'Endereço de Email',
    p_data->>'E-mail',
    p_data->>'Email Address',
    p_data->>'Email',
    p_data->>'email',
    ''
  )));
  v_name  := trim(COALESCE(
    p_data->>'Nome Completo',
    p_data->>'Full Name',
    p_data->>'Nome',
    p_data->>'Name',
    ''
  ));
  v_whatsapp := regexp_replace(COALESCE(
    p_data->>'WhatsApp',
    p_data->>'whatsapp',
    p_data->>'Telefone',
    p_data->>'Phone',
    ''
  ), '\D', '', 'g');

  IF v_whatsapp IS NOT NULL AND v_whatsapp != '' THEN
    SELECT count(*) INTO v_whatsapp_count
    FROM registrations
    WHERE event_id = p_event_id
      AND status != 'cancelled'::registration_status
      AND lead_whatsapp = v_whatsapp;

    IF v_whatsapp_count >= 1 THEN
      RAISE EXCEPTION 'This WhatsApp number is already registered for this event';
    END IF;
  ELSE
    IF v_email IS NOT NULL AND v_email != '' THEN
      SELECT count(*) INTO v_email_count
      FROM registrations
      WHERE event_id = p_event_id
        AND status != 'cancelled'::registration_status
        AND lower(trim(COALESCE(
          data->>'Endereço de E-mail',
          data->>'Endereço de Email',
          data->>'E-mail',
          data->>'Email Address',
          data->>'Email',
          data->>'email',
          ''
        ))) = v_email;

      IF v_email_count >= 5 THEN
        RAISE EXCEPTION 'This email has reached the maximum number of registrations for this event';
      END IF;
    END IF;
  END IF;

  INSERT INTO registrations (event_id, data, tracking, lead_name, lead_email, lead_whatsapp)
  VALUES (
    p_event_id,
    p_data,
    COALESCE(p_tracking, '{}'::jsonb),
    NULLIF(v_name, ''),
    NULLIF(v_email, ''),
    NULLIF(v_whatsapp, '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_registrations_by_email(p_event_id uuid, p_email text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  WHERE r.event_id = p_event_id
    AND e.status = 'live'::event_status
    AND r.status != 'cancelled'::registration_status
    AND lower(trim(coalesce(r.lead_email, ''))) = lower(trim(coalesce(p_email, '')))
    AND coalesce(p_email, '') != '';
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_registered_for_event(p_event_id uuid, p_whatsapp text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.event_id = p_event_id
      AND e.status = 'live'::event_status
      AND r.status != 'cancelled'::registration_status
      AND r.lead_whatsapp = regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g')
      AND coalesce(p_whatsapp, '') != ''
  );
$function$;

GRANT EXECUTE ON FUNCTION public.count_registrations_by_email(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_registered_for_event(uuid, text) TO anon, authenticated;
