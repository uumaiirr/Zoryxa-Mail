# Privacy & Security

Plain English, but precise. This document describes exactly what data the app stores, where it travels, and how to shut everything off.

## What is stored, and where

Everything the app persists lives in **your own Supabase project** — a database only you control. It contains:

| Data | Details |
|---|---|
| Email metadata | Sender name and address, recipients, subject, Gmail's short snippet, received/synced timestamps |
| AI analysis | The one-line summary (TL;DR), category, participants, extracted tasks and deadlines, action-required flag, and whether a reply is worth writing |
| Auto-drafted replies | For reply-worthy mail, the pre-written reply text (subject + body) waits in the database until the CEO reviews it. Drafts are **never sent automatically** — sending always requires his explicit confirmation in the app |
| Writing-style profile | A structured description of how the CEO writes (greetings, sign-offs, tone, common phrases) plus **3 short excerpts** of his sent mail used as voice examples |
| Daily digests | Each morning's digest content and when it was emailed |
| Gmail refresh token | The credential that lets the app access the bridge Gmail account — stored **AES-256-GCM encrypted**, with the encryption key held only in Netlify's environment variables. Someone with the database alone cannot use it |
| Sync state | Timestamps of the last sync run |
| App settings | Categories, digest hour, timezone, chosen LLM provider, digest/send addresses |

## What is NEVER stored

- **Full email bodies.** When the CEO opens an email, the body is fetched live from Gmail for that view and discarded. It is never written to the database.
- **Attachments.** Never downloaded, never stored.
- **Passwords.** The app never sees any Google or mailbox password — Gmail access uses Google's OAuth, and the app's own passcode is checked server-side and never stored in the browser.

## Where email content travels, feature by feature

The one place email content leaves Gmail is the LLM provider you selected, and only transiently:

- **Summarizing (on arrival):** each new email's body is sent to the LLM (Gemini or Groq) to produce the one-line summary, category, tasks, and deadlines. Only the resulting analysis is stored; the body is discarded.
- **Drafting a reply (on demand or automatic):** the original email's body, the CEO's instruction (if any), and the style profile (with its 3 sent-mail excerpts) are sent to the LLM to write the draft. Auto-drafts are stored in the database until reviewed; nothing is ever sent without the CEO's explicit confirmation.
- **Real-time push (if enabled):** Gmail's push notifications travel through Google Cloud Pub/Sub but contain **no email content at all** — only the mailbox address and a history number that mean "something arrived, go sync".
- **Morning digest:** only already-stored statistics and one-line summaries are sent to the LLM to write the short narrative — not full bodies.

**Honest caveat about the free Gemini tier:** Google states that free-tier API prompts may be used to improve its products. That means email text sent for summarizing or drafting could be reviewed under Google's data-use policy. If that is unacceptable, switch the provider to **Groq** in Settings — a free alternative whose free tier does not carry that clause. The app treats both identically.

## Security measures

- **HTTPS everywhere** — the PWA, the API, Supabase, Gmail, and the LLM providers are all TLS-only.
- **The browser never holds secrets.** All keys (LLM, Supabase service key, Google OAuth client secret, encryption key) live in Netlify environment variables and are used only server-side. The phone stores nothing but a session cookie.
- **Supabase is locked to the outside world.** Row Level Security is enabled on every table with **zero policies**, so Supabase's public anon key can read nothing at all. Only the server-side service-role key (held by Netlify) can touch the data.
- **Passcode + signed cookie.** Opening the app requires the passcode; success sets a signed, HttpOnly, 30-day cookie. HttpOnly means page scripts cannot read it; signed means it cannot be forged.
- **Scheduled endpoints are locked.** `/api/sync` and `/api/digest/run` refuse any request that doesn't carry the correct `x-cron-secret` header.
- **Refresh token encrypted at rest** with AES-256-GCM; the key exists only in Netlify.
- **Sending requires human confirmation.** Every send shows the exact recipient, subject, and body in-app and goes out only after an explicit tap.

## Autonomy guarantees — what the agent will never do

- It **never auto-sends, auto-deletes, or auto-archives** anything. It only reads, summarizes, and drafts.
- The **origin mailbox (`walid@dubaiconsultancy.ae`) is never modified.** The office cPanel mailbox only *forwards copies* to the bridge Gmail account; the agent works on the bridge copy and has no access to the origin at all.
- The **only automated outbound email is the morning digest**, sent to the CEO's own address — never to anyone else.
- Every reply or new email the agent drafts sits on screen until the CEO edits, confirms, and taps send.

## Pulling the plug — full revocation

You can shut off each part independently, and each action removes a specific slice of data or access:

| Action | How | What disappears |
|---|---|---|
| Cut the app's Gmail access | Go to **https://myaccount.google.com/permissions** (signed in as the bridge account) → select **CEO Mail Agent** → **Remove access** | The app can no longer read or send any mail, instantly. The stored (encrypted) refresh token becomes useless |
| Rotate the secrets | Netlify → Site configuration → Environment variables → replace `APP_PASSCODE`, `SESSION_SECRET`, `CRON_SECRET`, `TOKEN_ENCRYPTION_KEY` → Trigger deploy | All existing phone sessions are signed out; old cron callers are locked out; a rotated `TOKEN_ENCRYPTION_KEY` also makes the stored Gmail token undecryptable (reconnect Gmail afterwards if you rotated it deliberately) |
| Delete the database | Supabase dashboard → Project Settings → **Delete project** | Every stored summary, category, task, deadline, digest, the style profile and its sent-mail excerpts, the encrypted token, settings, and sync history — gone permanently |
| Stop the schedule | GitHub repo → Actions tab → **mail-agent-scheduler** → **Disable workflow** | No more automatic syncs or digests |
| Take the app offline | Netlify → Site configuration → **Delete site** (or delete the GitHub repository too) | The app URL stops existing; all environment variables (keys) are destroyed with it |

Doing all five removes every trace of the system. The actual emails are untouched throughout — they live in Gmail and the office mailbox exactly as they always did.
