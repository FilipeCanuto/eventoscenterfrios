-- 1. Add structured columns to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS lead_name text,
  ADD COLUMN IF NOT EXISTS lead_email text,
  ADD COLUMN IF NOT EXISTS lead_whatsapp text,
  ADD COLUMN IF NOT EXISTS tracking jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_registrations_lead_email ON public.registrations (lead_email);
CREATE INDEX IF NOT EXISTS idx_registrations_event_created ON public.registrations (event_id, created_at DESC);

-- 3. Updated registration RPC: accepts optional p_tracking, populates new columns
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id uuid,
  p_data jsonb,
  p_tracking jsonb DEFAULT '{}'::jsonb
)
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

  -- Extract & normalize key fields
  v_email := lower(trim(COALESCE(p_data->>'Email Address', p_data->>'email', p_data->>'Email', '')));
  v_name  := trim(COALESCE(p_data->>'Full Name', p_data->>'Nome Completo', p_data->>'Name', p_data->>'Nome', ''));
  v_whatsapp := regexp_replace(COALESCE(p_data->>'WhatsApp', p_data->>'whatsapp', p_data->>'Phone', p_data->>'Telefone', ''), '\D', '', 'g');

  IF v_email IS NOT NULL AND v_email != '' THEN
    SELECT count(*) INTO v_email_count
    FROM registrations
    WHERE event_id = p_event_id
      AND status != 'cancelled'::registration_status
      AND lower(trim(COALESCE(data->>'Email Address', data->>'email', data->>'Email', ''))) = v_email;

    IF v_email_count >= 2 THEN
      RAISE EXCEPTION 'This email has already been used to register for this event';
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