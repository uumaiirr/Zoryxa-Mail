import type { Config } from '@netlify/functions'
import type { DigestContent, DigestItem } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, json } from '../lib/http'
import { llmJson } from '../lib/llm'
import * as mailbox from '../lib/mailbox'
import { digestNarrativePrompt } from '../lib/prompts'
import { requireCronOrSession } from '../lib/session'
import * as store from '../lib/store'
import { runSync, todayIn } from '../lib/sync-core'
import { getUser, listUsers, type User } from '../lib/users'

/** Emails are untrusted input — escape everything that goes into the HTML mail. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildHtml(c: DigestContent, humanDate: string, siteUrl: string): string {
  const catRows = c.byCategory
    .filter((b) => b.count > 0)
    .map(
      (b) =>
        `<tr><td style="padding:5px 0;"><div style="border-left:3px solid #3B82F6;padding:2px 0 2px 10px;font-size:14px;color:#101114;">${esc(b.label)} <span style="color:#5A616C;">&mdash; ${b.count}</span></div></td></tr>`,
    )
    .join('')

  const topRows = c.topItems
    .map(
      (t) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #E4E6EA;font-size:14px;line-height:1.45;color:#101114;"><strong>${esc(t.fromName)}</strong>${
          t.actionRequired
            ? ' <span style="color:#2563EB;font-size:12px;font-weight:bold;">&#9679; needs action</span>'
            : ''
        }<br>${esc(t.subject)}<br><span style="color:#5A616C;font-size:13px;">${esc(t.tldr)}</span></td></tr>`,
    )
    .join('')

  const deadlineRows = c.deadlines
    .map(
      (d) =>
        `<tr><td style="padding:5px 0;font-size:13px;line-height:1.45;color:#101114;"><strong>${esc(d.date)}</strong> &mdash; ${esc(d.what)} <span style="color:#5A616C;">(${esc(d.subject)})</span></td></tr>`,
    )
    .join('')

  const section = (title: string, inner: string): string =>
    inner
      ? `<tr><td style="padding:16px 24px 4px 24px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#5A616C;">${title}</td></tr><tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table></td></tr>`
      : ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F5F7;padding:24px 8px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="background-color:#0B0B0D;padding:20px 24px;">
<span style="color:#D9DCE3;font-size:11px;font-weight:bold;letter-spacing:3px;">ZORYXA&nbsp;MAIL</span><br>
<span style="color:#FFFFFF;font-size:20px;font-weight:bold;">Morning Digest</span><br>
<span style="color:#3B82F6;font-size:13px;">${esc(humanDate)}</span>
</td></tr>
<tr><td style="padding:18px 24px 6px 24px;font-size:15px;line-height:1.55;color:#101114;">${esc(c.narrative)}</td></tr>
<tr><td style="padding:12px 24px 2px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="48%" style="background-color:#F4F5F7;padding:12px;text-align:center;">
<div style="font-size:22px;font-weight:bold;color:#101114;">${c.total}</div>
<div style="font-size:12px;color:#5A616C;">emails in 24h</div>
</td>
<td width="4%"></td>
<td width="48%" style="background-color:#F4F5F7;padding:12px;text-align:center;">
<div style="font-size:22px;font-weight:bold;color:#2563EB;">${c.actionCount}</div>
<div style="font-size:12px;color:#5A616C;">need action</div>
</td>
</tr></table>
</td></tr>
${section('By category', catRows)}
${section('Top priorities', topRows)}
${section('Deadlines', deadlineRows)}
<tr><td align="center" style="padding:22px 24px 26px 24px;">
<a href="${esc(siteUrl)}" style="display:inline-block;background-color:#2563EB;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 28px;border-radius:6px;">Open Zoryxa Mail</a>
</td></tr>
</table>
</td></tr></table>`
}

function buildText(c: DigestContent, humanDate: string, siteUrl: string): string {
  const lines: string[] = [
    `Morning Digest — ${humanDate}`,
    '',
    c.narrative,
    '',
    `${c.total} emails in the last 24 hours, ${c.actionCount} need action.`,
  ]
  const cats = c.byCategory.filter((b) => b.count > 0)
  if (cats.length > 0) {
    lines.push('', 'By category:')
    for (const b of cats) lines.push(`- ${b.label}: ${b.count}`)
  }
  if (c.topItems.length > 0) {
    lines.push('', 'Top priorities:')
    for (const t of c.topItems) {
      lines.push(`- ${t.fromName} — ${t.subject}${t.tldr ? `: ${t.tldr}` : ''}`)
    }
  }
  if (c.deadlines.length > 0) {
    lines.push('', 'Deadlines:')
    for (const d of c.deadlines) lines.push(`- ${d.date} — ${d.what} (${d.subject})`)
  }
  lines.push('', `Open Zoryxa Mail: ${siteUrl}`)
  return lines.join('\n')
}

async function runDigestFor(user: User, forced: boolean): Promise<{ sent: boolean; reason?: string }> {
  const settings = await store.getSettings(user.id)
  const tz = settings.timezone
  const today = todayIn(tz)
  const hourNow =
    Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hour12: false }).format(
        new Date(),
      ),
    ) % 24

  // Catch-up window: the cron is best-effort; any tick within 3 hours after
  // digest hour still sends, and the emailedAt guard keeps it to once per day.
  const hoursPast = hourNow - settings.digestHour
  if (!forced && (hoursPast < 0 || hoursPast > 3)) return { sent: false, reason: 'Not digest hour' }

  const existing = await store.getDigest(user.id, today)
  if (existing?.emailedAt && !forced) return { sent: false, reason: 'Already sent today' }

  const emails = await store.emailsSince(user.id, new Date(Date.now() - 86400000).toISOString())
  const total = emails.length
  const actionCount = emails.filter((e) => e.actionRequired).length

  const knownKeys = new Set(settings.categories.map((c) => c.key))
  const counts = new Map<string, number>()
  let otherCount = 0
  for (const e of emails) {
    if (knownKeys.has(e.category)) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
    else otherCount++
  }
  const byCategory = settings.categories.map((c) => ({
    key: c.key,
    label: c.label,
    count: counts.get(c.key) ?? 0,
  }))
  if (otherCount > 0) byCategory.push({ key: 'other', label: 'Other', count: otherCount })

  const sorted = [...emails].sort((a, b) => {
    if (a.actionRequired !== b.actionRequired) return a.actionRequired ? -1 : 1
    return a.receivedAt < b.receivedAt ? 1 : a.receivedAt > b.receivedAt ? -1 : 0
  })
  const topItems: DigestItem[] = sorted.slice(0, 8).map((e) => ({
    id: e.id,
    fromName: e.fromName,
    subject: e.subject,
    tldr: e.tldr || e.snippet.slice(0, 120),
    category: e.category,
    actionRequired: e.actionRequired,
  }))

  const deadlines = sorted
    .flatMap((e) => e.deadlines.map((d) => ({ date: d.date, what: d.what, subject: e.subject })))
    .slice(0, 8)

  // The digest must NEVER fail because the LLM is rate-limited.
  let narrative = `${total} emails in the last 24 hours, ${actionCount} need your attention.`
  try {
    const out = await llmJson<{ narrative: string }>(
      digestNarrativePrompt({
        dateLabel: today,
        total,
        actionCount,
        byCategory: byCategory
          .filter((c) => c.count > 0)
          .map((c) => ({ label: c.label, count: c.count })),
        topItems: topItems
          .slice(0, 5)
          .map((t) => ({ fromName: t.fromName, subject: t.subject, tldr: t.tldr })),
      }),
      { maxTokens: 300, provider: settings.llmProvider },
    )
    if (typeof out.narrative === 'string' && out.narrative.trim().length > 0) {
      narrative = out.narrative.trim()
    }
  } catch (e) {
    console.error('digest narrative failed, using fallback', e)
  }

  const content: DigestContent = {
    date: today,
    total,
    actionCount,
    byCategory,
    topItems,
    deadlines,
    narrative,
  }

  await store.saveDigest(user.id, today, content, null)

  const userAccounts = await accounts.listAccounts(user.id)
  const sender =
    userAccounts.find((a) => a.kind === 'gmail' && a.refreshTokenEnc) ?? userAccounts[0]
  if (!sender) return { sent: false, reason: 'No mail account connected yet' }

  const digestTo = settings.digestTo || user.email
  const humanDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  const siteUrl = process.env.SITE_URL ?? ''

  // Mark as emailed BEFORE sending: if the platform kills this invocation
  // mid-send, the cron's retry must not double-email. A send that fails
  // cleanly resets the marker so a later tick retries.
  await store.saveDigest(user.id, today, content, new Date().toISOString())
  try {
    await mailbox.sendFrom(sender, {
      to: digestTo,
      subject: `Morning Digest — ${humanDate}`,
      body: buildText(content, humanDate, siteUrl),
      html: buildHtml(content, humanDate, siteUrl),
    })
  } catch (e) {
    await store.saveDigest(user.id, today, content, null).catch(() => {})
    console.error('digest email failed for', user.email, e)
    return {
      sent: false,
      reason: `Digest built but the email failed to send: ${e instanceof Error ? e.message : 'error'}`,
    }
  }

  return { sent: true }
}

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const sessionUser = requireCronOrSession(req) // user id, or null on the cron path

  const body = (await req.json().catch(() => ({}))) as { force?: boolean }
  // A signed-in user pressing the button expects it to run NOW; only the pure
  // cron path is bound to each user's configured hour.
  const forced = body.force === true || sessionUser !== null

  try {
    await runSync({ light: true })
  } catch (e) {
    console.error('sync during digest failed', e)
  }

  const targets = sessionUser !== null ? [await getUser(sessionUser)] : await listUsers()
  const results: { user: string; sent: boolean; reason?: string }[] = []
  for (const user of targets) {
    try {
      const r = await runDigestFor(user, forced)
      results.push({ user: user.email, ...r })
    } catch (e) {
      console.error('digest failed for', user.email, e)
      results.push({
        user: user.email,
        sent: false,
        reason: e instanceof Error ? e.message : 'failed',
      })
    }
  }

  return json({ ok: true, sent: results.some((r) => r.sent), results })
})

export const config: Config = { path: '/api/digest/run' }
