# Setup Guide — from zero to a working mail agent

This guide assumes you have **never used GitHub, a database, or a terminal**. Everything happens in a normal web browser on a computer. Follow the parts in order; each step is one action. Total time: about **90 minutes**, and you only do this once.

**What you will need before starting:**

- A computer with a web browser (Chrome or Edge recommended)
- The project folder (`ceo-mail-agent`) on that computer
- The **bridge Gmail account** — the dedicated Gmail address that receives a copy of the office mailbox (`walid@dubaiconsultancy.ae`). You need its password during Part 4 and Part 8.

---

## Part 1 of 11 — What you'll create (2 minutes, just read)

The app is made of four free services connected together. Here is the plain-language map:

| Service | What it does in this app | Account needed |
|---|---|---|
| **GitHub** | Stores the code and runs a free hourly timer that wakes the app up | New free account |
| **Supabase** | The database — stores email summaries and settings (never full emails) | New free account |
| **Google Cloud** | Lets the app read and draft mail in the bridge Gmail account, and gives you a free AI key | The **bridge Gmail account** you already have |
| **Netlify** | Hosts the app itself — the address you'll open on the phone | New free account (created with GitHub, so no new password) |

That's **4 accounts total**, all free, no credit card required anywhere. When you're done, the CEO opens one web address on his phone, types a passcode, and everything else is automatic.

---

## Part 2 of 11 — Put the code on GitHub (15 minutes)

GitHub will hold the code and run the hourly schedule. The repository must be **Public** — on public repositories GitHub's scheduler is free forever with no minute limits; on private ones there's a monthly cap. This is safe: **no passwords or keys live in the code.** All secrets go into Netlify later, in Part 6.

1. Go to **https://github.com/signup** and create an account (email, password, username). Verify the email it sends you.
2. Once signed in, click the **+** button in the top-right corner of the page.
3. Click **New repository**.
4. In **Repository name**, type: `ceo-mail-agent`
5. Under visibility, select **Public** (this keeps the scheduler free forever).
6. Leave every checkbox unticked (no README, no .gitignore, no license — the project already has these).
7. Click the green **Create repository** button.
8. On the page that appears, find the sentence "…or **uploading an existing file**" and click the **uploading an existing file** link.
9. On your computer, open the `ceo-mail-agent` folder so you can see the files inside it.
10. Select **everything inside the folder** and drag it onto the GitHub upload page. **Exception:** if you see a folder called `node_modules`, do NOT include it (click empty space first, then Ctrl+A, then Ctrl-click `node_modules` to unselect it). Drag the folders too (`src`, `netlify`, `shared`, `public`, `supabase`, `.github`) — dragging a folder uploads what's inside it.
11. Wait until the file list stops loading, then scroll down and click the green **Commit changes** button.
12. Check the upload worked: on the repository's front page you should see folders named `src`, `netlify`, and `.github`. If `.github` is missing (some browsers skip folders that start with a dot), go back into your local folder, open `.github/workflows`, and upload `scheduler.yml` by clicking **Add file → Upload files** and dragging just that file — then in the filename box area GitHub will show it; before committing, you must recreate its path: click **Add file → Create new file** instead, type `.github/workflows/scheduler.yml` as the name, paste the file's contents in, and click **Commit changes**.

Leave the GitHub tab open — you'll come back in Part 7.

---

## Part 3 of 11 — Supabase, the database (2 minutes — mostly done already)

Good news: the database **already exists**. A project named `ceo-mail-agent` was created in your Supabase organization (region: Mumbai, free tier, $0/month) and all tables were already set up. You only need to copy two values:

1. Go to **https://supabase.com/dashboard** and sign in.
2. Open the project **ceo-mail-agent**.
3. Your Project URL is: `https://oxnidviibofzxycmyuva.supabase.co` — add it to a temporary notes file labeled `SUPABASE_URL`.
4. In the left sidebar, click the gear icon (**Project Settings**), then **API Keys** (on older dashboards: **API**).
5. Find the key labeled **service_role** — click **Reveal**, copy it, and add it to your notes file labeled `SUPABASE_SERVICE_ROLE_KEY`.

> **Warning:** the `service_role` key can read and write your whole database. Never paste it anywhere except the Netlify environment-variables page in Part 6, and delete your notes file when you finish this guide.

> **If you ever need to rebuild the database from scratch** (new Supabase account, for the CEO's own deployment, or a teammate's): create a new project, open **SQL Editor**, paste the whole contents of `supabase/schema.sql` from the project folder, and click **Run**. That single step recreates everything.

---

## Part 4 of 11 — Google Cloud + Gmail access (20 minutes)

This part gives the app permission to read and draft mail in the **bridge Gmail account**. Do all of it **signed in as the bridge Gmail account**, not your personal one.

### First: connect the office mailbox to the bridge account

The CEO's real mailbox (`walid@dubaiconsultancy.ae`) lives on the company's own mail server (cPanel/IMAP). The app never logs into it directly — instead, the bridge Gmail account receives a copy of everything and sends replies *as* the office address. If this wiring already exists, skip to "Now the Google Cloud part" below.

**Incoming mail — set up a forwarder (recommended, instant):**

1. Log in to the company's **cPanel** (usually `https://dubaiconsultancy.ae/cpanel` or the address your hosting company gave you).
2. In the **Email** section, click **Forwarders**.
3. Click **Add Forwarder**.
4. In **Address to Forward**, type `walid` and make sure the domain shows `dubaiconsultancy.ae`.
5. In **Forward to Email Address**, type the bridge Gmail address.
6. Click **Add Forwarder**.

This sends a *copy* of every incoming email to the bridge account. The original stays in the office mailbox untouched — Outlook, phones, and everything else keep working exactly as before. Nothing is ever deleted, moved, or changed on the office server.

> **No cPanel access?** Use Gmail's built-in fetcher instead: in the bridge Gmail, gear icon → **See all settings** → **Accounts and Import** → **Check mail from other accounts** → **Add a mail account** → enter `walid@dubaiconsultancy.ae`, then the mail server details (server: usually `mail.dubaiconsultancy.ae`, port `995`, the mailbox password, and tick "Always use a secure connection"). Important: tick **"Leave a copy of retrieved message on the server"** so the office mailbox keeps everything. This works, but Gmail only checks every once in a while (up to an hour), so the forwarder is better when possible.

**Outgoing mail — add the "Send mail as" alias (so replies come from the office address):**

1. In the bridge Gmail, click the gear icon → **See all settings** → **Accounts and Import**.
2. Next to **Send mail as**, click **Add another email address**.
3. Name: `Walid` (or however his name should appear). Email address: `walid@dubaiconsultancy.ae`. Untick **Treat as an alias** only if Google support pages tell you to — the default is fine. Click **Next Step**.
4. Gmail asks for the office mail server's outgoing (SMTP) details: **SMTP Server**: usually `mail.dubaiconsultancy.ae` — **Port**: `587` (if that fails, try `465`) — **Username**: the full address `walid@dubaiconsultancy.ae` — **Password**: the office mailbox password. Choose the secured connection option Gmail recommends (TLS for 587, SSL for 465). Click **Add Account**.
5. Google sends a confirmation code to the office mailbox — since the forwarder from the step above is active, it also appears in the bridge Gmail inbox. Open it and click the confirmation link (or type the code).

From now on, every reply the app sends shows `walid@dubaiconsultancy.ae` as the sender — recipients never see the Gmail address. (The mailbox password entered here is stored by Google inside Gmail's own settings, not by this app — the app itself never sees or stores any password.)

Now the Google Cloud part:

1. Go to **https://console.cloud.google.com** and sign in with the **bridge Gmail account**. Accept the terms if asked.
2. At the top of the page, click the project dropdown (it may say "Select a project"), then click **New project**.
3. Name it `ceo-mail-agent` and click **Create**. When the notification appears, click **Select project**.
4. In the search bar at the top, type **Gmail API** and click the **Gmail API** result.
5. Click the blue **Enable** button.
6. In the search bar, type **OAuth consent screen** and open it (on newer consoles this lives under **Google Auth Platform** — same thing). If a "Get started" wizard appears, click **Get started**.
7. Choose **External** as the user type (this is the only option without a paid workspace) and click **Create** / **Next**.
8. Fill in only the required fields: **App name**: `CEO Mail Agent`; **User support email**: the bridge Gmail address; **Developer contact email**: the bridge Gmail address again. Click **Save and Continue** (or **Create**).
9. If a **Scopes** page appears, add **nothing** — just click **Save and Continue**. (The app asks for the exact Gmail permissions itself when you connect it in Part 8.)
10. On the **Test users** page (on newer consoles: **Audience** → **Add users**), click **Add users**, type the bridge Gmail address, click **Add**, then **Save and Continue** / **Save**.
11. **IMPORTANT — do not skip this step.** Go back to the consent screen's main page (or the **Audience** page) and click the **Publish app** button, then **Confirm**. The status should change from "Testing" to "In production". Do **not** click anything about "submit for verification" — you don't need it.

> **Why publishing matters:** while an app is in "Testing" status, Google expires its access every **7 days**, which would force you to reconnect Gmail weekly. Published ("In production") apps don't have that limit. Google explicitly allows small personal apps (under 100 users) to stay unverified — the only consequence is a one-time warning screen that says **"Google hasn't verified this app"** when you connect Gmail in Part 8. That warning is expected and safe: it's *your own* app accessing *your own* account. When you see it, click **Advanced** (small link, bottom-left), then click **Go to CEO Mail Agent (unsafe)**, then **Continue**. You do this exactly once.

12. In the search bar, type **Credentials** and open **Credentials** (under APIs & Services).
13. Click **+ Create credentials** at the top, then click **OAuth client ID**.
14. In **Application type**, choose **Web application**.
15. Name it `ceo-mail-agent-web`.
16. Leave **Authorized redirect URIs** empty for now — you'll come back and paste your Netlify address here at the end of Part 6 (it will be your site URL plus `/api/auth/google/callback`).
17. Click **Create**. A box appears with two values. Copy the **Client ID** into your notes file labeled `GOOGLE_CLIENT_ID`, and the **Client secret** labeled `GOOGLE_CLIENT_SECRET`. (You can always see them again later under Credentials.)

> **One caveat to remember forever:** if you ever **change the bridge Gmail account's password**, Google automatically disconnects the app. Nothing breaks permanently — just open the app's Settings and tap **Connect Gmail** again.

---

## Part 4B — Real-time arrival (optional but recommended, 10 minutes)

Without this part, new mail appears when the app is opened and on the hourly schedule. With it, Gmail *pushes* a signal the second mail arrives, and emails show up in the app within seconds. It uses Google Cloud Pub/Sub, which is free at this scale (the free allowance is thousands of times more than one mailbox will ever use). Stay signed in as the **bridge Gmail account**, in the same Google Cloud project from Part 4.

1. In the search bar at the top of Google Cloud Console, type **Pub/Sub** and open **Pub/Sub**. If a blue **Enable** button appears, click it.
2. Click **Create topic**.
3. In **Topic ID**, type exactly: `gmail-push`. Untick "Add a default subscription" if it's ticked. Click **Create**.
4. On the topic's page, find the **Permissions** tab (or click the topic, then **Show info panel** → **Permissions**). Click **Add principal**.
5. In **New principals**, paste exactly: `gmail-api-push@system.gserviceaccount.com`
6. In **Role**, choose **Pub/Sub** → **Pub/Sub Publisher**. Click **Save**. (This lets Gmail itself announce "new mail arrived" on your topic — it carries no email content.)
7. In the left Pub/Sub menu, click **Subscriptions** → **Create subscription**.
8. **Subscription ID**: `gmail-push-to-app`. **Select a Cloud Pub/Sub topic**: pick `gmail-push`.
9. **Delivery type**: choose **Push**.
10. **Endpoint URL**: your Netlify site address plus the push path and your cron secret, like this (you will have both values after Part 6 — come back and paste then):
    `https://YOUR-SITE.netlify.app/api/gmail/push?token=YOUR_CRON_SECRET`
11. Set **Acknowledgement deadline** to **60** seconds. Leave everything else as-is and click **Create**.
12. After Part 6, add one more Netlify environment variable: `GMAIL_PUSH_TOPIC` with the value `projects/YOUR_PROJECT_ID/topics/gmail-push` — replace `YOUR_PROJECT_ID` with the project ID shown in the Google Cloud console's project dropdown (it looks like `ceo-mail-agent-431208`).

That's all. The app registers and renews the Gmail "watch" automatically every time it syncs — you never touch this again. If you skip this part entirely, everything still works on the hourly schedule.

---

## Part 5 of 11 — The free AI key (5 minutes)

The app uses Google's Gemini for summaries and drafting. It's free and needs **no credit card**.

1. Go to **https://aistudio.google.com/app/apikey** and sign in (the bridge Gmail account is fine).
2. Click **Create API key**.
3. If it asks which project, pick the `ceo-mail-agent` project you made in Part 4.
4. Copy the key into your notes file labeled `GEMINI_API_KEY`.

> **Optional alternative — Groq:** also free, also no card. One honest difference: on Gemini's free tier, Google may use what you send to improve its products; Groq's free tier doesn't say that. If that matters for your email content, get a Groq key too at **https://console.groq.com/keys** (click **Create API Key**), save it as `GROQ_API_KEY`, and you can switch the provider to Groq at any time in the app's Settings. You can also set up Gemini now and decide later — switching takes one tap.

---

## Part 6 of 11 — Netlify, where the app lives (20 minutes)

1. Go to **https://app.netlify.com/signup** and click **Sign up with GitHub**, then click **Authorize Netlify**.
2. Answer or skip the short questionnaire if one appears.
3. Click **Add new site** (or **Import an existing project** if you see it directly), then choose **Import an existing project**.
4. Click **Deploy with GitHub** and click **Authorize** if asked. If it asks which repositories Netlify may access, choose **All repositories** or select `ceo-mail-agent`, then click **Install/Save**.
5. Click the **ceo-mail-agent** repository in the list.
6. On the configure page, change **nothing** — the build settings are read automatically from the `netlify.toml` file in the code. Don't click deploy yet; first, scroll to the environment-variables section if offered, or just click **Deploy** and add them right after (next step). Either way works — the site will simply be redeployed once the variables are in.
7. Once the site exists, go to **Site configuration** (left sidebar) → **Environment variables** → click **Add a variable** → **Add a single variable**. Add every row of this table, one at a time (Key exactly as written, then its value, then **Create variable**):

| Key | What to put in it | Where it comes from |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | Just type it (change to `groq` later in-app if you prefer) |
| `GEMINI_API_KEY` | Your AI key | Part 5, AI Studio |
| `GROQ_API_KEY` | Your Groq key | Optional — only if you got one in Part 5; otherwise skip |
| `GOOGLE_CLIENT_ID` | The Client ID | Part 4, step 17 |
| `GOOGLE_CLIENT_SECRET` | The Client secret | Part 4, step 17 |
| `SUPABASE_URL` | The Project URL | Part 3, step 13 |
| `SUPABASE_SERVICE_ROLE_KEY` | The service_role key | Part 3, step 14 |
| `APP_PASSCODE` | The passcode the CEO will type to open the app | **Make it up** — a strong phrase you'll tell him, e.g. three unrelated words and a number. Not his email password |
| `SESSION_SECRET` | A 64-character random code | **Make it up randomly** — see the box below |
| `TOKEN_ENCRYPTION_KEY` | A 64-character random code | **Make it up randomly** — see the box below. This one MUST be exactly 64 characters, each one of `0-9` or `a-f` |
| `CRON_SECRET` | A 64-character random code | **Make it up randomly** — see the box below. You'll paste this same value into GitHub in Part 7, and into the Pub/Sub push URL if you did Part 4B |
| `GMAIL_PUSH_TOPIC` | `projects/YOUR_PROJECT_ID/topics/gmail-push` | Only if you did Part 4B (real-time arrival). Leave blank otherwise |

> **Note:** there is no `SEND_AS` variable anymore — the From address is set per mail account inside the app (Settings → Mail accounts → "Send as"). You can also connect **multiple mailboxes** (more Gmail accounts, or any IMAP mailbox like the office cPanel one, Outlook, or Yahoo) from Settings → Mail accounts → "Add IMAP account". The app's built-in **Guide** (the book card at the top of Settings) walks through every field with the common server settings.
| `SITE_URL` | Your site's address | **Skip for now** — added in step 10 below, after you know the address |
| `DIGEST_TO` | `walid@dubaiconsultancy.ae` | The CEO's own inbox — where the morning digest is emailed |
| `SEND_AS` | `walid@dubaiconsultancy.ae` | The "Send mail as" alias from Part 4 — outgoing drafts are sent from this address |
| `GEMINI_MODEL` | *(skip)* | Optional override; leave it out to use the built-in default |
| `GROQ_MODEL` | *(skip)* | Optional override; leave it out |

> **How to generate the three random codes without a terminal.** Typing random characters yourself is NOT good enough for `TOKEN_ENCRYPTION_KEY` — it must be exactly 64 characters and only the characters `0123456789abcdef`. Two easy ways:
>
> **Way 1 (recommended, 10 seconds):** in your browser, press **F12**, click the **Console** tab, paste this line, and press Enter:
>
> ```js
> crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")
> ```
>
> It prints a 64-character code like `9f3c…` — copy it **without the surrounding quotes**. Run the line again for each secret so all three codes are different. (If the console shows a warning about pasting, type `allow pasting` and press Enter first — that warning exists to stop scammers, and here you can see exactly what the line does: it only generates random numbers.)
>
> **Way 2:** go to **https://www.random.org/bytes/**, set it to generate **32** random bytes in **Hexadecimal** format, click **Get Bytes**, then copy the result and **delete all the spaces and line breaks** so you're left with one unbroken 64-character string.

8. With the variables saved, go to **Deploys** (left sidebar) → click **Trigger deploy** → **Deploy site**. Wait for the deploy to show **Published** (1–2 minutes).
9. *(Optional but nice)* Give the site a memorable address: **Site configuration** → **Site details** → **Change site name** → e.g. `walid-mail-agent` → **Save**. The address becomes `https://walid-mail-agent.netlify.app`.
10. Copy your site's real address from the top of the site overview page (it looks like `https://something.netlify.app`). Now add the last variable: **Site configuration** → **Environment variables** → **Add a variable** → Key `SITE_URL`, Value = that address **with no `/` at the end** → **Create variable**.
11. Redeploy once more so the new variable takes effect: **Deploys** → **Trigger deploy** → **Deploy site**.
12. **Back to Google Cloud** to finish step 16 from Part 4: go to **https://console.cloud.google.com** → search **Credentials** → click your **ceo-mail-agent-web** client → under **Authorized redirect URIs** click **+ Add URI** → paste your site address followed immediately by `/api/auth/google/callback` (example: `https://walid-mail-agent.netlify.app/api/auth/google/callback`) → click **Save**.

---

## Part 7 of 11 — Turn on the hourly schedule (10 minutes)

GitHub will now ping the app every hour: it syncs and summarizes new mail, and sends the digest when the configured morning hour arrives.

1. Open your GitHub repository (github.com → your profile → `ceo-mail-agent`).
2. Click **Settings** (the tab on the repository itself, top of the page).
3. In the left sidebar, click **Secrets and variables**, then click **Actions**.
4. Click **New repository secret**. Name: `SITE_URL` — Value: your site address exactly as in Part 6 step 10 (no trailing `/`). Click **Add secret**.
5. Click **New repository secret** again. Name: `CRON_SECRET` — Value: the exact same random code you gave Netlify's `CRON_SECRET`. Click **Add secret**.
6. Click the **Actions** tab at the top of the repository.
7. If a button says **I understand my workflows, go ahead and enable them**, click it.
8. In the left list, click **mail-agent-scheduler**.
9. Click the **Run workflow** dropdown (right side), then click the green **Run workflow** button. This is a manual test run.
10. Wait a minute, refresh the page, and click the run that appeared. Both steps should have green checkmarks. (A red X usually means `SITE_URL` or `CRON_SECRET` doesn't match what's in Netlify — recheck both.)

> **Two things to know about the free schedule:** GitHub's timer is best-effort, so a run can be a few minutes late — that's normal and harmless. And on public repositories GitHub pauses scheduled workflows after **60 days with no activity** in the repository; if that ever happens you'll get an email, and re-enabling is one click on this same Actions page (**Enable workflow**).

---

## Part 8 of 11 — First run on the phone (10 minutes)

Do this on the CEO's phone (or your own first, to check everything).

1. Open the browser (Huawei Browser is fine) and go to your site address (`https://….netlify.app`).
2. Type the passcode (the `APP_PASSCODE` you invented) and continue. You stay signed in for 30 days at a time.
3. Open **Settings** in the app.
4. Tap **Connect Gmail**.
5. Sign in with the **bridge Gmail account** when Google asks.
6. You'll see the one-time warning **"Google hasn't verified this app"**. Tap **Advanced**, then **Go to CEO Mail Agent (unsafe)**, then **Continue**, and allow the Gmail permissions it lists. (This is the expected warning explained in Part 4 — it's your own app.)
7. Back in Settings, tap **Rebuild writing style**. This reads a sample of the sent mail and learns how the CEO writes, so drafts sound like him. It takes a moment.
8. Set the **digest hour** (for example 7, for a 7 a.m. briefing) and the **timezone** (Asia/Dubai).
9. Tap **Save**.
10. Trigger a first sync (tap the sync/refresh control in the app, or just wait — the hourly schedule will do it). New emails will appear with summaries within the hour.

---

## Part 9 of 11 — Install it like an app on the home screen (3 minutes)

The app installs straight from the browser — no app store needed.

**Huawei Browser (the usual case on a Huawei phone):**

1. With the site open, tap the menu button (the **≡** or three-dot button at the bottom).
2. Tap **Add to** (on some versions it says **Add to Home screen** directly).
3. Tap **Home screen**, then confirm with **Add**.

**Chrome (Android):**

1. Tap the three-dot menu (top-right).
2. Tap **Install app** (or **Add to Home screen**), then **Install**.

**Safari (iPhone, in case he ever switches):**

1. Tap the **Share** button (the square with an arrow).
2. Scroll down and tap **Add to Home Screen**, then **Add**.

The icon now opens full-screen like a normal app.

---

## Part 10 of 11 — Daily use (what's automatic, what he taps)

**Automatic — nothing to do:**

- Every hour, new mail is fetched, summarized in one line, and sorted into categories with deadlines and action flags.
- Every morning at the configured hour, a digest email arrives in his own inbox: what came in, what needs him, upcoming deadlines, and a short brief.

**What he taps:**

- Open the app → the inbox list shows one line per email; tap one to read the full email (fetched live, always current).
- Tap **Draft reply** on any email → the app writes a reply in his voice → he edits if he wants → the app shows exactly who it's going to, the subject, and the text → he taps to confirm sending. **Nothing is ever sent without that tap.**
- Compose from scratch: type a short instruction ("tell Ahmed the meeting moves to Tuesday 3pm") and the app writes the full email — same confirm-before-send screen.
- The agent never deletes or archives anything, ever. The real mailbox stays exactly as it is.

---

## Part 11 of 11 — Troubleshooting

| Problem | What's happening | Fix |
|---|---|---|
| Passcode not accepted | Typo, or `APP_PASSCODE` in Netlify differs from what you're typing | Check for extra spaces; verify the value in Netlify → Site configuration → Environment variables; after changing it, Deploys → Trigger deploy |
| App says "Gmail is not connected" | Google revoked access — most often because the bridge account's password was changed, or access was removed at myaccount.google.com | Open Settings → tap **Connect Gmail** → sign in again (including the Advanced → Continue click-through) |
| Morning digest didn't arrive | The schedule didn't run, the hour/timezone is off, or it landed in spam | 1) GitHub repo → **Actions** tab → check the latest `mail-agent-scheduler` run is green (if workflows show as disabled, click **Enable workflow** — happens after 60 quiet days). 2) Check the spam folder and mark it Not spam once. 3) Check Settings → digest hour and timezone. Remember GitHub's timer can run a few minutes late |
| The "Google hasn't verified this app" warning appears again | Access was revoked and you're reconnecting, or the consent screen was left in "Testing" | Click **Advanced** → **Go to CEO Mail Agent (unsafe)** → **Continue** — same as the first time. If it happens repeatedly every ~7 days, the app was never published: Part 4 step 11 (**Publish app**) |
| Drafts sound generic, not like him | The writing-style profile is missing or was built from too little mail | Settings → tap **Rebuild writing style** (do this again occasionally as more sent mail accumulates) |
| Emails stuck on "Summarizing…" | The free AI quota was momentarily hit — nothing is lost | Do nothing. The next hourly run picks them up automatically and finishes the summaries |
| App feels stale / shows old data | The installed app cached an old screen | Pull down to refresh, or close it fully and reopen. After an update was deployed, closing and reopening once loads the new version |
| Everything errors / "database" messages | The free Supabase project paused itself after a long period with no activity (it warns you by email first; the hourly schedule normally prevents this) | Go to **supabase.com** → open the project → click **Restore project** — one click, data intact. Then wait for the next hourly run |
| Green checks in GitHub Actions but nothing updates | `SITE_URL` secret points at the wrong address, or `CRON_SECRET` doesn't match Netlify's | Recheck both values in GitHub → Settings → Secrets and variables → Actions, and compare with Netlify's environment variables |

**When you're done:** delete the temporary notes file with the keys from your computer. Every secret now lives only in Netlify (and `CRON_SECRET` also in GitHub), which is exactly where they belong.
