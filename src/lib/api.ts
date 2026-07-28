import type {
  AppSettings,
  AuthStatus,
  ChatMessage,
  DigestRecord,
  DraftResult,
  EmailDetail,
  EmailSummary,
  ImapAccountInput,
  MailAccount,
  SyncResult,
} from '../../shared/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (res.status === 401 && !window.location.pathname.startsWith('/login')) {
    // Session is gone — purge cached API responses so nothing readable
    // outlives the login (defense in depth for shared/lost devices).
    if ('caches' in window) void caches.delete('api-cache').catch(() => {})
    window.location.assign('/login')
    throw new ApiError(401, 'Not signed in')
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

const qs = (params: Record<string, string | number | undefined>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.set(k, String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

/** "Continue with Google" — full-page navigation, not a fetch. */
export const LOGIN_URL = '/api/auth/login'

export const api = {
  authStatus: () => j<AuthStatus>('/api/auth/status'),

  logout: () => j<{ ok: true }>('/api/logout', { method: 'POST', body: '{}' }),

  chat: (messages: ChatMessage[], emailId?: string) =>
    j<{ reply: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, emailId }),
    }),

  accounts: () => j<MailAccount[]>('/api/accounts'),

  addImapAccount: (input: ImapAccountInput) =>
    j<MailAccount>('/api/accounts', { method: 'POST', body: JSON.stringify(input) }),

  deleteAccount: (id: string) =>
    j<{ ok: true }>(`/api/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  updateAccount: (id: string, patch: { label?: string; sendAs?: string }) =>
    j<MailAccount>(`/api/accounts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  emails: (params: { category?: string; account?: string; limit?: number; before?: string } = {}) =>
    j<EmailSummary[]>(`/api/emails${qs(params)}`),

  email: (id: string) => j<EmailDetail>(`/api/emails/${encodeURIComponent(id)}`),

  sync: (force = false) =>
    j<SyncResult>('/api/sync', { method: 'POST', body: JSON.stringify({ force }) }),

  draftReply: (id: string, instruction?: string) =>
    j<DraftResult>('/api/draft/reply', {
      method: 'POST',
      body: JSON.stringify({ id, instruction }),
    }),

  draftCompose: (instruction: string) =>
    j<DraftResult>('/api/draft/compose', { method: 'POST', body: JSON.stringify({ instruction }) }),

  send: (payload: {
    to: string
    cc?: string
    subject: string
    body: string
    replyToId?: string
    fromAccountId?: string
  }) => j<{ ok: true; id: string }>('/api/send', { method: 'POST', body: JSON.stringify(payload) }),

  digestToday: () => j<{ digest: DigestRecord | null }>('/api/digest/today'),

  digestRun: () => j<{ ok: boolean; sent: boolean }>('/api/digest/run', { method: 'POST', body: '{}' }),

  settings: () => j<AppSettings>('/api/settings'),

  saveSettings: (s: AppSettings) =>
    j<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(s) }),

  styleRefresh: (accountId: string) =>
    j<{ ok: true; sampleCount: number }>('/api/style/refresh', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),
}
