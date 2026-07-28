import { useState } from 'react'
import type { ReactNode } from 'react'
import TopBar from '../components/TopBar'
import ZoryxaLogo from '../components/ZoryxaLogo'

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="bg-mist border border-line rounded px-1.5 py-0.5 text-[12px]">{children}</code>
  )
}

function Callout({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-goldsoft/60 p-3 text-[13px] leading-relaxed">{children}</div>
}

function Section({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left min-h-[56px]"
        aria-expanded={open}
      >
        <span className="w-9 h-9 rounded-lg bg-goldsoft flex items-center justify-center text-navydeep shrink-0">
          {icon}
        </span>
        <span className="font-semibold flex-1">{title}</span>
        <svg
          viewBox="0 0 24 24"
          className={'w-4 h-4 text-muted shrink-0 transition ' + (open ? 'rotate-90' : '')}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm leading-relaxed text-ink space-y-3">{children}</div>
      )}
    </div>
  )
}

const I = {
  envelope: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M10 21v-3h4v3" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </svg>
  ),
  pen: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.8 2.1c-.8.5-1.3 1-1.3 1.9M12 17h.01" />
    </svg>
  ),
}

export default function GuideView() {
  return (
    <>
      <TopBar back title="Guide" subtitle="Connect your mail, step by step" />
      <div className="max-w-screen-sm mx-auto px-4 pb-28 anim-in pt-3">
        <Section icon={<ZoryxaLogo size={18} variant="current" />} title="How this app works" defaultOpen>
          <p>
            Every mailbox you connect is read securely, and each email is summarized and
            categorized the moment it arrives. Mail that genuinely deserves a reply comes with one
            already written in your voice — look for the <strong>Draft ready</strong> badge.
          </p>
          <Callout>
            Nothing is ever sent, deleted, or moved without you tapping <strong>Send</strong> and
            confirming. The only automatic email is your own morning digest.
          </Callout>
        </Section>

        <Section icon={I.envelope} title="Connect a Gmail account">
          <ol className="list-decimal ml-5 space-y-1.5">
            <li>Open <strong>Settings → Mail accounts → Connect Gmail</strong>.</li>
            <li>Choose the Google account and approve the permissions.</li>
            <li>
              The first time, Google shows <em>"Google hasn't verified this app"</em>. That is
              expected — it is your own private app. Tap <strong>Advanced</strong>, then{' '}
              <strong>Continue</strong>.
            </li>
            <li>Done — mail starts appearing within a minute.</li>
          </ol>
          <Callout>
            If you ever change that Google account's password, Google disconnects the app. Just tap
            <strong> Connect Gmail</strong> again.
          </Callout>
        </Section>

        <Section icon={I.building} title="Connect an office mailbox (cPanel / IMAP)">
          <p>
            Open <strong>Settings → Mail accounts → Add IMAP account</strong> and fill in:
          </p>
          <ol className="list-decimal ml-5 space-y-1.5">
            <li>Email address — the office address itself.</li>
            <li>
              Incoming server — usually <Code>mail.yourdomain.com</Code>, port <Code>993</Code>.
            </li>
            <li>Username — usually the full email address; password — the mailbox password.</li>
            <li>
              Outgoing server — usually the same server, port <Code>587</Code> (or{' '}
              <Code>465</Code>).
            </li>
          </ol>
          <p>
            Where to find these: cPanel → <strong>Email Accounts</strong> →{' '}
            <strong>Connect Devices</strong> ("Mail Client Manual Settings"), or ask whoever manages
            the company website.
          </p>
          <Callout>
            For the busiest mailbox there is a stronger alternative: route it through a Gmail
            "bridge" (a forwarder in cPanel plus Gmail's "Send mail as"). That gives instant
            arrival and reply threading — the full walkthrough is in <Code>SETUP.md</Code> Part 4.
            Direct IMAP is the simplest and checks about hourly, plus every time the app opens.
          </Callout>
        </Section>

        <Section icon={I.plus} title="Add personal mailboxes">
          <p>
            You can connect several accounts side by side — the inbox gets an account switcher
            automatically, and each account keeps its own writing style and send-as address.
          </p>
          <ul className="list-disc ml-5 space-y-1.5">
            <li>
              <strong>Yahoo:</strong> <Code>imap.mail.yahoo.com</Code>/993 and{' '}
              <Code>smtp.mail.yahoo.com</Code>/465 — needs an <em>app password</em> (Yahoo Account
              Security → Generate app password).
            </li>
            <li>
              <strong>Outlook / Hotmail:</strong> <Code>outlook.office365.com</Code>/993 and{' '}
              <Code>smtp.office365.com</Code>/587.
            </li>
            <li>
              <strong>Another Gmail:</strong> don't use IMAP — just tap{' '}
              <strong>Connect Gmail</strong> again.
            </li>
          </ul>
        </Section>

        <Section icon={I.bolt} title="Instant arrival">
          <p>
            Gmail accounts can push new mail into the app <strong>within seconds</strong> after a
            one-time Google Cloud step (see <Code>SETUP.md</Code> Part 4B). Without it — and for
            IMAP accounts — mail is picked up every hour and every time you open the app.
          </p>
        </Section>

        <Section icon={I.sun} title="Your morning digest">
          <p>
            One email each morning: totals, what needs action, and the day's deadlines across all
            your accounts. Set the hour, timezone, and destination address in{' '}
            <strong>Settings → Morning digest</strong>. It also lives in the Digest tab.
          </p>
        </Section>

        <Section icon={I.pen} title="Drafts in your voice">
          <p>
            The app learns how each account's owner writes from their sent mail. After connecting
            an account, tap <strong>Rebuild writing style</strong> in its row — and again every
            month or two. Replies and new emails are then drafted the way <em>you</em> write, per
            account.
          </p>
        </Section>

        <Section icon={I.help} title="If something looks wrong">
          <ul className="list-disc ml-5 space-y-1.5">
            <li>Mail not appearing → pull the inbox to refresh; check the account is listed in Settings.</li>
            <li>"Could not sign in to the mail server" → recheck server, port, and password; Yahoo needs an app password.</li>
            <li>Drafts sound generic → Rebuild writing style for that account.</li>
            <li>Digest missing → check the hour and timezone in Settings, then the spam folder.</li>
            <li>Gmail disconnected → Settings → Connect Gmail again.</li>
          </ul>
        </Section>
      </div>
    </>
  )
}
