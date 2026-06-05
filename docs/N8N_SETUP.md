# n8n + Gmail setup — CardioLocums AI

End-of-day workflow:

1. **n8n** runs discovery automatically (e.g. 6 PM daily).
2. You open the **Dashboard → New leads today**.
3. Open a physician → **Generate email** draft (AI).
4. Add their **email** if missing → **Approve & Send** (sends from your Gmail).

---

## Part 1 — Gmail App Password (send from matthewfuller389@gmail.com)

Google does not allow your normal password in apps. Use an **App Password**:

1. Go to [Google Account](https://myaccount.google.com/) → **Security**.
2. Turn on **2-Step Verification** (required).
3. Search **App passwords** → Create app → name it `CardioLocums` → copy the 16-character password.

Add to **Vercel** → Project → **Settings** → **Environment Variables**:

| Variable | Value |
|----------|--------|
| `GMAIL_USER` | `matthewfuller389@gmail.com` |
| `GMAIL_APP_PASSWORD` | your 16-char app password (no spaces) |
| `EMAIL_FROM_NAME` | `Matthew Fuller` (optional) |

Redeploy after saving.

For local dev, add the same to `.env.local` (never commit this file).

---

## Part 2 — Vercel / app variables (if not already set)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `OPENAI_API_KEY` | for AI drafts |
| `SERPER_API_KEY` | free at [serper.dev](https://serper.dev) — **recommended** for finding public emails |
| `WEBHOOK_SECRET` | long random string (same as n8n) |
| `RECRUITER_*` | optional — defaults to Matthew Fuller |

---

## Part 3 — Import n8n workflow (daily discovery)

### Option A — Import JSON file

1. Open your [n8n](https://n8n.io) instance (cloud or self-hosted).
2. **Workflows** → **Import from file**.
3. Choose `n8n/cardiolocums-daily-discovery.json` from this repo.
4. Open the workflow → **Settings** (or n8n **Variables**):

   | Variable | Value |
   |----------|--------|
   | `CARDIOLOCUMS_APP_URL` | `https://ai-lead-generation-pink.vercel.app` (no trailing slash) |
   | `WEBHOOK_SECRET` | same value as in Vercel |
   | `DISCOVERY_STATE` | `FL` (or your target state) |

   > If your n8n version uses **Credentials** instead of Variables, edit the HTTP node URL and header manually.

5. In the **HTTP Request** node, set:
   - **URL:** `https://ai-lead-generation-pink.vercel.app/api/webhooks/n8n`
   - **Header:** `x-webhook-secret` = your `WEBHOOK_SECRET`
   - **Body (JSON):**
     ```json
     {
       "event": "discovery.run",
       "data": { "state": "FL", "runAll": true }
     }
     ```

6. **Activate** the workflow (toggle on).

Default schedule: **6:00 PM every day** (cron `0 18 * * *`). Change in the Schedule Trigger node.

### Option B — Build manually in n8n

1. Add **Schedule Trigger** → Cron `0 18 * * *`.
2. Add **HTTP Request**:
   - Method: `POST`
   - URL: `https://YOUR-APP.vercel.app/api/webhooks/n8n`
   - Header: `x-webhook-secret: YOUR_SECRET`
   - Body JSON: `{ "event": "discovery.run", "data": { "state": "FL", "runAll": true } }`
3. Connect Schedule → HTTP Request → Activate.

### Test the webhook

```bash
curl -X POST "https://ai-lead-generation-pink.vercel.app/api/webhooks/n8n" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  -d "{\"event\":\"discovery.run\",\"data\":{\"state\":\"FL\",\"runAll\":true}}"
```

Check **Dashboard → New leads today** after a successful run.

### AI score + email nodes (auto-continue)

Scoring processes **12 physicians per background chunk**; email enrichment uses **4 per chunk** (slower — web search + page fetch). n8n gets an immediate `status: "started"` response; the app **automatically chains** more calls until finished. Use `all_pending: true` to process your full database (not just today).

**Score leads:**
```json
{
  "event": "research.batch",
  "data": { "all_pending": true, "limit": 12 }
}
```

**Find emails:**
```json
{
  "event": "enrichment.emails",
  "data": { "all_pending": true, "limit": 4 }
}
```

n8n only needs **one** HTTP call per step. The response returns immediately with `status: "started"`; work continues in the background and auto-chains until `remaining` is 0.

**Hobby Vercel plan:** built-in Vercel Cron only allows **once per day**, so frequent continuation uses **n8n** instead. Import `n8n/cardiolocums-email-continuation.json` — it calls the email webhook **every 30 minutes** until your database is processed. Self-HTTP continuation inside the app is disabled (`508 INFINITE_LOOP_DETECTED` on Vercel).

**Pro Vercel plan (optional):** you can add crons back to `vercel.json` and set `CRON_SECRET` instead of using the n8n continuation workflow.

### Optional: today-only scope

```json
{
  "event": "enrichment.emails",
  "data": { "today_only": true, "limit": 12 }
}
```

---

## Part 4 — Your daily click workflow

| Step | Where | Action |
|------|--------|--------|
| 1 | Dashboard | Review **New leads today** |
| 2 | Dashboard | Click **AI find emails** (uses OpenAI + optional Serper web search) |
| 3 | Physician profile | Verify **AI found** email or edit manually |
| 4 | Outreach | **Generate email** draft |
| 5 | Outreach | Review text → **Approve & Send** |

Email sends from **GMAIL_USER** via Gmail SMTP. Activity is logged on the physician timeline; status moves to **Contacted** when applicable.

---

## What n8n does NOT do (by design)

- Does **not** auto-send emails (you click **Approve & Send**).
- Does **not** auto-generate drafts (you click **Generate email**).
- Does **not** find personal emails for most physicians without **SERPER_API_KEY** + public listings
- AI **never guesses** emails — only extracts from public web/hospital pages when found.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Approve & Send → Gmail not configured | Set `GMAIL_USER` + `GMAIL_APP_PASSWORD` on Vercel, redeploy |
| No email on file | Add email on physician profile |
| n8n 401 | `x-webhook-secret` must match Vercel `WEBHOOK_SECRET` |
| n8n runs but no leads | Check Vercel function logs; try `state` with data (e.g. `FL`) |
| **AI find emails → Gateway timed out** | Re-import workflow JSON (limit `4`, timeout `120000`). Response is instant; work runs in background. |
| **508 INFINITE_LOOP_DETECTED in Vercel logs** | Old self-HTTP continuation. Deploy latest code; use n8n `cardiolocums-email-continuation.json` on Hobby plan. |
| **Vercel deploy blocked — Hobby cron limit** | Remove `crons` from `vercel.json` (already done). Use n8n every-30-min workflow for email continuation. |
| `DEP0169 url.parse()` warning | Harmless Node.js deprecation from n8n or a dependency — safe to ignore. |
| Gmail auth failed | Regenerate App Password; no spaces in env var |
| Email in spam | Normal for cold outreach — warm up domain / use professional copy |

---

## Optional APIs (not required for basic flow)

These only add more discovery sources when configured:

- `STATE_BOARD_API_URL`
- `HOSPITAL_DIRECTORY_FEED_URL`
- `GROUP_PRACTICE_INDEX_URL`

NPI Registry + CMS work without them.
