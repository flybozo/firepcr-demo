import { createClient } from '@/lib/supabase/client'

/**
 * Resolves a storage path or legacy public URL to a signed URL.
 * - If the value looks like a full URL (http/https), it's a legacy public URL — use as-is
 *   (these still work for public buckets; for private buckets they'll fail and need migration)
 * - If it's a relative path, create a signed URL for the given bucket.
 */
export async function resolveStorageUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!pathOrUrl) return null

  // Legacy full URL — already resolved
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    // Check if it's a Supabase storage URL for a now-private bucket
    // and re-sign it if needed
    const supabase = createClient()
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    if (pathOrUrl.includes(supabaseUrl) && pathOrUrl.includes(`/storage/v1/object/public/${bucket}/`)) {
      // Extract the path after the bucket name
      const bucketPrefix = `/storage/v1/object/public/${bucket}/`
      const idx = pathOrUrl.indexOf(bucketPrefix)
      if (idx >= 0) {
        const storagePath = decodeURIComponent(pathOrUrl.slice(idx + bucketPrefix.length))
        const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
        return data?.signedUrl || null
      }
    }
    return pathOrUrl
  }

  // Relative storage path — create signed URL
  const supabase = createClient()
  const { data } = await supabase.storage.from(bucket).createSignedUrl(pathOrUrl, expiresIn)
  return data?.signedUrl || null
}
