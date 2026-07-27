export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status)
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

type Handler = (req: Request, context: { params: Record<string, string> }) => Promise<Response>

/** Wraps a Netlify v2 function handler with uniform error handling. */
export function handle(fn: Handler): Handler {
  return async (req, context) => {
    try {
      return await fn(req, context)
    } catch (e) {
      if (e instanceof HttpError) return errorResponse(e.message, e.status)
      console.error(e)
      return errorResponse(e instanceof Error ? e.message : 'Internal error', 500)
    }
  }
}
