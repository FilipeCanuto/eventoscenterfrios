-- Fix EXPOSED_SENSITIVE_DATA: remove the over-broad public SELECT policy on profiles.
-- Anonymous public access continues to work through the public_company_profiles view
-- (owned by postgres, bypassing RLS) which already exposes only the curated columns.
DROP POLICY IF EXISTS "Public can view company profiles by slug" ON public.profiles;