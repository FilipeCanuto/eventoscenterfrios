
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  name text,
  phone text,
  source text DEFAULT 'public_events_page',
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can submit a lead
CREATE POLICY "Anyone can create a lead"
  ON public.leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) <= 255
    AND length(coalesce(name, '')) <= 200
    AND length(coalesce(phone, '')) <= 50
    AND octet_length(coalesce(metadata::text, '{}')) <= 2048
  );

-- Only admins can view leads
CREATE POLICY "Admins can view all leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Event owners can view leads tied to their events
CREATE POLICY "Event owners can view their event leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    event_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = leads.event_id AND events.user_id = auth.uid()
    )
  );
