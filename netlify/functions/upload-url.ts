import type { Config } from '@netlify/functions'
import { handle, HttpError, json, readJson } from '../lib/http'
import { requireSession } from '../lib/session'
import { db } from '../lib/supabase'

const BUCKET = 'ai-uploads'
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 // Supabase free-tier per-file cap

let bucketReady = false
async function ensureBucket(): Promise<void> {
  if (bucketReady) return
  const { data } = await db().storage.getBucket(BUCKET)
  if (!data) {
    const { error } = await db().storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_UPLOAD_BYTES,
    })
    if (error && !/already exists/i.test(error.message)) {
      throw new HttpError(502, `Storage unavailable: ${error.message}`)
    }
  }
  bucketReady = true
}

/**
 * Large AI attachments (up to 50 MB) go browser → private storage directly,
 * bypassing the function payload limit; /api/chat then reads and deletes them.
 */
export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const body = await readJson<{ name?: string; mimeType?: string; size?: number }>(req)
  const mt = String(body.mimeType ?? '')
  if (!/^image\//.test(mt) && mt !== 'application/pdf') {
    throw new HttpError(400, 'Only images and PDF files can be attached')
  }
  const size = Number(body.size ?? 0)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, 'Attachments must be under 50 MB')
  }

  await ensureBucket()
  const safeName = String(body.name ?? 'file').replace(/[^\w.-]+/g, '_').slice(0, 80)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    throw new HttpError(502, `Could not prepare the upload: ${error?.message ?? 'unknown'}`)
  }
  return json({ path, signedUrl: data.signedUrl, token: data.token })
})

export const config: Config = { path: '/api/upload-url' }
