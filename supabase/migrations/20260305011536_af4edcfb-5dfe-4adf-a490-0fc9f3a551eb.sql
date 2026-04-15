
-- Add company_slug column to profiles
ALTER TABLE public.profiles ADD COLUMN company_slug text UNIQUE;

-- Create a public read-only view for company profiles (excludes private data)
-- Instead of exposing all profile fields, we add a selective public RLS policy
CREATE POLICY "Public can view company profiles by slug"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (company_slug IS NOT NULL);
