# CardioLocums AI

Production-ready SaaS for locum tenens recruiters to discover cardiologist leads from **public data only**, enrich profiles with AI, score opportunities, draft compliant outreach (human-reviewed), and manage CRM pipelines.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, ShadCN-style UI |
| Backend | Next.js API Routes |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| AI | OpenAI API (optional mock fallback) |
| Automation | n8n-compatible webhooks |
| Deploy | Vercel |

## Features

- **Physician database** — full schema with NPI, specialty, lead score, CRM status
- **Lead discovery** — NPI Registry, CMS Physician Compare, optional state board / hospital / group practice JSON feeds
- **AI research agent** — employer, affiliations, publications, summaries (no fabricated contact info)
- **Lead scoring** — weighted 0–100, admin-editable weights
- **Recruiter dashboard** — metrics, charts, top opportunities, follow-up recommendations
- **Outreach drafts** — email, LinkedIn, voicemail — **never auto-sent**
- **CRM pipeline** — drag-and-drop Kanban across 9 stages
- **Advanced search** — filters + keyword
- **Activity timeline** — emails, calls, notes, follow-ups
- **n8n webhooks** — `discovery.run`, `research.run`, `physician.status`

## Quick start

### 1. Clone and install

```bash
cd "Ai Lead Generator"
npm install
cp .env.example .env.local
```

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run migration SQL in the SQL editor (or use CLI):

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

3. Run seed data:

```bash
# In Supabase SQL editor, paste contents of supabase/seed.sql
```

4. Copy **Project URL**, **anon key**, and **service role key** into `.env.local`.

5. Enable Email auth in Supabase Dashboard → Authentication.

   **If signup returns 500:** open Supabase → **Logs** → Postgres, then run **both** migration files in SQL Editor. Also run `20250605000001_fix_signup_profile.sql`. Optionally disable **Confirm email** under Authentication → Providers → Email while testing.

6. Promote first admin (after signup):

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'you@agency.com';
```

### 3. OpenAI (optional)

Set `OPENAI_API_KEY` for AI research, outreach drafts, and follow-up suggestions. Without it, template/mock responses are used.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See [.env.example](.env.example). All secrets are externalized — nothing is hardcoded.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Webhooks / server tasks |
| `OPENAI_API_KEY` | No | AI features |
| `WEBHOOK_SECRET` | Yes (prod) | n8n webhook auth header |
| `STATE_BOARD_API_URL` | No | State medical board JSON API |
| `HOSPITAL_DIRECTORY_FEED_URL` | No | Hospital provider JSON feed |
| `GROUP_PRACTICE_INDEX_URL` | No | Practice group JSON index |

## API overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/physicians` | GET | Search/filter physicians |
| `/api/physicians/[id]` | GET/PATCH | Profile + research |
| `/api/physicians/[id]/status` | PATCH | CRM stage update |
| `/api/discovery` | GET/POST | List sources / run collectors |
| `/api/research/[id]` | POST | AI research agent |
| `/api/outreach` | POST | Generate draft (not sent) |
| `/api/outreach/list` | GET | List drafts |
| `/api/outreach/[id]/approve` | POST | Approve for manual send |
| `/api/scoring/weights` | GET/PATCH | Admin scoring config |
| `/api/dashboard` | GET | Metrics + recommendations |
| `/api/activities` | GET/POST | Timeline |
| `/api/follow-up/[id]` | POST | AI follow-up suggestion |
| `/api/webhooks/n8n` | POST | Automation (header: `x-webhook-secret`) |

### n8n webhook example

```json
POST /api/webhooks/n8n
Headers: x-webhook-secret: YOUR_WEBHOOK_SECRET

{
  "event": "discovery.run",
  "data": { "source": "npi_registry", "state": "FL" }
}
```

## Architecture

```
src/
├── app/              # Next.js App Router pages + API routes
├── components/       # UI (dashboard, pipeline, physicians, admin)
├── hooks/            # Client data hooks
├── lib/              # Utils, scoring, dedup, Supabase, rate limit
├── repositories/     # Data access (repository pattern)
├── services/         # External APIs (NPI, CMS, OpenAI, discovery)
│   ├── npi/
│   ├── cms/
│   ├── openai/
│   └── discovery/    # Source adapters + orchestration
└── types/
```

Dependency injection via `src/services/container.ts`.

## Testing

```bash
npm test              # Vitest unit + integration
npm run typecheck
npm run lint
```

## Deploy to Vercel

1. Push repo to GitHub.
2. Import project in [Vercel](https://vercel.com).
3. Add all environment variables from `.env.example`.
4. Deploy. Set Supabase redirect URLs to `https://your-app.vercel.app/**`.

```bash
npm run build
```

## Data ethics & compliance

- Uses **public** APIs (NPI Registry, CMS datasets). No HTML scraping of hospital sites by default.
- Public records rarely include verified personal emails — plan on recruiter-sourced contact data.
- Outreach is **draft-only** until a human approves and sends via your email/phone/LinkedIn tools.
- Configure CAN-SPAM/TCPA and state prospecting rules for your agency.

## License

Proprietary — CardioLocums AI. All rights reserved.
