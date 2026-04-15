
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS location_type text,
  ADD COLUMN IF NOT EXISTS location_value text,
  ADD COLUMN IF NOT EXISTS ticket_price numeric,
  ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS capacity integer;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website text;
