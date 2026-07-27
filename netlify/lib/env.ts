export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return v
}

/** Returns undefined for unset OR empty-string vars (Netlify UI often saves ''). */
export function optionalEnv(name: string): string | undefined {
  const v = process.env[name]
  return v === undefined || v === '' ? undefined : v
}

/**
 * Like env(), but also rejects empty strings. Use for every secret that gates
 * authentication — an empty secret must fail closed, never compare equal.
 */
export function secretEnv(name: string): string {
  const v = process.env[name]
  if (v === undefined || v === '') {
    throw new Error(`Missing required secret: ${name} must be set to a non-empty value`)
  }
  return v
}
