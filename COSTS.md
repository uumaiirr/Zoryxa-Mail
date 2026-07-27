# Costs

Every service this app touches runs on a genuinely free tier. The numbers below were verified against the official documentation on **27 July 2026**.

| Service | Free tier (verified 27 Jul 2026) | What this app actually uses | Headroom |
|---|---|---|---|
| **Gemini API** (default LLM) | Free key from AI Studio, no credit card. `gemini-3.5-flash` ≈ 15 requests/min, 1,500 requests/day. Google no longer publishes a static limits table — your project's authoritative numbers are shown at https://aistudio.google.com/rate-limit | ~25–30 requests/day for a ~100-email/day inbox (summaries are batched; plus digest and on-demand drafts) | ~50× |
| **Groq** (optional alternative LLM) | Free plan, no card. `llama-3.3-70b-versatile`: 30 req/min, 1,000 req/day, 12,000 tokens/min (https://console.groq.com/docs/rate-limits) | Same ~25–30 requests/day if selected as provider | ~30× |
| **Netlify** (hosting + API) | Free plan is credit-based since 2026: 300 credits/month. Bandwidth 20 credits/GB, functions 10 credits/GB-hour, web requests 2 credits/10k, production deploys 15 credits each. Function timeout 60 s. When credits run out, features pause until next month — no surprise charges | Roughly 20–60 credits/month: one user, small pages, ~50 function calls/day from the hourly cron, occasional deploys | ~5–10× |
| **Supabase** (database) | 500 MB database, 5 GB egress, 2 free projects. Free projects pause after ~7 days with no database activity; one-click restore within 1 year | A few MB of new rows per month (summaries and metadata only — never email bodies). The hourly cron keeps the project active, so it never pauses in normal operation | ~100× |
| **Gmail API** | Free ("no additional cost"). Quotas: 1.2M units/min per project, 6,000 units/min per user. messages.send = 100 units, messages.get = 20, messages.list = 5 | A few thousand units per **day** | Vast — daily usage is under a minute's worth of quota |
| **GitHub Actions** (scheduler) | Unlimited minutes on public repositories (2,000 min/month on private). Cron is best-effort; on public repos schedules auto-disable after 60 days of repo inactivity (one-click re-enable) | ~2 minutes/day (~60 min/month) | Unlimited on a public repo |
| **Cloud Pub/Sub** (real-time arrival, optional) | First 10 GB of message throughput per month free | Gmail push notifications are ~1 KB each; ~100 emails/day ≈ 3 MB/month | ~3,000× |
| **TOTAL** | | | **$0 / month** |

## The math, for a ~100-email/day inbox

**LLM calls (the scarcest resource):** the sync engine summarizes emails in batches, not one call per email. A 100-email day spread over 24 hourly runs needs roughly 15–20 batch summarization calls, plus 1–2 calls for the morning digest narrative, plus a handful of on-demand calls when the CEO drafts replies or rebuilds his style profile. Call it **25–30 requests/day against a 1,500/day limit** — about 2% of quota. Even a 500-email day wouldn't get close. Rate spikes within a single run are absorbed by the built-in retry-with-backoff.

**Gmail quota units:** 24 hourly syncs × (one `messages.list` at 5 units + ~100 `messages.get` at 20 units spread across the day) ≈ **2,100–3,000 units/day**, plus 100 units for the single digest send and ~20 units each time the CEO opens an email (bodies are fetched live). The per-user allowance is 6,000 units *per minute* — this app uses less than one minute's allowance per **day**.

**Netlify credits:** functions here are tiny (a fraction of a GB-second each). The hourly cron makes ~50 function invocations/day; the CEO's own browsing adds a few hundred requests/day. Monthly total: web requests ≈ 30–50k (≈ 6–10 credits), function compute ≈ a few credits, bandwidth well under 1 GB (≈ 10–20 credits), plus 15 credits per production deploy when you update the code. Realistically **20–60 of the 300 monthly credits**.

**Supabase storage:** one email row is metadata plus a one-line summary — roughly 1–2 KB. 100 emails/day ≈ **3–6 MB/month** against a 500 MB database. Years of headroom, and old rows can always be pruned.

## What happens at the limits

- **LLM rate limit hit (HTTP 429):** the call is retried with exponential backoff inside the same run; anything still unfinished stays queued. Affected emails simply show "Summarizing…" until the next hourly run completes them. Nothing crashes, nothing is lost, no email is skipped.
- **Netlify credits exhausted:** the site pauses until the monthly reset. No charges appear — the free plan cannot generate a bill. (At this app's usage level this should never happen.)
- **Supabase project paused:** only occurs after ~7 days of zero database activity, which the hourly scheduler prevents. If it ever does pause (say the scheduler was off for weeks), restoring is one click on the Supabase dashboard and all data is intact.
- **GitHub schedule auto-disabled** (60 quiet days on the repo): GitHub emails a notice; re-enabling is one click under the repository's Actions tab. A free fallback if you ever want one: https://cron-job.org (free, 1-minute granularity, 30 s request timeout) can call the same two endpoints with the `x-cron-secret` header.

## The only real caveats

1. **Gemini's free tier may use your prompts to improve Google's products.** Email content is sent to the model for summarizing and drafting, so if that ever becomes a concern, switch the provider to **Groq** in the app's Settings — it's an equally free, one-tap swap and the app is built for both.
2. **Keep the GitHub repository public.** That's what makes the hourly scheduler free without limits. There are no secrets in the code, so public is safe by design.
3. **A custom domain is the only possible cost** — and it's optional. The free `*.netlify.app` address works perfectly; a domain (~$10–15/year, one-time annual) is purely cosmetic.
