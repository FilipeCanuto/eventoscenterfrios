
-- Allow public to count registrations for live events (needed for attendee counts on public company page)
CREATE POLICY "Public can view registration counts for live events"
  ON public.registrations
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM events WHERE events.id = registrations.event_id AND events.status = 'live'::event_status
  ));
