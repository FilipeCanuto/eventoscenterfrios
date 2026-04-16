DO $$
DECLARE
  v_event_id uuid;
BEGIN
  FOR v_event_id IN SELECT id FROM public.events LOOP
    IF EXISTS (SELECT 1 FROM public.form_fields WHERE event_id = v_event_id AND lower(label) LIKE '%whatsapp%') THEN
      UPDATE public.form_fields
      SET required = true, field_type = 'tel'
      WHERE event_id = v_event_id AND lower(label) LIKE '%whatsapp%';
    ELSE
      INSERT INTO public.form_fields (event_id, label, field_type, required, position)
      VALUES (
        v_event_id,
        'WhatsApp',
        'tel',
        true,
        COALESCE((SELECT max(position) + 1 FROM public.form_fields WHERE event_id = v_event_id), 2)
      );
    END IF;
  END LOOP;
END $$;