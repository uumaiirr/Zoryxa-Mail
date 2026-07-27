import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { env } from './env'

function keyBytes(): Buffer {
  const buf = Buffer.from(env('TOKEN_ENCRYPTION_KEY'), 'hex')
  if (buf.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
  }
  return buf
}

/** AES-256-GCM. Output format: base64(iv).base64(tag).base64(ciphertext) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}

export function decrypt(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 3) throw new Error('Malformed encrypted payload')
  const [iv, tag, enc] = parts.map((p) => Buffer.from(p, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

export function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
