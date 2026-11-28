what# Backend pilot tracker

What's done and what's left before the API is ready for the pilot cohort (~25 students). Detail and reasoning for every item live in [`architecture.md`](architecture.md); task ids (T1–T12) and decision ids (D…) point there.

**How to use this file:** tick an item in the same PR that finishes it, and add the PR number. Add new work under the step it belongs to. Founder answers that unblock work go in [Waiting on founders](#waiting-on-founders).

Legend: `[x]` done · `[ ]` to do · ⛔ blocked (reason given)

Last updated: 2026-11-28 (hosted project linked and migrated)

---

## Progress

| Step | What | Status |
|---|---|---|
| 0 | Scaffold, CI, `/health` (T1) | ✅ done (#3) |
| 1 | Foundation: database, auth, `/me`, hosted Supabase | 🟡 code, hosted DB, hardening and connection done; first admin, FE login left |
| Later | SMTP, prod project, sign-up mode | ⏸ founder questions 5, 6, 7 |
| 2 | Student read side + onboarding | ⬜ not started |
| 2b | Content: lessons, materials, uploads (T10) | ⛔ founder questions 8, 9, 12 |
| 3 | Payments (T6) | ⛔ founder questions 1, 2, 5 |
| 4 | Submissions and reviews (T5, T11) | ⬜ not started |
| 5 | Admin | ⬜ not started |
| — | Cross-cutting: API contract, rate limits, ops | ⬜ not started |
| 6 | Deploy to GCP (Cloud Run) | ⏸ at the end, by the founders |

Recommended order while founder answers are pending: **finish step 1 → step 2 → step 4 → step 5**, then 2b and 3 as answers arrive, and step 6 (deploy) last. Until then everything runs locally against `supabase start` or the hosted `d4y` project. Step 4 comes before 3 because review rounds can be granted by an admin (`POST /admin/credits`) before Stripe exists.

---

## Step 0 · Scaffold ✅

- [x] TypeScript, ESLint layering rules, Vitest, folder skeleton, `GET /health`, Dockerfile, CI (T1, #3)

## Step 1 · Foundation 🟡

**Done (#4)**
- [x] Full schema from section 4 except content: identity, catalog/payments, access, learning, mentoring, reference (T4)
- [x] RLS on every table, no policies, no grants to browser roles; tested through PostgREST
- [x] Signup trigger: default student; staff role only via invite (GoTrue `invited_at` path); squatter invites refused
- [x] Append-only `credit_ledger` / `audit_log`; balance can't go negative under concurrency
- [x] Auth middleware (Supabase JWKS, asymmetric only, role from `profiles`, bans enforced, 503 on Auth outage)
- [x] `GET /me`
- [x] postgres.js client (shared pooler, TLS, CA required in prod)
- [x] Local stack: `supabase start`, seed with admin / mentor / student test accounts
- [x] CI `database` job (migrations, schema lint, integration tests, generated-types check)
- [x] Runbook for hosted setup ([`runbook.md`](runbook.md))
- [x] Supabase CLI installed (half of T2)

**Left**
- [x] `supabase login` to the D4Y account, `supabase link` to project `d4y` (`hehknlngijfmrxiqczoh`)
- [x] Project recreated in `ca-central-1` (the first one was in us-west-2)
- [x] Asymmetric JWT signing keys: JWKS serves an ES256 key
- [x] Dashboard hardening: legacy API keys disabled, legacy HS256 secret revoked, Data API off, email confirmation on, anonymous sign-ins off, email the only provider, site/redirect URLs on `localhost:5173`, SSL enforced
- [ ] Password policy (min 10, letters + digits) and secure password change: confirm saved
- [x] `.env` with the hosted pooler `DATABASE_URL` + CA certificate; certificate-verified connection works (TLS 1.3, `aws-1-ca-central-1.pooler.supabase.com:6543`)
- [x] Migrations pushed to `d4y` (3 migrations, no seed). Verified: 21 tables all with RLS, no browser-role grants or callable functions, 8 program modules, 3 auth triggers, advisors clean, public key gets 401 on every table
- [x] First admin: invited from the dashboard, promoted with the runbook §4 SQL (one profile, role `admin`)
- [ ] Site URL saved as `http://localhost:5173` (the first invite landed on `localhost:3000`)
- [ ] FE (d4yfe): Supabase login + role routing, calling `GET /me`

## Step 2 · Student read side ⬜

- [ ] `POST /me/onboarding` (track, cycle; D18)
- [ ] `GET /student/home` (one request for the whole page, section 11)
- [ ] `POST /student/progress` (chapter_progress; D19)
- [ ] `GET /student/assignments`
- [ ] `GET /student/sessions` (events + mentor scheduling link; D2)
- [ ] `GET /student/schools` (cached, `Cache-Control`)
- [ ] `GET /student/feedback`, `GET /student/feedback/:id`
- [ ] Status labels computed by the API (not-started, in-review, feedback-ready, revise, due-soon, overdue)
- [ ] Load pilot data: cohort, assignments per cohort, events, schools (Studio for schools)
- [ ] FE (T8): stable `slug` on every chapter; replace booking pages with scheduling links; then re-seed `program_modules` from the FE if slugs change

## Step 2b · Content (T10) ⛔ founder questions 8, 9, 12

- [ ] `lessons` + `materials` migrations, `materials` bucket (25 MB, MIME list, private)
- [ ] One-off seed script from FE `modules.ts` (unpublished where no video/file yet)
- [ ] `content` module: video-link parser (Vimeo `h=` hash, YouTube, Mux), lesson code derivation (D37), access rules (D31, D34, D39)
- [ ] `GET /student/modules/:slug`, `GET /student/materials/:id/download`, `GET /student/resources`
- [ ] Admin content endpoints: list, lessons CRUD, materials upload-url → confirm → create/replace/delete, `PUT /admin/content/order` (D35)
- [ ] FE (T12): Content page, embedded player, CSP in `firebase.json` / `vercel.json`

## Step 3 · Payments (T6) ⛔ founder questions 1, 2, 5

- [ ] Stripe CLI installed (other half of T2)
- [ ] Products and prices in Stripe (test mode), `products` / `product_modules` rows
- [ ] `GET /products` (cached)
- [ ] `POST /payments/checkout`: cohort lock, seat count, reuse pending (D15), order first, card only (D17)
- [ ] `POST /webhooks/stripe`: raw body, signature, dedupe inside the grant transaction (D6), rebuild missing order (O2), expired and refunded events
- [ ] Stripe CLI end-to-end test; alert on non-2xx webhook responses

## Step 4 · Submissions and reviews (T5, T11) ⬜

- [ ] `access` module (only writer of enrollments + credit_ledger): `grantProduct`, `grantModule`, `useCredit` with the student row lock (D12, D16, D22)
- [ ] `submissions` + `feedback` buckets (10 MB, MIME lists, private)
- [ ] `POST /student/assignments/:id/upload-url`, `POST /student/assignments/:id/submissions` (items match `answer_spec`, video-link host rules, confirmed paths; D29, D36, O4)
- [ ] Submit → spend a round → create review for primary mentor, due in 7 days (D16); 409 when no rounds left
- [ ] `GET /mentor/dashboard`, `GET /mentor/reviews`, `GET /mentor/reviews/:id` (own reviews only)
- [ ] `PUT /mentor/reviews/:id` (draft), `POST /mentor/reviews/:id/complete` (rubric checked against `program_modules`, logs volunteer hours)
- [ ] `POST /mentor/reviews/:id/feedback-upload-url` + `GET /student/reviews/:id/feedback-file` (D28, C4)
- [ ] `GET|POST /mentor/hours`
- [ ] Tests: credit race, mentor isolation, review state transitions (assigned → in_progress → completed / reassigned / cancelled)

## Step 5 · Admin ⬜

- [ ] `GET /admin/overview` (incl. review escalation computed on read; D4)
- [ ] `GET /admin/students`, `PATCH /admin/students/:id` (mentor, cohort)
- [ ] `GET /admin/mentors`, `PATCH /admin/mentors/:id`
- [ ] `POST /admin/mentors/invite`: write `invites`, then `inviteUserByEmail`; handle "account already exists" (squatter case, runbook §6)
- [ ] `GET /admin/reviews`, `POST /admin/reviews/:id/reassign`, cancel (returns the round)
- [ ] `POST /admin/enrollments` (hardship/admin seat, same cohort lock as checkout; D3, D7)
- [ ] `POST /admin/credits` (incl. one-on-one debits; D2)
- [ ] `audit_log` rows for admin actions
- [ ] FE (T8): admin manual grant form replaces the hardship page

## Cross-cutting ⬜

- [ ] API contract (T7): zod-to-openapi, `npm run openapi`, committed `openapi.json`, CI staleness check; FE `gen:api`
- [ ] Rate limits (T9): ~5/min checkout, 10/min upload-url, loose global limit
- [ ] DB statement timeout via a dedicated least-privilege API role (review note on #4)
- [ ] `SUPABASE_JWT_ISSUER` override if a custom Auth domain is used (review note on #4)
- [ ] Build repository row types from `database.types.ts` (review note on #4)
- [ ] FE repo: Node 20 → 24 (`TODOS.md`)
- [ ] Pilot-readiness pass: `/qa` on staging, a security review of the full API, restore-from-backup test on prod

## Later · when the founders answer ⏸

Set aside on 2026-11-28 until the founders decide. Nothing in steps 2–5 waits on these.

- [ ] **Q6 · Email sender domain** → set up custom SMTP in Supabase Auth (Authentication → Emails → SMTP), so confirmation, invite and reset emails reach students. Until then Supabase's built-in sender only delivers to members of the Supabase org.
- [ ] **Q7 · Supabase Pro for prod (~$25/month)** → decide whether `d4y` becomes dev/staging or prod, create the other project in `ca-central-1` on Pro (never paused, daily backups; D11), redo the dashboard hardening there, `supabase db push` to it, create its first admin.
- [ ] **Q5 · Invite-only or open sign-up** → if invite-only, turn off *Allow new users to sign up* (Authentication → Sign In / Providers); if open, leave it on. Also decides how checkout handles brand-new accounts (step 3).

## Step 6 · Deploy to GCP ⏸ at the end, by the founders

The founders will set up the GCP project later (2026-11-28). Until then the API only runs locally; nothing in steps 2–5 depends on Cloud Run. The Dockerfile and its CI smoke test already exist, so the image is ready.

- [ ] GCP project (owner and billing: founder question 14); Firebase added to the same project for FE hosting (D41)
- [ ] Artifact Registry repo + cleanup policy (keep ~10 images)
- [ ] Secret Manager: `DATABASE_URL` (shared pooler, port 6543), `SUPABASE_URL`, `DATABASE_CA_CERT`, later `SUPABASE_SECRET_KEY`, `STRIPE_*`
- [ ] Service account + Workload Identity Federation for GitHub Actions (no keys)
- [ ] `.github/workflows/deploy.yml`: build, push image, deploy Cloud Run (Toronto or Montréal, min 0, max 3, 512 MB, concurrency 80)
- [ ] First deploy; `GET /health` and `GET /me` work against the hosted project; `ALLOWED_ORIGINS` set to the FE origins
- [ ] Cost guards (T9): GCP budget alert, max instances 3
- [ ] Cloud Logging alert on non-2xx `/webhooks/stripe` (once payments exist)

---

## Waiting on founders

From [architecture.md section 10](architecture.md#10-open-questions-for-founders). Each answer unblocks the items marked with its number.

| # | Question | Blocks |
|---|---|---|
| 1 | Prices, currency, tax, Stripe account owner | Step 3 |
| 2 | Refund policy: does a refund remove access? | Step 3 |
| 5 | Invite-only or open sign-up? | Step 3, Auth sign-up setting |
| 6 | Email sender domain | Custom SMTP (step 1) |
| 7 | Approve Supabase Pro for prod (~$25/month) | Prod project |
| 8 | Video host and budget (Vimeo / YouTube / Mux) | Step 2b |
| 9 | Who manages content after launch | Step 2b |
| 10 | Mentor commented documents needed? | Feedback upload (step 4) |
| 11 | Video answers as links OK? | Video-link answers (step 4) |
| 12 | Free preview chapters? | Step 2b |
| 13 | Prototype features (booking, ratings, follow-ups…) in or out? | Scope check |
| 14 | Who owns GCP/Firebase and DNS | Step 6 (deploy), custom domain |
