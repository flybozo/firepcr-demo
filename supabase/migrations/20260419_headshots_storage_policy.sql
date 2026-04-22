-- Allow authenticated users to upload/update/delete in the headshots bucket.
-- The bucket is public (read), but writes require auth.
-- This fixes "row level security policy" errors on re-upload (upsert).

-- Insert policy (new uploads)
CREATE POLICY "Authenticated users can upload headshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'headshots');

-- Update policy (upsert / re-upload)
CREATE POLICY "Authenticated users can update headshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'headshots')
WITH CHECK (bucket_id = 'headshots');

-- Delete policy (optional, for cleanup)
CREATE POLICY "Authenticated users can delete headshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'headshots');

-- Select policy (public read)
CREATE POLICY "Public can read headshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'headshots');
