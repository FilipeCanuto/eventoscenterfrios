CREATE OR REPLACE FUNCTION public.public_vendedor_stats(p_vendedor text, p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_vendedor text;
  v_total int;
  v_hoje int;
  v_checkins int;
  v_lista jsonb;
  v_ranking jsonb;
BEGIN
  v_vendedor := trim(coalesce(p_vendedor, ''));
  IF v_vendedor = '' OR length(v_vendedor) > 100 THEN
    RETURN jsonb_build_object('error', 'invalid_vendedor');
  END IF;

  SELECT e.id INTO v_event_id
  FROM events e
  WHERE e.status = 'live'::event_status
    AND (p_event_id IS NULL OR e.id = p_event_id)
  ORDER BY e.event_date DESC NULLS LAST
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_live_event');
  END IF;

  SELECT
    count(*)::int,
    count(*) FILTER (WHERE (r.created_at AT TIME ZONE 'America/Maceio')::date
                           = (now() AT TIME ZONE 'America/Maceio')::date)::int,
    count(*) FILTER (WHERE r.status = 'checked_in'::registration_status)::int
  INTO v_total, v_hoje, v_checkins
  FROM registrations r
  WHERE r.event_id = v_event_id
    AND r.status <> 'cancelled'::registration_status
    AND lower(trim(coalesce(r.tracking->>'vendedor',''))) = lower(v_vendedor);

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb)
  INTO v_lista
  FROM (
    SELECT jsonb_build_object(
             'id', r.id,
             'nome', r.lead_name,
             'segmento', coalesce(r.data->>'Segmento', r.data->>'Segmento de Atuação'),
             'created_at', r.created_at,
             'status', r.status::text
           ) AS x
    FROM registrations r
    WHERE r.event_id = v_event_id
      AND r.status <> 'cancelled'::registration_status
      AND lower(trim(coalesce(r.tracking->>'vendedor',''))) = lower(v_vendedor)
    ORDER BY r.created_at DESC
    LIMIT 200
  ) s;

  SELECT coalesce(jsonb_agg(jsonb_build_object('vendedor', vendedor, 'total', total)
                            ORDER BY total DESC, vendedor), '[]'::jsonb)
  INTO v_ranking
  FROM (
    SELECT trim(r.tracking->>'vendedor') AS vendedor, count(*)::int AS total
    FROM registrations r
    WHERE r.event_id = v_event_id
      AND r.status <> 'cancelled'::registration_status
      AND coalesce(trim(r.tracking->>'vendedor'), '') <> ''
    GROUP BY 1
  ) g;

  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'total', v_total,
    'hoje', v_hoje,
    'checkins', v_checkins,
    'cadastros', v_lista,
    'ranking', v_ranking
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_vendedor_stats(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_vendedor_stats(text, uuid) TO anon, authenticated;