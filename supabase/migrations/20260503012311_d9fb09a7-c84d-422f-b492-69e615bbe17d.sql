-- 1) Backfill: agendar lembretes para todas as inscrições ativas que ainda não têm reminder_1d
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT reg.id
    FROM registrations reg
    JOIN events e ON e.id = reg.event_id
    WHERE reg.status <> 'cancelled'::registration_status
      AND e.event_date IS NOT NULL
      AND e.event_date > now()
      AND NOT EXISTS (
        SELECT 1 FROM scheduled_emails s
        WHERE s.registration_id = reg.id AND s.email_type = 'reminder_1d'
      )
  LOOP
    PERFORM public.schedule_event_reminders(r.id);
  END LOOP;
END $$;

-- 2) Trigger AFTER INSERT em registrations para agendar lembretes automaticamente
CREATE OR REPLACE FUNCTION public.trg_registrations_schedule_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    PERFORM public.schedule_event_reminders(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- nunca bloqueia inscrição
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_schedule_reminders ON public.registrations;
CREATE TRIGGER registrations_schedule_reminders
AFTER INSERT ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.trg_registrations_schedule_reminders();

-- 3) Cancelar reminder_7d pendentes (resíduo de configuração antiga)
UPDATE scheduled_emails
   SET status = 'cancelled', error = COALESCE(error,'') || ' reminder_7d_disabled', updated_at = now()
 WHERE email_type = 'reminder_7d' AND status = 'pending';

-- 4) Índice para acelerar consultas de auditoria de e-mails
CREATE INDEX IF NOT EXISTS idx_email_send_log_reg_type_status
  ON public.email_send_log (registration_id, email_type, status);