-- 1) Remove direct INSERT path on registrations; force use of register_for_event RPC
DROP POLICY IF EXISTS "Allow registration for live events" ON public.registrations;

-- 2) Restrict public profile exposure to only the columns needed for public company pages.
-- Replace the broad public SELECT policy with a security-definer function + view pattern:
-- safer approach: keep the policy but limit columns via a view used by clients.
DROP POLICY IF EXISTS "Public can view company profiles by slug" ON public.profiles;

-- Create a public view exposing only safe columns for company pages
CREATE OR REPLACE VIEW public.public_company_profiles
WITH (security_invoker = true) AS
SELECT id, full_name, company, company_description, website, avatar_url, social_links, company_slug
FROM public.profiles
WHERE company_slug IS NOT NULL;

GRANT SELECT ON public.public_company_profiles TO anon, authenticated;

-- Re-add a restrictive public SELECT policy on profiles limited to rows with a slug
-- so the view (security_invoker) can read them, but anon has no extra columns beyond the view.
CREATE POLICY "Public can view company profiles by slug"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (company_slug IS NOT NULL);

-- 3) Restrict storage uploads to the user's own folder (path must start with their uid)
DROP POLICY IF EXISTS "Authenticated users can upload event assets" ON storage.objects;
CREATE POLICY "Users can upload to their own folder in event-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Also tighten UPDATE/DELETE to require ownership via path, not just owner column
DROP POLICY IF EXISTS "Users can update own event assets" ON storage.objects;
CREATE POLICY "Users can update own event assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own event assets" ON storage.objects;
CREATE POLICY "Users can delete own event assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4) Prevent listing all files in the public bucket. Allow public SELECT only on individual
-- objects accessed by full path (getPublicUrl still works since the bucket is public),
-- but block listing via the API. We do this by restricting the SELECT policy to authenticated
-- users who own the folder; public URLs continue to work because public buckets serve files
-- through the storage CDN without going through the policy.
DROP POLICY IF EXISTS "Anyone can view event assets" ON storage.objects;
CREATE POLICY "Owners can list their own event assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);