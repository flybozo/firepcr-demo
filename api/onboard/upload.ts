/**
 * POST /api/onboard/upload
 * Public endpoint — validated by short-lived HMAC upload token.
 * Accepts base64-encoded files and uploads to Supabase storage.
 *
 * Body:
 *   employeeId   string  — employee UUID
 *   token        string  — upload token from /api/onboard
 *   type         string  — 'headshot' | 'credential'
 *   fileName     string  — original filename
 *   fileBase64   string  — base64 data URL or plain base64
 *   certType?    string  — required when type='credential'
 *   expiry?      string  — ISO date, optional
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUploadToken } from '../onboard.js'
import { createServiceClient } from '../_supabase.js'
import { rateLimit } from '../_rateLimit.js'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Light rate limit (100/hr per IP) — heavier limit is on /api/onboard
  const ip = (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
  const rl = rateLimit(`onboard-upload:${ip}`, 100, 60 * 60 * 1000)
  if (!rl.ok) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  try {
    const body = req.body as Record<string, unknown>

    const { employeeId, token, type, fileName, fileBase64, certType, expiry } = body as {
      employeeId?: string
      token?: string
      type?: string
      fileName?: string
      fileBase64?: string
      certType?: string
      expiry?: string
    }

    if (!employeeId || !token || !type || !fileName || !fileBase64) {
      return res.status(400).json({ error: 'Missing required fields: employeeId, token, type, fileName, fileBase64' })
    }

    if (!['headshot', 'credential'].includes(type)) {
      return res.status(400).json({ error: 'type must be headshot or credential' })
    }

    if (type === 'credential' && !certType) {
      return res.status(400).json({ error: 'certType is required for credential uploads' })
    }

    // Validate token
    if (!verifyUploadToken(token, employeeId)) {
      return res.status(401).json({ error: 'Invalid or expired upload token' })
    }

    // Decode base64
    const base64Data = fileBase64.includes(',')
      ? fileBase64.split(',')[1]
      : fileBase64

    const fileBuffer = Buffer.from(base64Data, 'base64')

    if (fileBuffer.byteLength > MAX_FILE_BYTES) {
      return res.status(413).json({ error: 'File exceeds 10 MB limit' })
    }

    // Determine content type from filename or data URL header
    let contentType = 'application/octet-stream'
    if (fileBase64.startsWith('data:')) {
      const match = fileBase64.match(/^data:([^;]+);/)
      if (match) contentType = match[1]
    } else {
      const ext = fileName.split('.').pop()?.toLowerCase()
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        webp: 'image/webp', pdf: 'application/pdf', heic: 'image/heic',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      if (ext && mimeMap[ext]) contentType = mimeMap[ext]
    }

    const supabase = createServiceClient()

    // Verify employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .single()

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    if (type === 'headshot') {
      // Upload to headshots bucket
      const ext = fileName.split('.').pop() || 'jpg'
      const storagePath = `${employeeId}/headshot.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('headshots')
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: true,
        })

      if (uploadError) {
        console.error('[OnboardUpload] Headshot upload failed:', uploadError)
        return res.status(500).json({ error: 'Failed to upload headshot' })
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('headshots')
        .getPublicUrl(storagePath)

      const headshotUrl = urlData?.publicUrl || null

      // Update employee record
      await supabase
        .from('employees')
        .update({ headshot_url: headshotUrl })
        .eq('id', employeeId)

      return res.status(200).json({ success: true, url: headshotUrl })
    }

    // type === 'credential'
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${employeeId}/${Date.now()}_${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('credentials')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      console.error('[OnboardUpload] Credential upload failed:', uploadError)
      return res.status(500).json({ error: 'Failed to upload credential file' })
    }

    // Insert employee_credentials record
    const { data: cred, error: credError } = await supabase
      .from('employee_credentials')
      .insert({
        employee_id: employeeId,
        cert_type: certType,
        expiration_date: expiry || null,
        file_url: storagePath,
        file_name: fileName,
      })
      .select('id')
      .single()

    if (credError) {
      console.error('[OnboardUpload] Credential record insert failed:', credError)
      // Don't fail the request — file is uploaded, just metadata insert failed
      return res.status(207).json({
        success: true,
        warning: 'File uploaded but credential record creation failed',
        storagePath,
      })
    }

    return res.status(200).json({ success: true, credentialId: cred?.id, storagePath })
  } catch (err: any) {
    console.error('[OnboardUpload] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
