
-- Indexes to speed up email center queries
CREATE INDEX IF NOT EXISTS idx_email_send_log_registration ON public.email_send_log(registration_id, email_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_registration ON public.scheduled_emails(registration_id, email_type);

-- Event owners need to read these tables from the dashboard
CREATE POLICY "Event owners can view email logs for their events"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  registration_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.id = email_send_log.registration_id AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Event owners can view email send state"
ON public.email_send_state
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Event owners can view suppressed emails for their leads"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE lower(r.lead_email) = lower(suppressed_emails.email)
      AND e.user_id = auth.uid()
  )
);
