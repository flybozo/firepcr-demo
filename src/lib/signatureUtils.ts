import type { RefObject } from 'react'
import type SignatureCanvas from 'react-signature-canvas'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function uploadSignatureDataUrl(
  supabase: SupabaseClient,
  dataUrl: string,
  storagePath: string,
  options: { upsert?: boolean } = {}
): Promise<string | null> {
  const blob = await (await fetch(dataUrl)).blob()
  const { error } = await supabase.storage
    .from('signatures')
    .upload(storagePath, blob, { contentType: 'image/png', upsert: options.upsert ?? false })
  if (error) { console.error('Signature upload error:', error); return null }
  return storagePath
}

export async function uploadSignatureFromRef(
  supabase: SupabaseClient,
  sigRef: RefObject<SignatureCanvas | null>,
  storagePath: string,
  options: { upsert?: boolean } = {}
): Promise<{ url: string | null; dataUrl: string | null }> {
  if (!sigRef.current || sigRef.current.isEmpty()) return { url: null, dataUrl: null }
  const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
  const url = await uploadSignatureDataUrl(supabase, dataUrl, storagePath, options)
  return { url, dataUrl }
}
