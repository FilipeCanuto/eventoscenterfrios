ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_description text,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '[]'::jsonb;