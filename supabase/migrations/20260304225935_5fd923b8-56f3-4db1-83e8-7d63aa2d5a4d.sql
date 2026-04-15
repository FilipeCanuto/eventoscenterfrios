-- Allow anonymous users to register for live events
CREATE POLICY "Anonymous can register for live events"
ON public.registrations
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = registrations.event_id
    AND events.status = 'live'::event_status
  )
);