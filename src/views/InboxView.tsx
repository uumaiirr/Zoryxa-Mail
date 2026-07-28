import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, EmailSummary, MailAccount } from '../../shared/types'
import { api, ApiError } from '../lib/api'
import CategoryChips from '../components/CategoryChips'
import EmailCard from '../components/EmailCard'
import EmptyState from '../components/EmptyState'
import TopBar from '../components/TopBar'

const MAX_SYNC_LOOPS = 5

function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong. Please try again.'
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="animate-pulse space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="h-4 w-1/3 bg-line rounded" />
              <div className="h-3 w-12 bg-line rounded" />
            </div>
            <div className="h-4 w-3/4 bg-line rounded" />
            <div className="h-3 w-full bg-line rounded" />
            <div className="h-3 w-2/3 bg-line rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function InboxView() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [emails, setEmails] = useState<EmailSummary[] | null>(null)
  const [allEmails, setAllEmails] = useState<EmailSummary[]>([])
  const [accountsList, setAccountsList] = useState<MailAccount[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeAccount, setActiveAccount] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeCategoryRef = useRef<string | null>(null)
  const activeAccountRef = useRef<string | null>(null)
  const cancelledRef = useRef(false)

  // Refetch the full list (for counts) and the visible list for the active
  // category/account. limit 100 matches the server backfill cap so chip counts
  // stay truthful. If the user switches filters while a fetch is in flight,
  // the stale response is dropped instead of overwriting the newer list.
  const refetchEmails = useCallback(async () => {
    const cat = activeCategoryRef.current
    const acc = activeAccountRef.current
    const stale = () =>
      cancelledRef.current || activeCategoryRef.current !== cat || activeAccountRef.current !== acc
    if (cat) {
      const [full, filtered] = await Promise.all([
        api.emails({ account: acc ?? undefined, limit: 100 }),
        api.emails({ category: cat, account: acc ?? undefined, limit: 100 }),
      ])
      if (stale()) return
      setAllEmails(full)
      setEmails(filtered)
    } else {
      const full = await api.emails({ account: acc ?? undefined, limit: 100 })
      if (stale()) return
      setAllEmails(full)
      setEmails(full)
    }
  }, [])

  const runSyncLoop = useCallback(
    async (force: boolean) => {
      setSyncing(true)
      try {
        let loops = 0
        let refetched = false
        let result = await api.sync(force)
        while (!cancelledRef.current) {
          if (result.newEmails > 0 || result.summarized > 0) {
            await refetchEmails()
            refetched = true
          }
          if (result.pending > 0 && loops < MAX_SYNC_LOOPS) {
            loops += 1
            result = await api.sync()
          } else {
            break
          }
        }
        if (force && !refetched && !cancelledRef.current) {
          await refetchEmails()
        }
      } catch (e) {
        if (!cancelledRef.current) setError(messageOf(e))
      } finally {
        if (!cancelledRef.current) setSyncing(false)
      }
    },
    [refetchEmails],
  )

  useEffect(() => {
    cancelledRef.current = false
    void (async () => {
      try {
        const [s, list, accs] = await Promise.all([
          api.settings(),
          api.emails({ limit: 100 }),
          api.accounts().catch(() => [] as MailAccount[]),
        ])
        if (cancelledRef.current) return
        setSettings(s)
        setAllEmails(list)
        setEmails(list)
        setAccountsList(accs)
      } catch (e) {
        if (!cancelledRef.current) {
          setError(messageOf(e))
          setEmails([])
        }
        return
      }
      await runSyncLoop(false)
    })()
    return () => {
      cancelledRef.current = true
    }
  }, [runSyncLoop])

  // Live inbox: refetch quietly every 45s while visible, and immediately when
  // the app returns to the foreground (push notifications land server-side, so
  // a light refetch is all the client needs to feel real-time).
  useEffect(() => {
    const quiet = () => {
      if (document.hidden || cancelledRef.current) return
      void refetchEmails().catch(() => {})
    }
    const onVisible = () => {
      if (!document.hidden) quiet()
    }
    const interval = window.setInterval(quiet, 45_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refetchEmails])

  const handleCategoryChange = useCallback((key: string | null) => {
    setActiveCategory(key)
    activeCategoryRef.current = key
    setError(null)
    setEmails(null)
    const acc = activeAccountRef.current
    api
      .emails({ category: key ?? undefined, account: acc ?? undefined, limit: 100 })
      .then((list) => {
        if (cancelledRef.current || activeCategoryRef.current !== key) return
        setEmails(list)
        if (key === null) setAllEmails(list)
      })
      .catch((e) => {
        if (cancelledRef.current || activeCategoryRef.current !== key) return
        setError(messageOf(e))
        setEmails([])
      })
  }, [])

  const handleAccountChange = useCallback(
    (id: string | null) => {
      setActiveAccount(id)
      activeAccountRef.current = id
      setError(null)
      setEmails(null)
      void refetchEmails().catch((e) => {
        if (cancelledRef.current || activeAccountRef.current !== id) return
        setError(messageOf(e))
        setEmails([])
      })
    },
    [refetchEmails],
  )

  const handleRefresh = useCallback(() => {
    if (syncing) return
    setError(null)
    void runSyncLoop(true)
  }, [syncing, runSyncLoop])

  const counts: Record<string, number> = {}
  for (const e of allEmails) {
    counts[e.category] = (counts[e.category] ?? 0) + 1
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div>
      <TopBar
        title="Inbox"
        subtitle={today}
        right={
          <button
            type="button"
            aria-label="Check for new mail"
            onClick={handleRefresh}
            disabled={syncing}
            className="-mr-2 w-11 h-11 flex items-center justify-center rounded-full text-navy active:bg-line/60 transition"
          >
            <svg
              className={syncing ? 'animate-spin' : undefined}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
              <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        }
      />

      <div className="max-w-screen-sm mx-auto pb-28 anim-in">
        {accountsList.length > 1 && (
          <div
            className="px-4 pt-3 flex gap-2 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            <button
              type="button"
              onClick={() => handleAccountChange(null)}
              className={
                'rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap shrink-0 min-h-[40px] transition ' +
                (activeAccount === null
                  ? 'bg-navy text-white'
                  : 'bg-paper border border-line text-muted')
              }
            >
              All inboxes
            </button>
            {accountsList.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleAccountChange(a.id)}
                className={
                  'rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap shrink-0 min-h-[40px] transition ' +
                  (activeAccount === a.id
                    ? 'bg-navy text-white'
                    : 'bg-paper border border-line text-muted')
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div className="px-4 pt-3">
          <CategoryChips
            categories={settings?.categories ?? []}
            active={activeCategory}
            onChange={handleCategoryChange}
            counts={counts}
          />
        </div>

        <div className="px-4 mt-3">
          {error && (
            <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm mb-3">{error}</div>
          )}

          {emails === null ? (
            <SkeletonList />
          ) : emails.length === 0 ? (
            !error && (
              <EmptyState title="No mail here yet" hint="New email is summarized automatically" />
            )
          ) : (
            <div className="space-y-3">
              {emails.map((email) => (
                <EmailCard
                  key={email.id}
                  email={email}
                  category={settings?.categories.find((c) => c.key === email.category)}
                  accountLabel={
                    accountsList.length > 1 && activeAccount === null
                      ? accountsList.find((a) => a.id === email.accountId)?.label
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
