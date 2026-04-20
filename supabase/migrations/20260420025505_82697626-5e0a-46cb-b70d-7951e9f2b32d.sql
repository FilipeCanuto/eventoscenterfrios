-- Tabela de rastreamento de visitas à página pública de inscrição
CREATE TABLE public.event_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  referrer text,
  landing_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  device_type text,
  user_agent text,
  partial_email text,
  partial_name text,
  partial_whatsapp text,
  form_started_at timestamptz,
  form_abandoned_at timestamptz,
  converted_registration_id uuid,
  CONSTRAINT event_page_views_session_unique UNIQUE (event_id, session_id)
);

CREATE INDEX idx_event_page_views_event_created ON public.event_page_views (event_id, created_at DESC);
CREATE INDEX idx_event_page_views_event_visitor ON public.event_page_views (event_id, visitor_id);
CREATE INDEX idx_event_page_views_partial_email ON public.event_page_views (event_id, partial_email) WHERE partial_email IS NOT NULL;

ALTER TABLE public.event_page_views ENABLE ROW LEVEL SECURITY;

-- Apenas dono do evento pode visualizar
CREATE POLICY "Event owners can view page views"
  ON public.event_page_views
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_page_views.event_id
      AND events.user_id = auth.uid()
  ));

-- Bloqueia INSERT/UPDATE/DELETE diretos (forçar uso da RPC)
-- Nenhuma policy de INSERT/UPDATE/DELETE = bloqueado por padrão com RLS habilitado

-- Função segura para upsert idempotente da visita
CREATE OR REPLACE FUNCTION public.track_page_view(
  p_event_id uuid,
  p_visitor_id text,
  p_session_id text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_event_exists boolean;
BEGIN
  -- Validações básicas
  IF p_event_id IS NULL OR p_visitor_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'event_id, visitor_id and session_id are required';
  END IF;

  IF length(p_visitor_id) > 100 OR length(p_session_id) > 100 THEN
    RAISE EXCEPTION 'visitor_id/session_id too long';
  END IF;

  IF octet_length(COALESCE(p_data, '{}'::jsonb)::text) > 4096 THEN
    RAISE EXCEPTION 'tracking data too large';
  END IF;

  -- Garante que o evento existe e está público (live) para evitar spam em eventos rascunho/encerrados
  SELECT EXISTS (
    SELECT 1 FROM events WHERE id = p_event_id AND status = 'live'::event_status
  ) INTO v_event_exists;

  IF NOT v_event_exists THEN
    RAISE EXCEPTION 'Event not found or not live';
  END IF;

  -- Upsert por (event_id, session_id)
  INSERT INTO event_page_views (
    event_id, visitor_id, session_id,
    referrer, landing_url,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    device_type, user_agent,
    partial_email, partial_name, partial_whatsapp,
    form_started_at, form_abandoned_at, converted_registration_id
  ) VALUES (
    p_event_id, p_visitor_id, p_session_id,
    NULLIF(left(p_data->>'referrer', 500), ''),
    NULLIF(left(p_data->>'landing_url', 500), ''),
    NULLIF(left(p_data->>'utm_source', 100), ''),
    NULLIF(left(p_data->>'utm_medium', 100), ''),
    NULLIF(left(p_data->>'utm_campaign', 100), ''),
    NULLIF(left(p_data->>'utm_term', 100), ''),
    NULLIF(left(p_data->>'utm_content', 100), ''),
    NULLIF(left(p_data->>'device_type', 30), ''),
    NULLIF(left(p_data->>'user_agent', 500), ''),
    NULLIF(lower(trim(left(p_data->>'partial_email', 255))), ''),
    NULLIF(left(p_data->>'partial_name', 200), ''),
    NULLIF(regexp_replace(COALESCE(p_data->>'partial_whatsapp', ''), '\D', '', 'g'), ''),
    CASE WHEN (p_data->>'form_started')::boolean THEN now() ELSE NULL END,
    CASE WHEN (p_data->>'form_abandoned')::boolean THEN now() ELSE NULL END,
    NULLIF(p_data->>'converted_registration_id', '')::uuid
  )
  ON CONFLICT (event_id, session_id) DO UPDATE SET
    updated_at = now(),
    referrer = COALESCE(event_page_views.referrer, EXCLUDED.referrer),
    landing_url = COALESCE(event_page_views.landing_url, EXCLUDED.landing_url),
    utm_source = COALESCE(event_page_views.utm_source, EXCLUDED.utm_source),
    utm_medium = COALESCE(event_page_views.utm_medium, EXCLUDED.utm_medium),
    utm_campaign = COALESCE(event_page_views.utm_campaign, EXCLUDED.utm_campaign),
    utm_term = COALESCE(event_page_views.utm_term, EXCLUDED.utm_term),
    utm_content = COALESCE(event_page_views.utm_content, EXCLUDED.utm_content),
    device_type = COALESCE(event_page_views.device_type, EXCLUDED.device_type),
    user_agent = COALESCE(event_page_views.user_agent, EXCLUDED.user_agent),
    partial_email = COALESCE(EXCLUDED.partial_email, event_page_views.partial_email),
    partial_name = COALESCE(EXCLUDED.partial_name, event_page_views.partial_name),
    partial_whatsapp = COALESCE(EXCLUDED.partial_whatsapp, event_page_views.partial_whatsapp),
    form_started_at = COALESCE(event_page_views.form_started_at, EXCLUDED.form_started_at),
    form_abandoned_at = COALESCE(EXCLUDED.form_abandoned_at, event_page_views.form_abandoned_at),
    converted_registration_id = COALESCE(EXCLUDED.converted_registration_id, event_page_views.converted_registration_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Permite que anônimos chamem a RPC
GRANT EXECUTE ON FUNCTION public.track_page_view(uuid, text, text, jsonb) TO anon, authenticated;