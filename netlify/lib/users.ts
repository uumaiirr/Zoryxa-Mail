import { optionalEnv } from './env'
import { HttpError } from './http'
import { db } from './supabase'

export interface User {
  id: string
  email: string
  name: string
  picture: string
}

function check<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`Database error (${what}): ${r.error.message}`)
  return r.data as T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(r: any): User {
  return { id: r.id, email: r.email, name: r.name, picture: r.picture }
}

/**
 * Optional allow-list: ALLOWED_LOGIN_EMAILS="a@x.com, b@y.com". When set, only
 * these people can sign in — recommended for a private company deployment so
 * strangers can never create workspaces (or burn the AI quota).
 */
export function loginAllowed(email: string): boolean {
  const raw = optionalEnv('ALLOWED_LOGIN_EMAILS')
  if (!raw) return true
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase())
}

export async function upsertUserByEmail(email: string, name: string, picture: string): Promise<User> {
  const existing = await db().from('users').select('*').eq('email', email).maybeSingle()
  const row = check(existing, 'upsertUser.find')
  if (row) {
    const res = await db()
      .from('users')
      .update({ name: name || row.name, picture: picture || row.picture })
      .eq('id', row.id)
      .select('*')
      .single()
    return rowToUser(check(res, 'upsertUser.update'))
  }
  const res = await db().from('users').insert({ email, name, picture }).select('*').single()
  return rowToUser(check(res, 'upsertUser.insert'))
}

export async function getUser(id: string): Promise<User> {
  const res = await db().from('users').select('*').eq('id', id).maybeSingle()
  const row = check(res, 'getUser')
  if (!row) throw new HttpError(401, 'Not signed in')
  return rowToUser(row)
}

export async function listUsers(): Promise<User[]> {
  const res = await db().from('users').select('*').order('created_at', { ascending: true })
  return check(res, 'listUsers').map(rowToUser)
}
