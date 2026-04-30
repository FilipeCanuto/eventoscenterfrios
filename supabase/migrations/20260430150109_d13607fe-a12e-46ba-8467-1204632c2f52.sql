-- Remove o lembrete de "7 dias antes" do produto.
-- 1) Cancela todos os reminder_7d ainda pendentes (preserva histórico).
-- 2) Atualiza schedule_event_reminders para parar de enfileirar reminder_7d.
-- 3) Atualiza reschedule_event_reminders removendo o ramo de 7 dias.

UPDATE public.scheduled_emails
   SET status = 'cancelled', error = 'reminder_7d_disabled', updated_at = now()
 WHERE email_type = 'reminder_7d' AND status = 'pending';

CREATE OR REPLACE FUNCTION public.schedule_event_reminders(p_registration_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_event_date timestamptz;
BEGIN
  SELECT r.event_id, e.event_date
    INTO v_event_id, v_event_date
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  WHERE r.id = p_registration_id;

  IF v_event_id IS NULL OR v_event_date IS NULL THEN
    RETURN;
  END IF;

  -- 1 day before
  IF v_event_date - interval '1 day' > now() THEN
    INSERT INTO scheduled_emails (registration_id, event_id, email_type, send_at)
    VALUES (p_registration_id, v_event_id, 'reminder_1d', v_event_date - interval '1 day')
    ON CONFLICT (registration_id, email_type) DO UPDATE
      SET send_at = EXCLUDED.send_at,
          status = CASE WHEN scheduled_emails.status = 'sent' THEN 'sent' ELSE 'pending' END;
  END IF;

  -- 2 hours before
  IF v_event_date - interval '2 hours' > now() THEN
    INSERT INTO scheduled_emails (registration_id, event_id, email_type, send_at)
    VALUES (p_registration_id, v_event_id, 'reminder_2h', v_event_date - interval '2 hours')
    ON CONFLICT (registration_id, email_type) DO UPDATE
      SET send_at = EXCLUDED.send_at,
          status = CASE WHEN scheduled_emails.status = 'sent' THEN 'sent' ELSE 'pending' END;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_event_reminders(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_date timestamptz;
BEGIN
  SELECT event_date INTO v_event_date FROM events WHERE id = p_event_id;
  IF v_event_date IS NULL THEN RETURN; END IF;

  -- Cancela qualquer reminder_7d remanescente para este evento
  UPDATE scheduled_emails
     SET status = 'cancelled', error = 'reminder_7d_disabled', updated_at = now()
   WHERE event_id = p_event_id
     AND email_type = 'reminder_7d'
     AND status = 'pending';

  UPDATE scheduled_emails
  SET send_at = CASE email_type
                  WHEN 'reminder_1d' THEN v_event_date - interval '1 day'
                  WHEN 'reminder_2h' THEN v_event_date - interval '2 hours'
                END,
      status = CASE
                 WHEN status = 'sent' THEN 'sent'
                 WHEN (CASE email_type
                         WHEN 'reminder_1d' THEN v_event_date - interval '1 day'
                         WHEN 'reminder_2h' THEN v_event_date - interval '2 hours'
                       END) <= now() THEN 'cancelled'
                 ELSE 'pending'
               END
  WHERE event_id = p_event_id
    AND email_type IN ('reminder_1d', 'reminder_2h');
END;
$function$;