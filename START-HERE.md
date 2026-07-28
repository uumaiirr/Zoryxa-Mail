# ZORYXA MAIL — Start Here

Everything you need to know and do, in one document. Read part 1 to understand the
system, then follow part 2 step by step. Total hands-on time: about **60–75 minutes**,
all in a web browser, no terminal needed.

---

## Part 1 — How Zoryxa Mail works (plain English)

### The five pieces

| Piece | What it is | What it does | Cost |
|---|---|---|---|
| **The app** (Netlify) | The website / phone app | Everything you see, plus the "brain" that reads, summarizes, and drafts | $0 |
| **The memory** (Supabase) | A private database | Stores summaries, categories, drafts, settings — never full emails | $0 (already created for you) |
| **The AI** (Gemini) | Google's AI, free tier | Writes the summaries, categories, and voice-matched drafts | $0 (your key is already working) |
| **The clock** (GitHub Actions) | A free scheduler | Ticks every hour: syncs mail, sends the morning digest at your chosen hour | $0 |
| **The doorbell** (Cloud Pub/Sub, optional) | Google's push service | Makes Gmail mail appear in the app within **seconds** of arriving | $0 |

### The life of one email

1. An email lands in a connected mailbox.
2. **Gmail accounts:** Gmail rings the "doorbell" → the app fetches it within seconds.
   **IMAP accounts:** the app picks it up on the next hourly tick or when you open the app.
3. The AI reads it once and stores only the results: a one-line summary, a category
   (Client, Government, Finance…), who's involved, deadlines, tasks, and whether it
   needs action. **The full email body is never stored** — it is fetched live from the
   mail server each time you open it, then discarded.
4. If the email genuinely deserves a written reply (a question, an approval, an
   invitation — not invoices or newsletters), the AI **pre-writes a reply in that
   account owner's voice**. You'll see a "Draft ready" badge in the inbox.
5. You open the email, review the ready draft (edit anything), and tap **Send** →
   a confirmation shows the recipient, subject, and full text → one more tap and it
   goes out from your real address. **Nothing is ever sent without that tap.**
6. Every morning at your chosen hour, a **Morning Digest** email arrives: totals,
   what needs action, and the deadlines — across all connected accounts.

### The two ways to connect a mailbox

**Way 1 — Connect Gmail (the "bridge" system).** Best for the most important mailbox.

The office address (`walid@dubaiconsultancy.ae`) lives on the company's own cPanel
server, which can't do real-time push. The trick: a dedicated **bridge Gmail account**
sits in the middle.

```
Incoming:  sender ──▶ office mailbox (cPanel) ──forwarder──▶ bridge Gmail ──push──▶ Zoryxa (seconds)
Outgoing:  Zoryxa ──▶ bridge Gmail "Send mail as" ──office SMTP──▶ recipient sees walid@dubaiconsultancy.ae
```

- A **forwarder** in cPanel sends a *copy* of every incoming email to the bridge Gmail.
  The office mailbox itself is never touched — Outlook, phones, everything keeps working.
- Gmail's **"Send mail as"** alias, wired to the office SMTP server, makes every reply
  show the office address as the sender. Recipients never see the Gmail address.
- The app connects to the bridge with **Google sign-in (OAuth)** — no password is ever
  stored, access is revocable with one click, and Gmail pushes new mail instantly.
- Click-by-click wiring: **SETUP.md Part 4** (forwarder + Send-mail-as) and **Part 4B**
  (the real-time doorbell).

**Way 2 — Add IMAP account (the direct system).** Best for personal mailboxes.

The app talks straight to any mail server (cPanel, Outlook, Yahoo) using the mailbox's
own settings: server name, port, username, password.

- The password is stored **AES-256-GCM encrypted**; the decryption key exists only
  inside Netlify — someone with the database alone can read nothing.
- Reading uses IMAP, sending uses the same server's SMTP — mail comes from your real
  address natively.
- No push doorbell here: mail appears on the hourly tick and whenever the app opens.
- Everything is done inside the app: **Settings → Mail accounts → Add IMAP account**.
  The app checks the credentials against the server *before* saving anything.

**Both ways coexist.** Connect several accounts — your Gmail, the office bridge, a
personal Outlook — and the inbox grows an account switcher. Each account keeps its own
writing style (rebuild it from its row in Settings) and its own "Send as" address. The
in-app **Guide** (book card at the top of Settings) has the server settings for
cPanel, Outlook, and Yahoo.

### What can never happen

- The app **never sends, deletes, archives, or moves** anything by itself. Drafts wait.
- The only automatic email is the Morning Digest, sent **to you**.
- Full email bodies and attachments are never stored anywhere.
- The origin office server is read-only via the bridge — never modified.

---

## Part 2 — Baby steps: from here to live

**The file to upload:** `Zoryxa-Mail-upload.zip` on your Desktop. It is the complete
project minus secrets. Your secrets live separately in `Desktop\ceo-mail-agent\.env`
— that file is your copy-paste sheet for step 4 and must **never** be uploaded.

### Step 1 — Put the code on GitHub (10 min)
1. Go to **github.com** → sign in (or create a free account).
2. Top-right **+** → **New repository** → name it `zoryxa-mail` → set it **Public**
   (public = the hourly clock is free forever; the code contains zero secrets) → **Create repository**.
3. On the new repo page click **"uploading an existing file"**.
4. On your PC, **unzip** `Zoryxa-Mail-upload.zip`, open the unzipped folder, press
   **Ctrl+A** (select everything *inside* it), and **drag it all** into the GitHub page.
5. Wait for the file list to finish, then click **Commit changes**.

### Step 2 — Supabase key (2 min — the database is already built)
1. **supabase.com/dashboard** → open the project **ceo-mail-agent**.
2. Gear icon (**Project Settings**) → **API Keys** → reveal and copy the **service_role** key.
3. Paste it into the `SUPABASE_SERVICE_ROLE_KEY=` line of `Desktop\ceo-mail-agent\.env` (Notepad).

### Step 3 — Google Cloud, one-time (20 min)
Follow **SETUP.md Part 4** exactly, signed in as the **bridge Gmail account**:
create a project → enable **Gmail API** → OAuth consent screen (External) →
**Publish app** (critical — skips the 7-day expiry; ignore "verification") →
Credentials → **OAuth client ID (Web application)**. Copy the **Client ID** and
**Client secret** into `.env` (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
Leave the redirect URI empty for now — step 5 fills it.

*(Skip the wiring in Part 4's "connect the office mailbox" section until you hand
this to the CEO — for testing with your own Gmail you don't need it.)*

### Step 4 — Netlify (15 min)
1. **netlify.com** → sign up with GitHub → **Add new project / Import an existing project** → pick `zoryxa-mail`. Build settings auto-detect — just **Deploy**.
2. **Site configuration → Environment variables → Add a variable → Import from a .env file** → paste the entire contents of your `.env` file in one go.
3. Copy your site address (like `https://zoryxa-mail.netlify.app`). Put it into the `SITE_URL=` variable (no trailing slash) and redeploy (**Deploys → Trigger deploy**).

### Step 5 — Close the Google loop (2 min)
Back in Google Cloud → Credentials → your OAuth client → **Authorized redirect URIs** →
add: `https://YOUR-SITE.netlify.app/api/auth/google/callback` → Save.

### Step 6 — Turn on the clock (5 min)
GitHub repo → **Settings → Secrets and variables → Actions** → add two secrets:
`SITE_URL` (your Netlify address) and `CRON_SECRET` (same value as in `.env`).
Then the **Actions** tab → enable workflows → open **mail-agent-scheduler** → **Run workflow** once to test.

### Step 7 — First run (5 min)
1. Open your site address → passcode: **Zoryxa-Falcon-6270** (from `.env`; change it there + in Netlify anytime).
2. **Settings → Mail accounts → Connect Gmail** → pick **your own Gmail** (your test phase) → at "Google hasn't verified this app" press **Advanced → Continue** (expected — it's your own app).
3. Wait a minute — your last 30 days appear, summarizing progressively.
4. In the account's row tap **Rebuild writing style**. Set digest hour + timezone + "Send digest to" → **Save**.

### Step 8 — Install on the phone (2 min)
Open the site on the phone → browser menu → **Add to Home screen** (Huawei Browser: ≡ → "Add to home screen"; Chrome: "Install app"; iPhone Safari: Share → "Add to Home Screen"). The Z icon appears and it launches as a full-screen app.

### Step 9 — Real-time push, optional but recommended (10 min)
**SETUP.md Part 4B**: create the Pub/Sub topic, give Gmail publish rights, point the
push subscription at `https://YOUR-SITE.netlify.app/api/gmail/push?token=YOUR_CRON_SECRET`,
add `GMAIL_PUSH_TOPIC` in Netlify, redeploy. Gmail mail now lands in seconds.

### Later — handing it to the CEO
Wire the office mailbox to the bridge (SETUP.md Part 4's forwarder + Send-mail-as
section), connect the bridge Gmail in Settings, set its "Send as" to
`walid@dubaiconsultancy.ae`, rebuild its writing style, change `DIGEST_TO` — done.
His mail and yours can live side by side, or give him his own separate deployment
(repeat these steps with his accounts) for full privacy between you.

---

## If something goes wrong

The in-app **Guide** (Settings → book card) covers the common fixes. Deeper answers:
**SETUP.md** (full walkthrough + troubleshooting table), **COSTS.md** (proof every
service is $0/month and what happens at free-tier limits), **PRIVACY.md** (exactly
what is stored, where, and how to revoke everything).
