DROP POLICY IF EXISTS "Event owners can view email send state" ON public.email_send_state;

CREATE POLICY "Event owners can view email send state"
ON public.email_send_state
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.user_id = auth.uid()));