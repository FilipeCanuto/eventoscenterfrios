-- 1) Add checked_in_at to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz NULL;

-- 2) scheduled_emails table
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email_type text NOT NULL CHECK (email_type IN ('reminder_7d','reminder_1d','reminder_2h')),
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  sent_at timestamptz NULL,
  error text NULL,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status_send_at
  ON public.scheduled_emails(status, send_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_registration
  ON public.scheduled_emails(registration_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_event
  ON public.scheduled_emails(event_id);

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event owners can view scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Event owners can view scheduled emails"
  ON public.scheduled_emails FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = scheduled_emails.event_id AND e.user_id = auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_scheduled_emails_updated_at ON public.scheduled_emails;
CREATE TRIGGER trg_scheduled_emails_updated_at
  BEFORE UPDATE ON public.scheduled_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) schedule_event_reminders(registration_id)
CREATE OR REPLACE FUNCTION public.schedule_event_reminders(p_registration_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- 7 days before
  IF v_event_date - interval '7 days' > now() THEN
    INSERT INTO scheduled_emails (registration_id, event_id, email_type, send_at)
    VALUES (p_registration_id, v_event_id, 'reminder_7d', v_event_date - interval '7 days')
    ON CONFLICT (registration_id, email_type) DO UPDATE
      SET send_at = EXCLUDED.send_at,
          status = CASE WHEN scheduled_emails.status = 'sent' THEN 'sent' ELSE 'pending' END;
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
$$;

-- 4) reschedule_event_reminders(event_id) — used when event_date changes
CREATE OR REPLACE FUNCTION public.reschedule_event_reminders(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_date timestamptz;
BEGIN
  SELECT event_date INTO v_event_date FROM events WHERE id = p_event_id;
  IF v_event_date IS NULL THEN RETURN; END IF;

  UPDATE scheduled_emails
  SET send_at = CASE email_type
                  WHEN 'reminder_7d' THEN v_event_date - interval '7 days'
                  WHEN 'reminder_1d' THEN v_event_date - interval '1 day'
                  WHEN 'reminder_2h' THEN v_event_date - interval '2 hours'
                END,
      status = CASE
                 WHEN status = 'sent' THEN 'sent'
                 WHEN (CASE email_type
                         WHEN 'reminder_7d' THEN v_event_date - interval '7 days'
                         WHEN 'reminder_1d' THEN v_event_date - interval '1 day'
                         WHEN 'reminder_2h' THEN v_event_date - interval '2 hours'
                       END) <= now() THEN 'cancelled'
                 ELSE 'pending'
               END
  WHERE event_id = p_event_id;
END;
$$;

-- 5) Trigger: when event_date changes, reschedule
CREATE OR REPLACE FUNCTION public.trg_events_reschedule_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_date IS DISTINCT FROM OLD.event_date THEN
    PERFORM public.reschedule_event_reminders(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_reschedule_reminders ON public.events;
CREATE TRIGGER events_reschedule_reminders
  AFTER UPDATE OF event_date ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.trg_events_reschedule_reminders();

-- 6) Trigger: cancel pending reminders when registration is cancelled
CREATE OR REPLACE FUNCTION public.trg_registrations_cancel_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled'::registration_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE scheduled_emails
       SET status = 'cancelled'
     WHERE registration_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_cancel_reminders ON public.registrations;
CREATE TRIGGER registrations_cancel_reminders
  AFTER UPDATE OF status ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.trg_registrations_cancel_reminders();

-- 7) Public unsubscribe by token (for reminder e-mail link)
CREATE OR REPLACE FUNCTION public.unsubscribe_reminders(p_token uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg uuid;
BEGIN
  SELECT registration_id INTO v_reg
  FROM scheduled_emails
  WHERE unsubscribe_token = p_token
  LIMIT 1;

  IF v_reg IS NULL THEN
    RETURN 'not_found';
  END IF;

  UPDATE scheduled_emails
     SET status = 'cancelled'
   WHERE registration_id = v_reg AND status = 'pending';

  RETURN 'ok';
END;
$$;

-- 8) Update public_check_in: validate window + record checked_in_at + return outside_window
CREATE OR REPLACE FUNCTION public.public_check_in(p_registration_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status registration_status;
  v_event_id uuid;
  v_event_date timestamptz;
  v_event_end timestamptz;
  v_window_start timestamptz;
  v_window_end timestamptz;
BEGIN
  IF p_registration_id IS NULL THEN
    RETURN 'not_found';
  END IF;

  SELECT r.status, r.event_id, e.event_date, e.event_end_date
    INTO v_status, v_event_id, v_event_date, v_event_end
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  WHERE r.id = p_registration_id;

  IF v_status IS NULL THEN
    RETURN 'not_found';
  END IF;

  IF v_status = 'cancelled'::registration_status THEN
    RETURN 'cancelled';
  END IF;

  IF v_status = 'checked_in'::registration_status THEN
    RETURN 'already_checked_in';
  END IF;

  -- Validate window only if event has a date
  IF v_event_date IS NOT NULL THEN
    v_window_start := v_event_date - interval '4 hours';
    v_window_end := COALESCE(v_event_end, v_event_date) + interval '4 hours';
    IF now() < v_window_start OR now() > v_window_end THEN
      RETURN 'outside_window';
    END IF;
  END IF;

  UPDATE registrations
     SET status = 'checked_in'::registration_status,
         checked_in_at = now()
   WHERE id = p_registration_id
     AND status = 'registered'::registration_status;

  RETURN 'success';
END;
$$;

-- 9) Public RPC to read window info for "outside_window" message
CREATE OR REPLACE FUNCTION public.get_check_in_window(p_registration_id uuid)
RETURNS TABLE (event_date timestamptz, event_end_date timestamptz, window_start timestamptz, window_end timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.event_date,
         e.event_end_date,
         e.event_date - interval '4 hours' AS window_start,
         COALESCE(e.event_end_date, e.event_date) + interval '4 hours' AS window_end
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  WHERE r.id = p_registration_id;
$$;
