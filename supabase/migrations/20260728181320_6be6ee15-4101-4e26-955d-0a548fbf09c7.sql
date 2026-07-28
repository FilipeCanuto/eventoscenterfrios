CREATE OR REPLACE FUNCTION public.public_vendedor_stats(p_vendedor text, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_vendedor text;
  v_total int;
  v_hoje int;
  v_checkins int;
  v_lista jsonb;
  v_ranking jsonb;
  v_privileged boolean := false;
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

  -- Only authenticated event owners / admins may see unmasked registrant names
  v_privileged := auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = v_event_id AND e.user_id = auth.uid())
  );

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
             'nome', CASE
                       WHEN v_privileged THEN r.lead_name
                       WHEN r.lead_name IS NULL THEN NULL
                       ELSE split_part(trim(r.lead_name), ' ', 1) || ' ' ||
                            repeat('•', least(6, greatest(1, length(trim(r.lead_name)) - length(split_part(trim(r.lead_name), ' ', 1)))))
                     END,
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
    'masked', NOT v_privileged,
    'total', v_total,
    'hoje', v_hoje,
    'checkins', v_checkins,
    'cadastros', v_lista,
    'ranking', v_ranking
  );
END;
$function$;