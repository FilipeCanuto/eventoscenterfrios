-- Drop the two broken restrictive INSERT policies
DROP POLICY IF EXISTS "Anonymous can register for live events" ON public.registrations;
DROP POLICY IF EXISTS "Anyone can register for live events" ON public.registrations;

-- Create a single PERMISSIVE INSERT policy for anon and authenticated
CREATE POLICY "Allow registration for live events"
ON public.registrations
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = registrations.event_id
    AND events.status = 'live'::event_status
  )
);