
DROP POLICY IF EXISTS "Users can update own event assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event assets" ON storage.objects;

CREATE POLICY "Users can update own event assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-assets' AND (owner)::uuid = auth.uid());

CREATE POLICY "Users can delete own event assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-assets' AND (owner)::uuid = auth.uid());
