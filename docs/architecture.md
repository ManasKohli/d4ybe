# D4Y backend: pilot architecture and database plan

Status: **reviewed (/plan-eng-review, 2026-11-18), ready to build step 0.** Scope is the **pilot cohort only** (about 25 students, a handful of mentors, 1–2 admins). Nothing here is for the full launch.

Sources: `d4yfe/README.md`, `d4yfe/CLAUDE.md`, `d4yfe/docs/d4y-program-proposal.md`, and the frontend contract in `d4yfe/src/types/index.ts` and `d4yfe/src/data/demo.ts` (every export there maps to a table or query).

Fixed constraints from the founders and the team:

- Express API (lightweight), deployed on **Google Cloud Run**
- **Supabase** for Postgres, Auth and file storage (not set up yet)
- **Stripe** payments are in scope for the pilot
- Frontend is a React + Vite SPA (already built against sample data). ~~Hosted on Vercel~~ *Superseded by D41:* production on **Firebase Hosting** in the same GCP project as the API; Vercel for dev and previews only

## Binding decisions

| ID | Decision | Answer |
|---|---|---|
| D2 | 1-on-1 sessions use a per-mentor scheduling link (Cal.com or Calendly). No booking tables or endpoints in the pilot. Admin tracks 1-on-1 credits and session volunteer hours by hand. | A |
| D3 | Hardship-seat applications run off-platform (a form). An admin grants an approved seat with `POST /admin/enrollments` (`source = hardship`). No hardship tables in the pilot. | A |
| D4 | No scheduled jobs in the pilot. Review escalation is computed when pages load (FE `features/admin/reviewAge.ts`). No Cloud Scheduler, no `/internal/jobs`. | A |
| D5 | Folder structure: feature modules with four layers (routes, service, repository, schemas). | A |
| D25 | **Lesson videos are hosted on a video platform, not in Supabase Storage.** Default: Vimeo with domain-level privacy (plays only when embedded on the D4Y site). Alternatives: YouTube unlisted, Mux. The DB stores `video_provider` + `video_ref`; admins paste a link and the API parses it. Only Vimeo domain-level privacy (with localhost and the Vercel preview domain on its allowlist) or Mux signed playback actually enforce D31 for the video itself; YouTube unlisted links can be shared (O10). **Allowlist (D41):** the Vimeo domain allowlist must include the prod custom domain and the Firebase default domains if used (`<project>.web.app`, `<project>.firebaseapp.com`), the Vercel preview domain, and `localhost`. | proposed, pending founder confirmation |
| D26 | **Lesson videos and materials move into the database (amends D8).** Module and chapter *structure* stays seeded by migration (`program_modules`, `chapter_slugs`, D8/D19). Lessons and materials become rows admins edit without a developer or a redeploy, owned by a new `content` module. Supersedes "program content stays in the frontend" in section 1 for videos and materials only; module text, outcomes, parts, rubrics and statuses stay in FE `src/data/`. D8's history in the ledger is unchanged. | proposed, pending founder confirmation |
| D27 | **One `materials` table also feeds the Resources library; the `resources` table is dropped.** A material with `library_category` set also appears in the library. Most library items (templates, workbooks, checklists) are the same files as chapter materials, so one row means one upload and one replace. | proposed, pending founder confirmation |
| D28 | **Every new upload uses the section 8 signed-URL pattern:** admin materials, mentor commented documents. The API makes the path, the browser uploads straight to Storage, then the API confirms the object exists before saving the row. | proposed, pending founder confirmation |
| D29 | **Student video answers are submitted as a link, not uploaded** (CASPer and interview practice). The student records on their phone or laptop, uploads to YouTube (unlisted), Vimeo, Loom or Google Drive, and pastes the link. The API accepts links from those hosts only. See section 8 for the size and cost trade-off. | proposed, pending founder confirmation |
| D30 | **Buckets and limits** (all private, ~5 min signed URLs): `submissions` 10 MB, `materials` 25 MB, `feedback` 10 MB. No video bucket (D29). Exact MIME lists are in section 8. | proposed, pending founder confirmation |
| D31 | **Content access:** students see only *published* lessons and materials for modules they're enrolled in; free preview chapters are an open question. Mentors upload commented documents only to their own assigned, not-yet-completed reviews. Only admins manage content. | proposed, pending founder confirmation |
| D33 | **A `content` module owns `lessons` and `materials`** (same pattern as `access`, D12): admin and student routes call `content.service`; nobody else touches those tables. | A (content review, 2026-11-18) |
| D34 | **Library visibility:** the Resources library shows published `library_category` materials from the student's enrolled modules, plus everything under `start-here` for every student (partner codes, general checklists). Downloads use the same check. | A (content review, 2026-11-18) |
| D35 | **Reorder is one call per chapter:** `PUT /admin/content/order` rewrites `sort_order` for one chapter's lessons or materials in one transaction. Confirmed by D40: it's the only way to reorder (`PATCH` no longer takes `sort_order`). | A (content review, 2026-11-18) |
| D36 | **A submission holds a list of answers:** `submission_items` (file, video link or typed text, each with a label). One submission is still one review and one round (D16), so CASPer's "2 video and 3 typed responses" is one submission. Assignments list the answers they expect in `answer_spec`. | A (content review, 2026-11-18) |
| D37 | **Lesson codes are derived on read, not stored:** `N.0` for the welcome lesson, `N.C` for a chapter's only lesson, `N.Ca`, `N.Cb` … by `sort_order` when a chapter has several. That's the FE's current rule. `lessons.code` is dropped. | A (content review, 2026-11-18) |
| D38 | **Workshop recordings are materials of kind `video`:** they reuse `video_provider` + `video_ref` and play in the portal's embedded player under the same privacy as lessons. | A (content review, 2026-11-18) |
| D39 | **Start here library items need a seat** (revises D34): `start-here` items show only to students with `student_profiles.cohort_id` set, so partner codes don't reach sign-ups who haven't joined. Enrolled-module items are unchanged. | A (content review, 2026-11-18) |
| D40 | **Keep D35** after the outside reviewer challenged it: because codes come from order (D37), admins need the reorder call. | A (content review, 2026-11-18) |
| D41 | **Production frontend on Firebase Hosting, in the same Google Cloud project as the Cloud Run API**, so production runs on one GCP bill (Firebase Hosting, Cloud Run, Secret Manager, Artifact Registry). Deployed from GitHub Actions on merge to `main`. **Vercel stays for dev and previews only.** The API stays on Cloud Run (Toronto) and data in Supabase `ca-central-1`; the static frontend holds no student data, so PIPEDA residency is unchanged. Reason: billing simplicity, not a problem with Vercel. Details in sections 7–9. | A (team decision, 2026-11-18) |

D32 is unused: in the content review it numbered the "run /office-hours first?" setup question, which records no decision.

## Not in pilot scope

- In-app booking, mentor availability, session reminder emails (D2)
- In-app hardship applications and blind review (D3)
- Scheduled jobs and escalation emails (D4)
- Email sending from the API. Supabase Auth still needs a custom SMTP provider for its own emails (configured in Supabase, not in API code).
- Package upgrades, extra review-round purchases (pending founder answers, section 10)
- Student video uploads to D4Y storage (D29: links instead)
- Quiz and practice scoring, feedback helpfulness ratings, follow-up messaging (section 10 question 13)

---

## 1. How the pieces fit

```
 Browser (React SPA: Firebase Hosting in prod, Vercel for dev/previews; D41)
   │  1. sign in / sign up ─────────────────────►  Supabase Auth
   │  2. calls the API with the user's sign-in token (JWT)
   │  3. uploads files straight to Storage with a signed URL from the API
   ▼
 Express API (Cloud Run, Toronto or Montréal region)
   ├─ checks the token against Supabase's public keys (JWKS, cached)
   ├─ reads and writes Postgres through Supabase's SHARED pooler (IPv4)
   ├─ Supabase Storage: issues short-lived upload/download links
   └─ Stripe: creates Checkout Sessions; receives webhooks at /webhooks/stripe

 Supabase project (Canadian region, ca-central-1)
   ├─ Auth (users and sessions; asymmetric JWT signing keys turned on)
   ├─ Postgres (all app data; RLS on, no policies, so only the API can read it)
   └─ Storage (private buckets: submissions, materials, feedback; D30)

 Video platform (Vimeo by default, D25): lesson videos, embedded in the portal by ref
 Student-owned video hosts (YouTube unlisted, Vimeo, Loom, Drive): practice answers, by link (D29)

 Outside the app for the pilot: Cal.com/Calendly links (1-on-1s), a form (hardship seats)
```

Who owns what:

- **Supabase Auth**: accounts, passwords, email verification and resets. The frontend talks to it directly.
- **Firebase Hosting (D41)**: serves the production frontend's static files from the same GCP project as the API. No student data lives there, so data residency is unchanged. Vercel serves dev and preview builds only.
- **Express API**: the only thing that touches app data. It enforces roles (student, mentor, admin) and "mentors see only their students".
- ~~**Program content stays in the frontend's `src/data/`** (module text, statuses, escalation rules).~~ *Superseded for videos and materials by D26.* The backend's only copy of the module list and rubric criteria is the `program_modules` table, seeded by a migration (D8). Every module reference is a foreign key to it. When the FE changes a module or rubric, add a migration in the same week.
- **Program structure and copy stay in the frontend's `src/data/`** (module text, outcomes, public parts, rubrics, statuses, escalation rules), with module and chapter slugs mirrored in `program_modules` (D8, D19).
- **Lesson videos and materials live in the database** (`lessons`, `materials`), owned by the `content` module. Admins add and replace them from the admin Content page with no redeploy (D26). Video files sit on the video platform (D25); material files sit in the `materials` bucket.
- **Chapter items that point to other features stay in the FE structure**, not in `materials`: assignments, bookings, live sessions, surveys, and the written summary and callouts. They describe the program, they aren't uploaded files.

## 2. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Language | TypeScript (strict), ESM | Frontend is strict TS; its `src/types` is the contract |
| Framework | Express 5 (5.3.0 installed) | Async errors handled natively |
| Validation | zod for requests and env at startup | Fail fast on bad input or missing config |
| DB access | **postgres.js** (D9): parameterized tagged-template SQL in repositories; row types from `supabase gen types typescript` (regenerated after each migration, CI fails if stale). These types document row shapes; nothing checks SQL against them, so every repository query must be covered by an integration test (O13). Connects via Supabase **shared pooler**, transaction mode: host `aws-*-ca-central-1.pooler.supabase.com`, port 6543, `prepare: false` | Real transactions (needed by the Stripe webhook). The direct host `db.<ref>.supabase.co` and the dedicated pooler are IPv6-only without a paid add-on; Cloud Run egress is IPv4 by default |
| Migrations | Supabase CLI (`supabase/migrations/*.sql`) + `seed.sql` | Same tool for local DB and prod |
| supabase-js | Only Storage signed URLs and Auth admin (invites) | Secret key (`sb_secret_…`) held only by the API |
| Token check | jose + Supabase JWKS (`/auth/v1/.well-known/jwks.json`), check issuer and audience | Local verification, no shared secret |
| RLS | Enabled on every table, no policies | Publishable key cannot read tables via the auto-generated REST API; API role bypasses RLS |
| Logging | pino-http, JSON to stdout | Cloud Logging picks it up; never log submission text or tokens |
| Files | Browser uploads directly to Storage via signed upload URL | Keeps files off Cloud Run (32 MB request cap) |

## 3. Folder structure (D5)

```
d4ybe/
  src/
    server.ts                start the server, graceful shutdown on SIGTERM
    app.ts                   build the Express app (middleware order below)
    routes/
      index.ts               route registry: every feature router is mounted here, nowhere else
    config/
      env.ts                 zod-checked env
    db/
      client.ts              postgres.js pool (max ~5 per instance, prepare: false)
      database.types.ts      generated by `supabase gen types typescript` (do not edit)
    lib/
      supabase.ts            storage + auth admin
      stripe.ts
      logger.ts              pino
      http-logger.ts         pino-http: one line per request, no headers/bodies/query strings
    middleware/
      auth.ts                verify JWT → req.user = { id, role }
      require-role.ts
      validate.ts            zod → 400
      error-handler.ts       one error shape: { error: { code, message } }
    errors/
      app-error.ts
    types/
      express.d.ts           req.user typing
    modules/
      health/                GET /health (step 0)
      me/  student/  mentor/  admin/  payments/   (Stripe webhook lives in payments)
      access/                only writer of enrollments + credit_ledger (D12);
                             service + repository + schemas, no routes
      content/               only reader/writer of lessons + materials (D26, D33);
                             service, repository, schemas, video-link parser.
                             Admin and student routes call content.service; no routes
        <name>.routes.ts       HTTP: parse, call service, send response
        <name>.service.ts      rules: who may do what, status computation
        <name>.repository.ts   SQL only
        <name>.schemas.ts      zod request/response shapes (source of openapi.json, D13)
        <name>.test.ts         unit tests for the service
  tests/                     integration tests (supertest + local Supabase)
  supabase/
    migrations/  seed.sql  config.toml
  Dockerfile  .dockerignore  .env.example
  tsconfig.json  eslint.config.js  vitest.config.ts
  .github/workflows/  ci.yml  deploy.yml
```

Dependencies point one way: `routes → service → repository → db`. A module never imports another module's repository; if two modules need the same query, it moves to the module that owns the table. Each table has one owning module. Payments, admin and mentor change a student's access only by calling `access.service` (grantProduct, grantModule, useCredit) inside their own transaction (D12).

Middleware order: `helmet → cors(allowlist) → pino-http → /webhooks/stripe (express.raw) → express.json({limit:'100kb'}) → /health → auth → routers → 404 → error handler`

## 4. Database

All times `timestamptz` (UTC). Ids `uuid` unless noted. Module references are `module_slug text` foreign keys to `program_modules.slug` (D8).

### Program

| Table | Key columns | Notes |
|---|---|---|
| program_modules | slug (PK), title, rubric_criteria text[], chapter_slugs text[], sort_order | Seeded by migration: `start-here` + the seven FE slugs. Rubric scores are checked against `rubric_criteria`; progress against `chapter_slugs` (D19) |

### Content (D25–D27, owned by `content`)

| Table | Key columns | Notes |
|---|---|---|
| lessons | id, module_slug (FK program_modules), chapter_slug (null = the module's welcome `N.0`), ~~code text~~ (*dropped by D37: derived on read*), title, duration_min int, video_provider (vimeo/youtube/mux, null until recorded), video_ref text (null until recorded), sort_order int, published bool default false, updated_by (FK profiles), updated_at | Check: `published` requires `video_ref is not null`, so a lesson can be planned before it's recorded. `chapter_slug` must be in the module's `chapter_slugs`; Postgres can't foreign-key into an array, so `content.service` checks it and an integration test covers it. Index `(module_slug, chapter_slug, sort_order)`. A chapter with no published lesson is a "written summary only" chapter |
| materials | id, module_slug (FK program_modules), chapter_slug (null = module-wide), kind (pdf/template/sheet/image/link/quiz/practice/tool/video), title, storage_path (null for links), url (null for files), video_provider + video_ref (kind `video` only, D38), file_name, size_bytes, mime_type, track (null = both, Canada, US), library_category (null, or checklist/template/workbook/practice/recording/partner), sort_order int, published bool default false, updated_by (FK profiles), updated_at | Check: exactly one of `storage_path`, `url`, `video_ref` is set (`video_ref` only for kind `video`, D38). `chapter_slug` checked like lessons. Index `(module_slug, chapter_slug, sort_order)` and a partial index on `(library_category, module_slug) where published and library_category is not null` for the library. A non-null `library_category` puts the row in the Resources library and is its filter type (D27). Replacing a file writes the new object first, updates the row, then deletes the old object |

Seed: a one-off script turns the current FE `src/data/modules.ts` videos and materials into `lessons` and `materials` rows (unpublished where no video or file exists yet), so the pilot starts from today's outline. FE material types map to kinds as follows: `download` → `pdf`, `visual` → `image`, `spreadsheet` → `sheet`; `template`, `link`, `quiz`, `practice` and `tool` keep their names. `assignment`, `booking`, `live`, `survey`, `text` and `callout` are not materials (section 1).

**One copy (C1):** first split FE `Chapter.materials` into `links` (assignment, booking, live, survey: feature links that stay in the FE structure) and `materials` (uploaded files). Once the FE reads `GET /student/modules/:slug`, only the `videos` and `materials` arrays are deleted from FE `modules.ts`, in the same PR, so the database is the only copy of those (O2). Until then, the FE mock content is derived from those arrays rather than typed out a second time.

### Identity

| Table | Key columns | Notes |
|---|---|---|
| profiles | id (= auth.users.id), role (student/mentor/admin), full_name, email, stripe_customer_id, created_at | Created by a `security definer` trigger on `auth.users` insert. Role comes from a matching `invites` row, else `student` (D23). Role is never taken from sign-up metadata. For students the trigger also inserts `student_profiles` (D18). |
| invites | email, role (mentor/admin), invited_by, created_at, accepted_at | Written only by the API before `auth.admin.inviteUserByEmail` (D23) |
| student_profiles | user_id, track (Canada/US, null until onboarding), cycle, cohort_id (null until a seat is granted), primary_mentor_id | FE `Student`, `RosterEntry`. Track/cycle set by `POST /me/onboarding`; cohort_id set by `access.grantProduct` (D18). A row with cohort_id is a seat (D14) |
| mentor_profiles | user_id, title, monthly_review_limit, monthly_session_limit, scheduling_url, status (onboarding/active/paused), orientation_done_at, confidentiality_signed_at | Active only after both dates set. `scheduling_url` is the D2 booking link |

### Catalog and payments

| Table | Key columns | Notes |
|---|---|---|
| cohorts | name, capacity (25), starts_on, ends_on, is_open | Checkout refuses when full |
| products | slug, kind (package/module), name, stripe_price_id, review_credits, one_on_one_credits, active | Prices live in Stripe |
| product_modules | product_id, module_slug | What each product unlocks |
| orders | user_id, product_id, cohort_id, stripe_checkout_session_id (unique), stripe_payment_intent_id, amount_total, currency, status (pending/paid/refunded/expired), expires_at, over_capacity (bool), paid_at | One per Checkout Session. Pending orders until `expires_at` hold a seat (D7) |
| stripe_events | id (Stripe event id, PK), type, processed_at | Webhook idempotency |
| enrollments | student_id, module_slug, source (purchase/hardship/admin), order_id, granted_by, created_at, unique(student_id, module_slug) | Module access. `granted_by` = admin id for manual grants, null for Stripe (D22) |
| credit_ledger | student_id, kind (review/one_on_one), delta, reason, order_id/review_id, granted_by, created_at | Balance = sum(delta), changed only by `access.service` under the student row lock (D12, D16). One-on-one debits entered by an admin (D2). `granted_by` as on enrollments (D22) |

### Learning

| Table | Key columns | Notes |
|---|---|---|
| chapter_progress | PK(student_id, module_slug, chapter_slug), completed_at | Derives FE `Enrollment.done/current`, `startHereDone` |
| assignments | module_slug, title, instructions, cohort_id, due_at, needs_review, ~~answer_format~~ answer_spec text[] (D36: the expected answers in order, e.g. `{video_link,video_link,text,text,text}`; default `{file}`) | Seeded per cohort. CASPer and interview practice list `video_link` answers (D29). Labels ("Video 1", "Typed 2") come from the kinds |
| submissions | assignment_id, student_id, version, note, submitted_at | One per version; one review and one round each (D16, D36). ~~answer_kind, storage_path, file_name, video_url~~ moved to `submission_items` (D36) |
| submission_items | submission_id, sort_order, kind (file/video_link/text), label, storage_path, file_name, video_url, body | Exactly one of `storage_path`, `video_url`, `body` per kind. Files in `submissions/{student_id}/{submission_id}/{upload_id}/{file}`; links from an allowed host (D29). The set must match the assignment's `answer_spec` |
| reviews | submission_id, mentor_id, status (assigned/in_progress/completed/reassigned), assigned_at, due_at, scores jsonb, strengths, priorities text[], follow_up, feedback_file_path (nullable), feedback_file_name (nullable), completed_at | Completed review = FE `Feedback`. Escalation step computed on read (D4). `feedback_file_path` is the mentor's optional commented document in the `feedback` bucket (D28) |

FE status labels (not-started, in-review, feedback-ready, revise, due-soon, overdue) are computed by the API, not stored.

**Review lifecycle (D16):**

```
 student submits version N of an assignment that needs review
   │  one transaction, student_profiles row locked (select … for update)
   ├─ review balance = sum(credit_ledger.delta where kind = review)
   ├─ balance = 0 → 409 "no review rounds left" (nothing saved)
   └─ balance > 0 → insert submission → access.useCredit(−1)
                    → insert review(status = assigned, mentor = primary_mentor_id,
                                    due_at = submitted + 7 days)
 mentor saves draft → in_progress
 mentor completes   → completed (rubric scores checked against program_modules)
                    → volunteer_hours row (source = review)
                    → student may submit version N+1 ("revise"), which uses another round
 admin reassigns    → old review = reassigned, new review row for the new mentor (no new credit)
 admin cancels      → access.useCredit(+1) returns the round
```

### Sessions and mentoring

| Table | Key columns | Notes |
|---|---|---|
| events | title, kind (live/group/drop-in), module_slug, track, starts_at, duration_min, join_url | Workshops, office hours |
| volunteer_hours | mentor_id, date, activity, student_id, hours, source (review/manual), source_id | Auto-logged from completed reviews; sessions entered by hand (D2) |

### Reference

| Table | Key columns | Notes |
|---|---|---|
| ~~resources~~ | ~~title, kind, module_slug, track, storage_path or url~~ | *Superseded by D27:* library items are `materials` rows with `library_category` set |
| schools | name, place, degree, country, casper, interview, url, facts jsonb, verified_at | Edited in Supabase Studio for the pilot |
| audit_log (optional) | actor_id, action, target, at | Admin actions |

## 5. Payments (Stripe Checkout, hosted)

1. FE calls `POST /payments/checkout { productSlug }`.
2. API checks auth, product active, not already owned. Then, in one transaction holding the cohort row lock (`select … for update`):
   - **Reuse (D15):** if the student has an unexpired `pending` order for this product, return its Checkout URL and stop.
   - **Seats (D7 + D14):** seats held = cohort members (`student_profiles.cohort_id` set) + non-members with an unexpired `pending` order. A member passes; otherwise refuse when seats ≥ capacity. Admin grants (`POST /admin/enrollments`) take the same lock and the same check.
   - **Order first (O2):** insert the `pending` order (own id, `expires_at` = 30 min), then create the Checkout Session with `metadata.order_id`, `client_reference_id = user_id`, the Stripe customer, success/cancel URLs, `expires_at`, and **`payment_method_types: ['card']` (D17)**, then save the session id and URL on the order. If the Stripe call fails, the order is marked `expired`.
3. Student pays on Stripe, returns to `/portal?checkout=success`.
4. Webhook `checkout.session.completed`: verify signature (raw body); ignore it unless `payment_status = 'paid'` (D17). Find the order by `metadata.order_id`; if none exists, rebuild it from the session metadata instead of returning 500 (O2). Then in **one transaction**: insert into `stripe_events … on conflict do nothing`; if no row was inserted, commit and return 200 (already handled); otherwise order → paid, call `access.grantProduct` (enrollments, credits, sets `cohort_id`), commit, return 200. Any error rolls everything back and returns 500 so Stripe retries (R1/D6).
5. FE does not trust the redirect; it refetches `GET /me` briefly until access appears.

Also: `checkout.session.expired` → order expired; `charge.refunded` → order refunded, admin decides on access. Promo codes via `allow_promotion_codes`. Test mode until launch.

```
 FE                API                         Stripe                 Postgres
 │ POST /checkout  │                            │                       │
 │───────────────► │ check owned/capacity ──────┼──────────────────────►│ read
 │                 │ create session ───────────►│                       │
 │                 │ insert order(pending) ─────┼──────────────────────►│
 │ ◄── url ─────── │                            │                       │
 │ ── pay on Stripe ───────────────────────────►│                       │
 │                 │ ◄── webhook (signed) ───── │                       │
 │                 │ verify, dedupe, fulfil ────┼──────────────────────►│ 1 transaction
 │                 │ ── 200 ──────────────────► │                       │
 │ GET /me (poll) ►│ ───────────────────────────┼──────────────────────►│ read enrollments
```

## 6. API surface (pilot)

- Public: `GET /health`, `GET /products`
- Me: `GET /me` (profile, role, enrollments, credits), `POST /me/onboarding` (track, cycle) (D18)
- Student: `GET /student/home`, `POST /student/progress`, `GET /student/assignments`, `POST /student/assignments/:id/upload-url`, `POST /student/assignments/:id/submissions` (an `items[]` list matching the assignment's `answer_spec`: confirmed file paths, video links, typed text; D29, D36), `GET /student/feedback`, `GET /student/feedback/:id`, `GET /student/sessions` (events + mentor scheduling links), `GET /student/resources` (published materials with `library_category`, D27), ~~`GET /student/resources/:id/download`~~ (*superseded by* `/student/materials/:id/download`), `GET /student/schools`
- Student content (D26, D31): `GET /student/modules/:slug` (chapters with published lessons and materials; 403 if not enrolled, except preview chapters if the founders want them), `GET /student/materials/:id/download` (a signed URL for files, the URL itself for links; enrollment checked), `GET /student/reviews/:id/feedback-file` (signed URL to the commented document; the review must belong to the student)
- Payments: `POST /payments/checkout`, `POST /webhooks/stripe`
- Mentor: `GET /mentor/dashboard`, `GET /mentor/reviews`, `GET /mentor/reviews/:id`, `PUT /mentor/reviews/:id`, `POST /mentor/reviews/:id/feedback-upload-url` (D28; own assigned review, not completed), `POST /mentor/reviews/:id/complete` (accepts an optional `feedbackFilePath` from that upload URL; the API confirms the object exists; a re-upload gets a new path and the latest confirmed one is saved, C4), `GET|POST /mentor/hours`
- Admin: `GET /admin/overview`, `GET /admin/students`, `PATCH /admin/students/:id`, `GET /admin/mentors`, `POST /admin/mentors/invite`, `PATCH /admin/mentors/:id`, `GET /admin/reviews`, `POST /admin/reviews/:id/reassign`, `POST /admin/enrollments`, `POST /admin/credits`
- Admin content (D26–D28, admin only): `GET /admin/content` (every module → chapters → lessons and materials, including unpublished), `POST /admin/lessons`, `PATCH /admin/lessons/:id` (video link, title, length, publish toggle), `DELETE /admin/lessons/:id`, `POST /admin/materials/upload-url` (returns the server-made path and signed upload URL), `POST /admin/materials` (a confirmed path, or a URL for links), `PATCH /admin/materials/:id` (metadata, publish toggle, a replacement path), `DELETE /admin/materials/:id` (row first, then the Storage object), `PUT /admin/content/order` (D35: `{ moduleSlug, chapterSlug, kind: lessons|materials, ids[] }`; ids must be exactly that chapter's current items, rewritten in one transaction). No separate resource endpoints: the library is materials (D27)

**Upload flow (all three uploads, D28):**

```
 browser                     API                                   Storage
 │ POST …/upload-url ──────► │ check role + ownership; make id + path │
 │                           │ {bucket}/{owner}/{id}/{safe-name}       │
 │ ◄── { path, signedUrl } ─ │ createSignedUploadUrl ────────────────►│
 │ PUT file to signedUrl ─────────────────────────────────────────────►│ bucket checks size + MIME
 │ POST … { path } ────────► │ path shape + owner prefix ok? object   │
 │                           │ exists? ───────────────────────────────►│
 │                           │ save row (materials / reviews.feedback_ │
 │ ◄── saved row ─────────── │ file_path / submissions)               │
```

**API contract (D13):** each module's response zod schemas (`<name>.schemas.ts`) are the source of truth. They're registered with zod-to-openapi, and `npm run openapi` writes `openapi.json` (CI fails if it's stale). The FE generates `src/types/api.ts` from it with openapi-typescript (dev dependency) and moves API-facing types there as each endpoint is wired. A renamed field then breaks the FE typecheck instead of a live page. **Transport (D20):** BE commits `openapi.json` to main; FE `npm run gen:api` downloads it with a read-only GitHub token and regenerates `src/types/api.ts`; FE CI fails if the regenerated file differs.

## 7. Cloud Run

- Multi-stage Dockerfile (`node:24-slim`), non-root user. Node 24 LTS everywhere: `.nvmrc`, `engines`, CI (D10)
- Region `northamerica-northeast2` (Toronto) or `northeast1` (Montréal), near Supabase `ca-central-1`; keeps data in Canada (PIPEDA)
- Min instances 0, 512 MB, concurrency 80, max ~3
- Secrets in Secret Manager: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; plain env: `APP_URL`, `ALLOWED_ORIGINS`
- GitHub Actions: CI (typecheck, lint, test, build); deploy to Artifact Registry + Cloud Run via Workload Identity Federation
- ~~FE: add Supabase + API origins to CSP `connect-src`; add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL`~~ *Superseded by D41:* see "Frontend hosting" below for where the prod CSP and `VITE_*` values live
- Two Supabase projects: dev/staging on Free, prod on **Pro** (never paused, daily backups kept 7 days) (D11). Turn on asymmetric JWT signing keys in both before the auth middleware is built (the JWKS endpoint returns no keys otherwise)
- First admin: there is no admin to invite the first admin, so the runbook has a one-off step: invite the coordinator from the Supabase dashboard, then set `profiles.role = 'admin'` with one SQL statement in Studio

### Frontend hosting (D41)

- **Project:** add Firebase to the existing GCP project that runs Cloud Run, so Hosting bills to the same account and sits under the same budget alert (section 11).
- **Deploy:** a GitHub Actions workflow in `d4yfe` runs `npm run check`, builds, and deploys to Firebase Hosting on merge to `main`. It authenticates with **Workload Identity Federation**, like the API deploy, if the Firebase deploy supports it: `google-github-actions/auth` with `id-token: write`, then `firebase-tools deploy` reading the credentials file it writes. That path is only documented in third-party guides so far, so it's an open item (section 10, question 16). No service-account key is added in the meantime.
- **SPA rewrite:** every route rewrites to `/index.html`, so deep links like `/portal/modules/casper` load.
- **Caching:** hashed files under `/assets/**` get `Cache-Control: public, max-age=31536000, immutable`; `index.html` gets `no-cache`, so a deploy shows up on the next load.
- **Build-time config:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_API_URL` are set per environment at build time: prod values in the GitHub Actions deploy workflow (environment variables, not secrets; they're public in the bundle anyway), dev and preview values in Vercel's project settings.
- **Custom domain:** the pilot domain points at Firebase Hosting with Firebase-managed SSL. DNS ownership is open question 14.
- **Config still to create** (`d4yfe`, task H1–H3 in section 9): `firebase.json` (rewrites, cache headers, security headers) and `.firebaserc` (project alias), plus the deploy workflow. `vercel.json` stays for previews.

## 8. Security

- Roles only from `profiles`, server-set
- Mentor queries filter by `mentor_id = req.user.id`; student queries by `student_id = req.user.id`; tested
- Private buckets, ~5 min signed URLs. File type and size limits are set **on the bucket** (`file_size_limit`, `allowed_mime_types`), because a signed upload URL can't enforce them and the API never sees the file (O7)
- Upload flow: `POST …/upload-url` creates the submission id and the storage path on the server and returns both. `POST …/submissions` accepts only that server-made path and checks the object exists before saving the row (O7)
- **Buckets (D30)**, all private, ~5 min signed URLs, paths always made by the API:

  | Bucket | Path | `file_size_limit` | `allowed_mime_types` | Who uploads |
  |---|---|---|---|---|
  | `submissions` | `{student_id}/{submission_id}/{file}` | 10 MB | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | the student |
  | `materials` | `{module_slug}/{material_id}/{file}` | 25 MB | PDF, Word, Excel (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), PowerPoint, `text/csv`, `image/png`, `image/jpeg`, `image/webp` | admins (D26) |
  | `feedback` | `{review_id}/{upload_id}/{file}` (unique per upload, `upsert: false`, C4) | 10 MB | same as `submissions` | the assigned mentor (D28) |

- **No video bucket (D29).** Uploading practice video would mean a fourth bucket at ~200 MB per file. Supabase's standard upload is meant for small files, so files that size need resumable (TUS) uploads, which signed upload URLs don't cover. Each mentor viewing also counts against bandwidth. A 60-second phone video is roughly 50–150 MB; 25 students × ~8 answers × revisions puts it in the tens of GB. That fits inside Pro's included storage, but the large-upload handling is real work. Links cost nothing to store and work from any phone. The trade-off: students' videos sit on their own accounts, and a wrongly set sharing permission blocks the mentor. The form says "check the link opens in a private window", and mentors flag broken links.
- **What "confirm" checks (O4):** nothing is saved at upload-url time. On confirm the API checks the path has the exact shape it issues (`{bucket}/{owner}/{uuid}/{safe-name}`), that the owner segment is the caller's own (student id, review id they're assigned to, or any module for admins), and that the object exists. Every upload, including a replacement material file, gets a fresh `uuid` segment, so `upsert: false` never collides. A caller can only confirm objects under a prefix they could already write to.
- **Orphans (O12):** replaced files, abandoned uploads and failed deletes leave objects behind. Accepted for the pilot (a few MB); the API logs each orphaned path so an admin can clear them from the Storage dashboard.
- **Video-link rules (D25, D29):** the content service parses admin video links into `video_provider` + `video_ref` (Vimeo, YouTube, Mux playback ids). Student answer links must be `https` with a parsed hostname ending in youtube.com, youtu.be, vimeo.com, loom.com, drive.google.com or docs.google.com (so `www.`, `m.`, `/shorts/` and Loom `/share/` links pass); each form has a test (O11). The parser keeps Vimeo's unlisted `h=` hash in `video_ref` (O10).
- **Track (O6):** content responses include every track's items with a `track` field (`'Canada' | 'US' | 'Both'`; DB null maps to `'Both'` in the response schema), matching today's FE, which labels and filters by track rather than hiding. Lessons take their track from the chapter (FE structure); they have no track column.
- **Content access (D31, D34, D39):** `GET /student/modules/:slug`, `GET /student/resources` and material downloads check `published` plus enrollment (or `start-here` with a seat, D39); unpublished rows never leave the admin endpoints. All three go through `content.service` (D33). A mentor's feedback upload URL is issued only for their own review with status `assigned` or `in_progress`. Only admins call `/admin/content`, `/admin/lessons*` and `/admin/materials*`.
- ~~**FE CSP:** embedding the player needs `frame-src https://player.vimeo.com` (or the chosen host) in `d4yfe/vercel.json`, plus the Supabase Storage origin in `connect-src` for direct uploads.~~ *Superseded by D41:* see the next bullet.
- **FE CSP (D41):** in production the security headers, including the CSP, live in the `headers` block of `d4yfe/firebase.json`. The CSP needs `frame-src https://player.vimeo.com` (or the chosen video host) for the player, and `connect-src` for the API origin and the Supabase project origin (Auth and Storage uploads). Vercel previews keep the same headers in `vercel.json`; keep the two in step until previews move (question 15).
- **CORS / `ALLOWED_ORIGINS` (D41):** production allows only the custom pilot domain, plus `https://<project>.web.app` and `https://<project>.firebaseapp.com` if those default URLs are used. Production never allows Vercel origins. Dev and staging allow the Vercel preview/dev origins and `http://localhost:5173`.
- RLS on, no policies
- Rate-limit checkout and all upload-URL endpoints (student, mentor, admin)
- Webhook signature checks and idempotency

## 9. Build order

0. Project setup only (no features): TypeScript, lint, test runner, folder skeleton, `/health`, Dockerfile, CI
   - **0b. Frontend prod hosting (D41)**, can run alongside step 1:
     - H1: create `d4yfe/firebase.json` (SPA rewrite to `/index.html`, cache headers, security headers including the CSP) and `.firebaserc` (project alias for the GCP project).
     - H2: add the `d4yfe` GitHub Actions deploy to Firebase Hosting on `main` (WIF once question 16 is confirmed), with prod `VITE_*` values; connect the custom domain with managed SSL.
     - H3: move the prod CSP from `vercel.json` to `firebase.json`; add the API and Supabase origins to `connect-src` and the video host to `frame-src` (this replaces the `vercel.json` part of T12 for production).
     - Verify: deep links (`/portal/modules/casper`, `/admin/content`) load on the Firebase URL; the browser console shows no CSP violations; the lesson player embeds and a file upload reaches Supabase Storage.
1. Foundation: Supabase project, profiles migration + trigger, Auth with custom SMTP, auth middleware, `/me`, first Cloud Run deploy; FE login + role routing
2. Student read side, `POST /me/onboarding`. FE: add a stable `slug` to every chapter in `src/data/modules.ts` (D19); replace the booking/availability pages and `Bookable`/`AvailabilitySlot` sample data with mentor scheduling links (D2, O11)
   - **2b. Content (D25–D27, D30, D31):** `lessons` and `materials` migrations, the `materials` bucket, the seed script from FE `modules.ts`, the `content` module, `GET /student/modules/:slug`, material downloads, `GET /student/resources` from materials, and the admin content endpoints with the upload flow. It lands before submissions so staff can load real videos and files while the rest is built. **Starts after founders answer section 10 questions 8, 9 and 12** (video host, who manages content, previews) (O8). FE in 2b: the admin Content page, the embedded player, `frame-src`/`connect-src` CSP changes in `vercel.json` (*for production these now go in `firebase.json`, D41; `vercel.json` keeps them for previews*), the `Chapter.materials` split (C1) and wiring the module page to the API.
3. Payments. **Starts only after founders answer section 10 questions 1, 2 and 5** (D21)
4. Submissions and reviews, including the `submissions` and `feedback` buckets, video-link answers (D29) and the mentor commented document (D28)
5. Admin (roster, mentor invites, reassignment, manual grants). FE: replace the admin hardship page with the manual grant form (D3, O11)

## 11. Cost, performance and abuse limits (pilot)

Spend is mostly fixed: Supabase Pro $25/month (spend cap left on), Cloud Run within its monthly free allowance at this traffic, Stripe per transaction only.

- **Queries:** index every foreign key used in a filter (`reviews(mentor_id, status)`, `submissions(student_id)`, `enrollments(student_id)`, `orders(cohort_id, status)`). No queries inside loops: lists load with one query (`= any(...)`) or a join. Page endpoints (`/student/home`, `/mentor/dashboard`) return everything the page needs in one request. Pool ≈ 5 connections per instance.
- **Rate limits:** `express-rate-limit`, in-memory store (fine at ≤3 instances). About 5/min per user on `POST /payments/checkout`, 10/min per user on upload-URL, a looser global limit elsewhere. No limit on `/webhooks/stripe`. Supabase Auth limits sign-in and resets itself.
- **Caching:** no Redis/Memorystore. jose caches JWKS. `program_modules` and `products` are cached in memory with a few minutes' expiry. `Cache-Control` on public read-only responses (`GET /products`, `GET /student/schools`). Per-student data is never cached.
- **Video hosting (D25):** a new fixed cost and the main content cost. Vimeo's domain-level privacy needs a paid plan, roughly $12–25/month at the entry tiers [estimated; check current Vimeo pricing], with ~70 lesson videos well inside its storage limits. YouTube unlisted is free, but anyone with the link can watch. Mux bills per minute stored and streamed, which is small at 25 students but variable. Student practice answers cost nothing on links (D29). Material files (PDFs, templates) are a few hundred MB at most, inside Supabase Pro.
- **Frontend hosting (D41):** Firebase Hosting joins the same GCP bill. At pilot traffic it's likely within Hosting's free storage and transfer allowance, or a few dollars a month [estimated]; the GCP budget alert covers it. Vercel Pro is no longer needed for production (see question 15 for previews).
- **Cost guards:** Cloud Run max instances 3, a Google Cloud billing budget alert, Supabase spend cap on, an Artifact Registry cleanup policy (keep the last ~10 images), no request bodies in logs.

Testing: Vitest + supertest against local Supabase; Stripe CLI for webhooks.

## 10. Open questions for founders

1. Prices, currency (CAD?), GST/HST (Stripe Tax), which entity owns the Stripe account
2. Refund policy: does a refund remove access?
3. Upgrades between packages
4. Extra review rounds sold separately?
5. Invite-only or open sign-up for the pilot?
6. Email sender domain (for Supabase Auth emails)
7. Approve ~$25/month for the Supabase Pro plan on the production project (D11)
8. **Video host and budget (D25):** Vimeo with domain-level privacy (paid plan), YouTube unlisted (free, shareable links) or Mux (usage-based)? Who owns the account?
9. **Who adds content after launch (D26):** which D4Y staff get admin access to the Content page, and who records and uploads the ~70 lesson videos?
10. **Commented documents (D28):** will mentors return marked-up files, or is the written rubric feedback enough for the pilot?
11. **Student video answers (D29):** is a link to YouTube unlisted, Loom or Drive acceptable for CASPer and interview practice, or must videos be uploaded to D4Y (more cost and build work)?
12. **Free previews (D31):** should any chapters be visible before purchase (the FE sample mentions "Chapter 5.1 is free to preview")?
13. **Prototype features not in the plan.** Please confirm whether the pilot needs each one. None is implemented:
    - In-app booking and session reminders (conflicts with D2: scheduling links)
    - Blind two-reviewer hardship review in the app (conflicts with D3: off-platform form)
    - Automatic escalation and reassignment of overdue reviews (conflicts with D4: computed on read, admin reassigns by hand)
    - Feedback helpfulness rating (the FE shows it on sample data; there is no table or endpoint)
    - "Ask a follow-up" replies from student to mentor (FE shows a reply box; there is no messages table or endpoint)
    - Quizzes and practice scoring (materials of kind `quiz`/`practice` are links or files only; nothing stores answers or scores)
14. **Hosting ownership (D41):** who owns the Firebase/GCP project (billing and admin access) and the pilot domain's DNS?
15. **Vercel plan for dev and previews (D41):** Vercel's free Hobby plan is for non-commercial personal use only, so previews of a paid product may still need Vercel Pro. Options, not decided: (a) keep Vercel for previews on Pro; (b) move previews to Firebase Hosting preview channels and drop Vercel.
16. **Keyless Firebase deploy (D41):** confirm that `firebase-tools` deploys to Hosting with Workload Identity Federation credentials (it's shown in third-party guides; the auth action's README requires a key only for the Firebase Admin SDK). If it doesn't work, the team decides what to use instead before H2; no key-based setup is chosen here.

---

## Review: /plan-eng-review (2026-11-18)

Target: `d4ybe/docs/architecture.md` (this file). Report file: this file.

### Scope record

feature answers: D2=A (scheduling links), D3=A (off-platform hardship form), D4=A (no scheduled jobs); structure: A (original four-layer feature modules), D5; accepted scope: plan as written minus in-app booking, hardship tables/endpoints and scheduled jobs, with D5 folder layout; pending remedies: R1–R18 raised later; all approved (see ledger).

Scope Challenge result: scope reduced per recommendation.

Decision log ids: D2 `6921117e`, D3 `5296927c`, D4 `f968fcc3`.

### Scope Challenge findings

- F1 `[INFORMATIONAL] (confidence: 8/10) docs/architecture.md:49` — original text "postgres.js (or Kysely) via Supabase pooler (transaction mode, port 6543, `prepare: false`)" did not name which pooler. Supabase docs: the direct host and dedicated pooler are IPv6 unless the IPv4 add-on is bought; the shared pooler is IPv4. Cloud Run egress is IPv4 by default. Factual correction applied (no behavior change): plan now names the shared pooler host. Evidence: Supabase "Connect to your database" and "Supavisor FAQ" docs (web search, 2026-11-18).
- F2 `[CRITICAL] (confidence: 8/10) docs/architecture.md:145` — "insert into `stripe_events` (skip if exists), then in one transaction: order → paid…" puts the dedupe write outside the fulfillment transaction. If fulfillment fails after the event row commits, Stripe's retry is skipped and a paying student never gets access. → R1
- F3 `[CRITICAL] (confidence: 7/10) docs/architecture.md:101` — "Checkout refuses when full" checks capacity when the session is created, but two students can open checkout for the last seat at once and both pay. → R2
- F4 `[INFORMATIONAL] (confidence: 7/10) docs/architecture.md:40, :88, :67` — module slugs live in three places: FE `src/data/modules.ts`, BE `config/program.ts`, and a DB CHECK constraint. Hand-synced list (red flag 8). → R3
- F5 `[INFORMATIONAL] (confidence: 8/10) docs/architecture.md:49` — "postgres.js (or Kysely)" leaves the query library undecided, and the repository layer (D5) depends on it. → R4
- F6 `[INFORMATIONAL] (confidence: 8/10) docs/architecture.md:164` — "`node:22-slim`": Node 22 reaches end of life on 2027-04-30, during or right after the pilot. Node 24 is the current LTS. Outside this repo: FE `.nvmrc` pins `20.19`, which reached end of life on 2026-04-30. → R5

## Decision ledger

### R1: Stripe webhook dedupe placement
Finding: F2, CRITICAL, 8/10, docs/architecture.md:145, plan-eng-review (claude)
Plan baseline: original proposal — event row inserted before the fulfillment transaction
Runtime evidence: unknown (no code yet)
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1 dedupe placement | before the transaction | inside the fulfillment transaction | no event table; skip if order already `paid` |
| R2 capacity hold | pending | pending | pending |
| R3 slug source | pending | pending | pending |
| R4 query library | pending | pending | pending |
| R5 Node version | pending | pending | pending |

Question D6:
D6 — Where does the Stripe webhook record "already handled" so a failure can't lose a payment?
Project/branch/task: d4ybe on main, payments flow in docs/architecture.md:145.
ELI10: Stripe can send the same "payment done" message several times, so the API writes down each message id to avoid granting access twice. The plan writes that id first and grants access afterwards. If granting access crashes in between, the id is already saved, Stripe's retry is ignored, and the student paid but has no modules.
Stakes if we pick wrong: a paying student is locked out and someone has to find and fix it by hand.
Recommendation: A because one transaction makes "recorded" and "granted" succeed or fail together, at no extra cost.
Completeness: A=10/10, B=8/10
Pros / cons:
A) Dedupe inside the transaction (recommended)
  ✅ Event id, paid order, enrollments and credits commit together or not at all
  ✅ A crash mid-way rolls everything back, so Stripe's retry finishes the job
  ❌ The webhook holds one transaction a little longer (milliseconds at pilot volume)
B) Dedupe by order status only
  ✅ One fewer table: skip when the order is already marked paid
  ✅ Still safe for checkout events, because the status change is in the same transaction
  ❌ Refund and expiry events have no dedupe record or audit trail
Net: the same work either way; A also covers refunds and keeps an event audit trail.
Header: D6 Webhook
Options:
A) Inside the transaction (recommended)
In one transaction: insert stripe_events … on conflict do nothing; if no row was inserted, return 200; otherwise mark order paid, insert enrollments and credits, commit. Effort: human ~1 hour / CC ~5 min. Low risk, no extra maintenance.
B) Order status only
Drop stripe_events. Skip when the order is already paid; refund/expiry events rely on their own status checks. Effort: same. Loses the event audit trail.

State: approved
Actual answer: A) Inside the transaction (recommended) — D6 answer, 2026-11-18
Accepted scope: In one transaction: insert stripe_events … on conflict do nothing; if no row was inserted, return 200; otherwise mark order paid, insert enrollments and credits, commit. Plan section 5 step 4 amended.
History: none

### R2: Cohort capacity under concurrent checkout
Finding: F3, CRITICAL, 7/10, docs/architecture.md:101, plan-eng-review (claude)
Plan baseline: original proposal — count at session creation, no hold
Runtime evidence: unknown (no code yet)
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1 dedupe placement | inside the transaction (D6=A) | inside the transaction (D6=A) | inside the transaction (D6=A) |
| R2 capacity hold | count at session creation, no hold | lock cohort row; count paid + unexpired pending; Checkout expires in 30 min; over-capacity payments flagged for admin refund | count paid only; oversell possible, admin refunds |
| R3–R5 | pending | pending | pending |

Question D7:
D7 — How do we stop the 26th student from paying for a 25-seat pilot?
Project/branch/task: d4ybe on main, cohort capacity check in docs/architecture.md section 4 (cohorts) and section 5 step 2.
ELI10: The plan checks "is there a seat left?" when a student clicks Buy. If two students click Buy for the last seat at the same moment, both pass the check, both pay, and you have 26 paid students for 25 seats. Option A holds a seat for 30 minutes while a student is on the Stripe page, so the count includes people mid-checkout.
Stakes if we pick wrong: someone pays for a seat that doesn't exist, and D4Y has to refund and apologise.
Recommendation: A because the hold is a row lock and a count, small work that closes the oversell gap for good.
Completeness: A=10/10, B=6/10
Pros / cons:
A) Hold seats during checkout (recommended)
  ✅ Two buyers can't both get the last seat: the cohort row is locked while counting paid + in-progress orders
  ✅ Abandoned checkouts free their seat after 30 minutes when Stripe expires the session
  ❌ A student who abandons checkout blocks a seat for up to 30 minutes
B) Count paid orders only
  ✅ Simplest check: count paid orders when Buy is clicked
  ✅ Oversell needs two buyers racing for the very last seat, which is rare at 25 seats
  ❌ If it happens, an admin refunds by hand and explains to the student
Net: a few lines of locking now versus a rare manual refund later.
Header: D7 Capacity
Options:
A) Hold seats in checkout (recommended)
When creating a Checkout Session: lock the cohort row (select … for update), count paid + pending orders not yet expired, refuse if ≥ capacity, create the session with expires_at = 30 min. Webhook still fulfils a paid order if somehow over capacity and marks it over_capacity for admin refund. Effort: human ~2 hours / CC ~10 min. Low maintenance.
B) Count paid orders only
Count paid orders when Buy is clicked; no hold, no lock. Rare oversell handled by an admin refund. Effort: human ~30 min / CC ~5 min.

State: approved
Actual answer: A) Hold seats in checkout (recommended) — D7 answer, 2026-11-18
Accepted scope: When creating a Checkout Session: lock the cohort row (select … for update), count paid + pending orders not yet expired, refuse if ≥ capacity, create the session with expires_at = 30 min. Webhook still fulfils a paid order if somehow over capacity and marks it over_capacity for admin refund. Seats count distinct students, so a student who already holds a seat can buy more modules. Plan sections 4 (orders) and 5 step 2 amended.
History: none

### R3: Module slug source
Finding: F4, INFORMATIONAL, 7/10, docs/architecture.md:40, :88, :67, plan-eng-review (claude)
Plan baseline: original proposal — FE data + BE config + DB CHECK
Runtime evidence: unknown (no code yet). FE source of truth: d4yfe/src/data/modules.ts (seven modules) and d4yfe/src/data/portal.ts rubrics.
Comparison grid:

| Choice | Current | A | B | C |
|---|---|---|---|---|
| R1 dedupe placement | D6=A | D6=A | D6=A | D6=A |
| R2 capacity hold | D7=A | D7=A | D7=A | D7=A |
| R3 slug source | FE + BE config + DB CHECK (3 copies) | `program_modules` table seeded by migration, FKs; no BE config/program.ts (2 copies: FE + DB) | BE config/program.ts only, plain text columns (2 copies: FE + BE) | as planned (3 copies) |
| R4 query library | pending | pending | pending | pending |
| R5 Node version | pending | pending | pending | pending |

Question D8:
D8 — Where does the backend keep the list of modules and their rubrics?
Project/branch/task: d4ybe on main, module references in docs/architecture.md sections 1, 3 and 4.
ELI10: The seven module names (dat, casper, …) and each module's rubric criteria are written in the frontend. The plan copies them twice more: once in a backend config file and once as a database rule. When D4Y renames or adds a module, someone has to remember to change all three, and a missed copy rejects valid data or accepts bad data.
Stakes if we pick wrong: a module change breaks submissions or review scoring until someone finds the stale copy.
Recommendation: A because a seeded table gives the database real foreign keys and leaves the backend one copy to keep in step with the frontend.
Completeness: A=9/10, B=7/10, C=6/10
Pros / cons:
A) Seeded program_modules table (recommended)
  ✅ Foreign keys stop any row from pointing at a module that doesn't exist
  ✅ One backend copy (a migration) instead of two; the API reads rubrics from it to check scores
  ❌ Changing a rubric means writing a small migration instead of editing a TS file
B) Backend config file only
  ✅ Rubric edits are a one-line TS change with type checking
  ✅ Also one backend copy
  ❌ The database accepts any module text, so a bug or manual Studio edit can store a bad slug
C) Keep as planned
  ✅ Both a typed config and a database rule
  ✅ No change to the plan
  ❌ Three lists to keep in step by hand
Net: database-enforced integrity with one backend copy versus easier rubric edits.
Header: D8 Modules
Options:
A) Seeded program_modules table (recommended)
Add program_modules(slug PK, title, rubric_criteria text[], sort_order) seeded in a migration with the seven modules plus start-here. Every module_slug column is a foreign key to it. The API validates rubric scores against rubric_criteria. Remove config/program.ts. Effort: human ~1 hour / CC ~5 min.
B) Backend config file only
Keep config/program.ts as the only backend copy. module_slug columns are plain text with no constraint; the API validates. Effort: human ~30 min / CC ~5 min.
C) Keep as planned
FE data + config/program.ts + a DB CHECK constraint. No change.

State: approved
Actual answer: A) Seeded program_modules table (recommended) — D8 answer, 2026-11-18
Accepted scope: Add program_modules(slug PK, title, rubric_criteria text[], sort_order) seeded in a migration with the seven modules plus start-here. Every module_slug column is a foreign key to it. The API validates rubric scores against rubric_criteria. Remove config/program.ts. Plan sections 1, 3 and 4 amended.
History: none

### R4: Query library
Finding: F5, INFORMATIONAL, 8/10, docs/architecture.md:49, plan-eng-review (claude)
Plan baseline: original proposal — "postgres.js (or Kysely)", undecided
Runtime evidence: unknown (no code yet). Migrations are owned by the Supabase CLI (plan section 2).
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1 dedupe placement | D6=A | D6=A | D6=A |
| R2 capacity hold | D7=A | D7=A | D7=A |
| R3 slug source | D8=A | D8=A | D8=A |
| R4 query library | undecided | postgres.js, SQL in repositories, row types from `supabase gen types typescript` | Kysely + kysely-codegen typed query builder |
| R5 Node version | pending | pending | pending |

Question D9:
D9 — Which library do the repositories use to talk to Postgres?
Project/branch/task: d4ybe on main, DB access row in docs/architecture.md section 2.
ELI10: Every repository file (the SQL layer you chose in D5) needs a database library, and the plan says "postgres.js or Kysely" without picking. postgres.js lets you write plain SQL safely. Kysely builds SQL from TypeScript so a renamed column becomes a compile error. Both work with Supabase's pooler and transactions; neither owns migrations, so the Supabase CLI stays in charge of the schema.
Stakes if we pick wrong: switching later means rewriting every repository file.
Recommendation: A because plain SQL is the most explicit option for ~15 tables, and Supabase's type generator still gives typed rows.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) postgres.js + generated types (recommended)
  ✅ Plain, readable SQL in each repository; what runs is what you wrote
  ✅ One small dependency; `supabase gen types typescript` keeps row types in step with migrations
  ❌ A typo in a column name inside the SQL is caught by tests, not by the compiler
B) Kysely + kysely-codegen
  ✅ Renamed or misspelled columns fail at compile time across every query
  ✅ Composable queries for filters, like the admin roster's optional filters
  ❌ Two more dependencies and a codegen step in CI, plus a query-builder syntax to learn
Net: explicit SQL with tested correctness versus compile-time column checks for more setup.
Header: D9 Query lib
Options:
A) postgres.js + generated types (recommended)
Repositories use postgres.js tagged-template SQL (sql`…`, parameterized). Row types come from `supabase gen types typescript`, regenerated after each migration and checked in CI. Effort: human ~1 hour setup / CC ~5 min.
B) Kysely + kysely-codegen
Repositories use Kysely's query builder. kysely-codegen generates DB types from the local database after each migration; CI fails if the generated file is stale. Effort: human ~3 hours setup / CC ~15 min.

State: approved
Actual answer: A) postgres.js + generated types (recommended) — D9 answer, 2026-11-18
Accepted scope: Repositories use postgres.js tagged-template SQL (sql`…`, parameterized). Row types come from `supabase gen types typescript`, regenerated after each migration and checked in CI. Plan sections 2 and 3 amended.
History: none

### R5: Node runtime version
Finding: F6, INFORMATIONAL, 8/10, docs/architecture.md:164, plan-eng-review (claude)
Plan baseline: original proposal — node:22-slim
Runtime evidence: local machine runs Node v23.11.0 (non-LTS); FE `.nvmrc` is `20.19`. Node release schedule: 20 EOL 2026-04-30, 22 EOL 2027-04-30, 24 LTS until 2028-04-30 (in-distribution knowledge; verify at nodejs.org/en/about/previous-releases).
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1–R4 | D6=A, D7=A, D8=A, D9=A | same | same |
| R5 Node version | node:22-slim | Node 24 LTS everywhere (Dockerfile, .nvmrc, engines, CI) | Node 22 everywhere |

Question D10:
D10 — Which Node version does the backend run on?
Project/branch/task: d4ybe on main, Cloud Run image in docs/architecture.md section 7.
ELI10: Node versions get security fixes for a fixed time, then stop. The plan picks Node 22, which stops getting fixes on 30 April 2027, about when the pilot ends. Node 24 is the current long-term version and gets fixes until April 2028. Starting a new project now, on 24, costs nothing extra.
Stakes if we pick wrong: on 22 you'd have to upgrade Node mid-pilot or after it, while students are using the app.
Recommendation: A because a new repo should start on the current LTS, which covers the pilot and the launch after it.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Node 24 LTS (recommended)
  ✅ Security fixes until April 2028, covering the pilot and full launch
  ✅ Same version in Docker, CI, .nvmrc and package.json engines, so local matches production
  ❌ The FE repo is on 20.19, so the two repos use different Node versions until the FE is bumped
B) Node 22
  ✅ Closer to what most tutorials and examples were written against
  ✅ Every library in the plan supports it today
  ❌ Out of support on 30 April 2027, so an upgrade lands during or right after the pilot
Net: start on the current LTS now versus a forced upgrade in about five months.
Header: D10 Node
Options:
A) Node 24 LTS (recommended)
Dockerfile node:24-slim, .nvmrc 24, package.json engines ">=24", CI uses Node 24. Separately flag the FE .nvmrc (20.19, past end of life) as a TODO for the FE repo. Effort: human ~10 min / CC ~2 min.
B) Node 22
Keep node:22-slim; set .nvmrc 22, engines ">=22", CI Node 22. Plan an upgrade before 2027-04-30. Effort: same.

State: approved
Actual answer: A) Node 24 LTS (recommended) — D10 answer, 2026-11-18
Accepted scope: Dockerfile node:24-slim, .nvmrc 24, package.json engines ">=24", CI uses Node 24. Separately flag the FE .nvmrc (20.19, past end of life) as a TODO for the FE repo. Plan section 7 amended.
History: none

### R6: Supabase plan for the production project
Finding: A1, CRITICAL, 8/10, docs/architecture.md section 7 "Two Supabase projects (dev/staging, prod)", plan-eng-review (claude)
Plan baseline: original proposal — two projects, plan tier unspecified
Runtime evidence: Supabase FAQ: Free projects with too little activity over a week are paused (manual restore); Pro/Team/Enterprise are never paused. Pricing page: Pro ($25/month) has daily backups with 7-day retention; Free-tier backups unconfirmed (web search, 2026-11-18). Supabase also warns that restored paused projects may lack legacy keys.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1–R5 | D6–D10 = A | same | same |
| R6 prod plan | unspecified (defaults to Free) | prod on Pro, dev on Free | both on Free; weekly manual `pg_dump` |
| R7 grant ownership | pending | pending | pending |
| R8 API contract types | pending | pending | pending |

Question D11:
D11 — Which Supabase plan does the production project run on?
Project/branch/task: d4ybe on main, Supabase setup in docs/architecture.md section 7.
ELI10: Supabase's free plan pauses a project after about a week of low activity, and someone has to restore it by hand. It also has no daily backups you can count on. The production project will hold paid students' accounts, payments, personal statements and mentor feedback. Pro costs $25 a month, never pauses, and keeps 7 days of daily backups.
Stakes if we pick wrong: on Free, a quiet week (exam break, holidays) takes the app offline for students and Stripe webhooks, and a bad migration or deletion can't be undone.
Recommendation: A because $25 a month buys no pausing and daily backups for data people paid to create; the dev project stays free.
Completeness: A=10/10, B=5/10
Pros / cons:
A) Pro for prod, Free for dev (recommended)
  ✅ Production never pauses, so students and Stripe webhooks always reach the database
  ✅ Daily backups kept for 7 days, so a bad migration or accidental delete can be rolled back
  ❌ Costs $25 a month (about $150 across a six-month pilot), which the founders must approve
B) Free for both, manual dumps
  ✅ No monthly cost during the pilot
  ✅ Fine for testing before real students sign up
  ❌ Production can pause after a quiet week, and backups depend on someone running pg_dump every week
Net: about $25 a month versus pausing risk and hand-run backups for paid student data.
Header: D11 Supabase plan
Options:
A) Pro for prod, Free for dev (recommended)
Production Supabase project on Pro (no pausing, daily backups, 7-day retention). Dev/staging project on Free. Add to founder questions: approve ~$25/month. Effort: none beyond billing setup.
B) Free for both, manual dumps
Both projects on Free. Someone runs pg_dump of prod weekly and stores it privately; restore a paused project by hand. Effort: ~15 min/week ongoing.

State: approved
Actual answer: A) Pro for prod, Free for dev (recommended) — D11 answer, 2026-11-18
Accepted scope: Production Supabase project on Pro (no pausing, daily backups, 7-day retention). Dev/staging project on Free. Add to founder questions: approve ~$25/month. Plan sections 7 and 10 amended.
History: none

### R7: Who owns granting access (enrollments + credits)
Finding: A2, INFORMATIONAL, 7/10, docs/architecture.md section 4 (enrollments, credit_ledger) and section 6 (`POST /admin/enrollments`, `POST /admin/credits`, payments webhook), plan-eng-review (claude)
Plan baseline: original proposal — payments and admin modules each write enrollments and credit_ledger
Runtime evidence: unknown (no code yet). Planned writers: payments webhook (section 5 step 4), `POST /admin/enrollments`, `POST /admin/credits` (section 6), review completion debits a review credit (section 4).
Comparison grid:

| Choice | Current | A | B | C |
|---|---|---|---|---|
| R1–R6 | D6–D11 = A | same | same | same |
| R7 grant ownership | payments + admin + mentor (review debit) each write | new `access` module owns both tables; others call its service | payments module owns both; admin/mentor call payments.service | as planned |
| R8 API contract types | pending | pending | pending | pending |

Question D12:
D12 — Which module is allowed to grant module access and credits?
Project/branch/task: d4ybe on main, enrollments and credit_ledger in docs/architecture.md sections 4–6.
ELI10: Three places in the plan change what a student can access: a Stripe payment, an admin's manual grant (hardship seats, comps), and a mentor finishing a review (uses up a review credit). If each writes the tables its own way, one will forget a rule, like "don't double-grant a module" or "never let credits go below zero". One owner means one place to get those rules right.
Stakes if we pick wrong: a student can get a module twice, lose a credit they paid for, or end up with negative credits, depending on which path ran.
Recommendation: A because a small access module puts every grant rule in one service that payments, admin and mentor all call.
Completeness: A=10/10, B=8/10, C=6/10
Pros / cons:
A) New access module owns grants (recommended)
  ✅ One service holds every rule: no duplicate modules, no credits below zero, source recorded
  ✅ Payments, admin and mentor code get shorter; they call grantProduct or useCredit
  ❌ One more module folder (service, repository, schemas; no routes of its own)
B) Payments module owns grants
  ✅ No new folder; the webhook already holds most of the grant logic
  ✅ Still one owner for both tables
  ❌ Admin and mentor code import from payments for things that aren't payments, which reads oddly
C) Keep as planned
  ✅ No change to the module list
  ✅ Each path is self-contained
  ❌ Three writers to keep in step for the same two tables
Net: one owner for access rules versus one fewer folder.
Header: D12 Access
Options:
A) New access module owns grants (recommended)
Add modules/access/ (access.service.ts, access.repository.ts, access.schemas.ts, access.test.ts). Only it writes enrollments and credit_ledger. Exposes grantProduct(tx, studentId, productId, source, orderId?), grantModule(…), useCredit(tx, studentId, kind, reviewId) and getAccess(studentId). Payments, admin and mentor call it inside their own transactions. Effort: human ~2 hours / CC ~10 min.
B) Payments module owns grants
payments.service.ts owns those writes and exposes the same functions; admin and mentor import them. Effort: same.
C) Keep as planned
Each module writes the tables directly. No change.

State: approved
Actual answer: A) New access module owns grants (recommended) — D12 answer, 2026-11-18
Accepted scope: Add modules/access/ (access.service.ts, access.repository.ts, access.schemas.ts, access.test.ts). Only it writes enrollments and credit_ledger. Exposes grantProduct(tx, studentId, productId, source, orderId?), grantModule(…), useCredit(tx, studentId, kind, reviewId) and getAccess(studentId). Payments, admin and mentor call it inside their own transactions. Plan sections 3 and 4 amended.
History: none

### R8: API response types shared with the frontend
Finding: A3, INFORMATIONAL, 7/10, d4yfe/src/types/index.ts:1-2 ("These are the contract the Express API will implement") and planned `<name>.schemas.ts`, plan-eng-review (claude)
Plan baseline: original proposal — "Responses match FE `src/types` shapes" (section 6), no mechanism
Runtime evidence: FE `src/types/index.ts` hand-writes every response shape (Student, Enrollment, Assignment, Feedback, …); FE imports them from `@/types`. No BE code yet. FE CLAUDE.md: "No new dependencies without a clear reason."
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1–R7 | D6–D12 = A | same | same |
| R8 API contract types | FE types + BE zod schemas, kept in step by hand | BE zod schemas are the source; BE emits `openapi.json`; FE generates its API types with openapi-typescript (dev dependency) | hand-sync; BE integration tests parse every response with its zod schema; schemas named to match FE types |

Question D13:
D13 — How do the frontend and backend agree on what each API response looks like?
Project/branch/task: d4ybe on main, API contract in docs/architecture.md section 6 and d4yfe/src/types/index.ts.
ELI10: The frontend already describes every response it expects (a Student, an Assignment, a Feedback…). The backend will describe the same shapes again in its zod schemas. If someone renames a field on one side only, the page shows blanks or crashes, and nothing warns you until a student sees it. Option A makes the backend the single source and generates the frontend's types from it, so a mismatch becomes a TypeScript error in the frontend build.
Stakes if we pick wrong: a silent field mismatch ships and breaks a portal page for real students.
Recommendation: A because generated types turn a cross-repo mismatch into a build error, and the generator is a dev-only dependency with a clear reason.
Completeness: A=9/10, B=6/10
Pros / cons:
A) Backend schemas generate frontend types (recommended)
  ✅ Renamed or removed fields fail the frontend's typecheck before deploy
  ✅ The backend's zod schemas both validate responses and document the API (openapi.json)
  ❌ Adds zod-to-openapi (BE) and openapi-typescript (FE dev dependency), plus a regenerate step when the API changes
B) Hand-sync with response tests
  ✅ No new dependencies or codegen steps
  ✅ Backend tests still prove each response matches its own zod schema
  ❌ Nothing checks the frontend's copy, so a mismatch between repos is found by people, not tools
Net: a build error for contract drift versus no extra tooling.
Header: D13 Contract
Options:
A) Backend schemas generate FE types (recommended)
BE: response zod schemas in <name>.schemas.ts, registered with zod-to-openapi; `npm run openapi` writes openapi.json, checked in CI. FE: openapi-typescript generates src/types/api.ts from it; API-facing types in src/types/index.ts move to the generated file as each endpoint is wired. Effort: human ~1 day / CC ~30 min.
B) Hand-sync with response tests
BE zod schemas mirror FE src/types by name; every BE integration test parses the response with its schema. FE types stay hand-written. Effort: human ~2 hours / CC ~10 min.

State: approved
Actual answer: A) Backend schemas generate FE types (recommended) — D13 answer, 2026-11-18 (given after an interrupted prompt)
Accepted scope: BE: response zod schemas in <name>.schemas.ts, registered with zod-to-openapi; `npm run openapi` writes openapi.json, checked in CI. FE: openapi-typescript generates src/types/api.ts from it; API-facing types in src/types/index.ts move to the generated file as each endpoint is wired. Plan sections 2, 3 and 6 amended.
History: none

### Outside voice (Claude Plan subagent, native fallback; Codex not installed)

Completed in 80 s, under the 5-minute limit. VERDICT: FINDINGS (14). Source: in-host; outside_status: unavailable (no external provider).

Applied as corrections or required work for approved contracts (no new behavior choice):
- O2 (High): create the pending order before calling Stripe, and look it up by `metadata.order_id`. Required for D6's "a paying student always gets access". Section 5 step 2 amended.
- O7 (Medium): size/MIME limits set on the bucket; server-made upload path. Section 8 amended.
- O11 (Low): FE cleanup tasks for the cut features. Section 9 amended.
- O13 (Low): generated types don't check SQL; integration tests are the real check. Section 2 wording amended.

Needs a decision: O1→R9, O3→R10, O4→R11, O6→R12, O5→R13, O8→R14, O9→R15 (reopens D13), O10→R16 (reopens payment scope), O12→R17, O14→R18.

### R9: Seat counting includes admin/hardship grants (reopens D7 counting rule)
Finding: O1, High, outside voice. Plan section 5 step 2 counts only students with paid or unexpired pending orders; `POST /admin/enrollments` creates no order.
Plan baseline: D7=A (count paid + unexpired pending orders under the cohort row lock)
Runtime evidence: unknown (no code)
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R9 seat source | orders only (D7) | cohort membership (`student_profiles.cohort_id`) + unexpired pending orders from non-members; admin grant takes the same lock and refuses when full | orders only; admin tracks comps by hand |

Question D14: as sent in the AskUserQuestion batch below (text identical).
Header: D14 Seats
Options:
A) Count cohort members (recommended)
A seat = a student whose student_profiles.cohort_id is set. Checkout counts members plus unexpired pending orders from non-members, under the cohort row lock. The admin grant path takes the same lock and refuses when full (an admin can raise capacity on purpose). Effort: human ~1 hour / CC ~5 min.
B) Count orders only
Keep D7 as approved. Hardship and comp seats aren't counted, so the admin must leave room by hand.
State: approved
Actual answer: A) Count cohort members (recommended) — D14 answer, 2026-11-18
Accepted scope: A seat = student_profiles.cohort_id set. Checkout counts members + unexpired pending orders from non-members under the cohort row lock; admin grants take the same lock and refuse when full (admin can raise capacity on purpose). Supersedes the counting rule in D7. Plan sections 4 and 5 amended.
History: D7=A approved 2026-11-18; reopened because admin grants bypass the count (O1).

### R10: Duplicate checkout for the same product
Finding: O3, High, outside voice. Section 5 step 2 "not already owned" checks enrollments only.
Plan baseline: original proposal
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R10 open-session reuse | none; a second session is created | under the cohort lock, an unexpired pending order for the same student + product returns its existing Checkout URL | none; duplicate payments refunded by hand |

Question D15: as sent below.
Header: D15 Double pay
Options:
A) Reuse the open session (recommended)
Under the same lock, if the student already has an unexpired pending order for this product, return that order's Checkout URL instead of creating a new session. Effort: human ~30 min / CC ~5 min.
B) Allow duplicates
Create a new session each time; refund any double payment by hand.
State: approved
Actual answer: A) Reuse the open session (recommended) — D15 answer, 2026-11-18
Accepted scope: Under the same lock, an unexpired pending order for the same student + product returns its existing Checkout URL. Plan section 5 amended.
History: none

### R11: When a review credit is spent
Finding: O4, High, outside voice. Plan never defines who creates the review row, mentor choice, or credit timing; `useCredit` has no trigger.
Plan baseline: original proposal (unspecified)
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R11 credit timing | unspecified | at submission, under a per-student row lock; 0 credits → refuse submit; review row created then, assigned to primary_mentor_id | at mentor completion; student can submit with 0 credits |
| fixed in both | — | each submitted version needing review uses one round; admin cancel returns the credit | same |

Question D16: as sent below.
Header: D16 Credits
Options:
A) Spend at submission (recommended)
Submitting work that needs review locks the student's row, checks review balance > 0 (otherwise "no review rounds left"), spends one credit, and creates the review assigned to primary_mentor_id (admin reassigns if that mentor is at their monthly limit). Each new version (including "revise") uses one round. An admin cancelling a review returns the credit. Effort: human ~3 hours / CC ~15 min.
B) Spend at completion
Students can submit with any balance; the credit is spent when the mentor completes the review. A student with 0 credits finds out after the mentor has done the work.
State: approved
Actual answer: A) Spend at submission (recommended) — D16 answer, 2026-11-18
Accepted scope: Submit locks the student row, checks review balance > 0, spends one round via access.useCredit, creates the review assigned to primary_mentor_id (admin reassigns if mentor at monthly limit). Each version uses one round; admin cancel returns it. Plan section 4 amended (review lifecycle).
History: none

### R12: Payment methods
Finding: O6, Medium, outside voice. Section 5 step 4 fulfils on `checkout.session.completed` without checking `payment_status`.
Plan baseline: original proposal
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R12 payment methods | Stripe defaults (may include delayed methods) | `payment_method_types: ['card']`; fulfil only when `payment_status = 'paid'` | allow delayed methods; handle `async_payment_succeeded/failed`; seat held until settled |

Question D17: as sent below.
Header: D17 Card only
Options:
A) Card only (recommended)
Checkout sessions accept cards only. The webhook fulfils only when payment_status is "paid". Effort: one line plus a test.
B) Allow delayed methods
Accept bank debits (e.g. ACSS). Handle async succeeded/failed events and keep the seat until money settles. Effort: human ~1 day / CC ~30 min.
State: approved
Actual answer: A) Card only (recommended) — D17 answer, 2026-11-18
Accepted scope: payment_method_types: ['card']; webhook fulfils only when payment_status = 'paid'. Plan section 5 amended.
History: none

### R13: Student onboarding (track, cycle, cohort)
Finding: O5, Medium, outside voice. Trigger creates only `profiles`; nothing creates `student_profiles`; checkout takes only productSlug.
Plan baseline: original proposal (unspecified)
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R13 onboarding | none | trigger also creates student_profiles (track, cycle null); `POST /me/onboarding` sets track + cycle; cohort_id set by access.grantProduct at first seat | checkout requires track + cycle in its request body; no onboarding endpoint |

Header: D18 Onboarding
Options:
A) Onboarding endpoint (recommended)
Trigger also inserts student_profiles with null track/cycle for students. POST /me/onboarding sets track and cycle (matches the FE "Choose your track" start-here chapter). cohort_id is set by access.grantProduct when a seat is granted. Effort: human ~1h / CC ~5 min.
B) Collect at checkout
POST /payments/checkout requires track and cycle; the student row is created then. Students can't set a track before paying.
State: approved
Actual answer: A) Onboarding endpoint (recommended) — D18 answer, 2026-11-18
Accepted scope: Trigger also inserts student_profiles (track/cycle null) for students. POST /me/onboarding sets track + cycle. cohort_id set by access.grantProduct when a seat is granted. Plan sections 4 and 6 amended.
History: none

### R14: Chapter progress keys
Finding: O8, Medium, outside voice. chapter_progress keys on chapter_index into chapters defined only in FE src/data/modules.ts.
Plan baseline: original proposal
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R14 chapter key | chapter_index | stable chapter slug; program_modules gains chapter_slugs text[] seeded by migration; FE chapters get a slug field | keep index; add chapter_count to program_modules; freeze chapter order during the pilot |

Header: D19 Chapters
Options:
A) Stable chapter slugs (recommended)
Each FE chapter gets a slug. program_modules.chapter_slugs (ordered) is seeded by migration. chapter_progress is keyed by (student_id, module_slug, chapter_slug); the API rejects unknown slugs. Effort: human ~1h (BE) + ~30 min (FE) / CC ~10 min.
B) Index + freeze
Keep chapter_index; add chapter_count for validation; agree not to insert or reorder chapters during the pilot.
State: approved
Actual answer: A) Stable chapter slugs (recommended) — D19 answer, 2026-11-18
Accepted scope: Each FE chapter gets a slug; program_modules.chapter_slugs seeded by migration; chapter_progress keyed by (student_id, module_slug, chapter_slug); API rejects unknown slugs. Plan section 4 amended; FE task added.
History: none

### R15: How the FE gets openapi.json (reopens D13 mechanism)
Finding: O9, Medium, outside voice. D13 names no transport for openapi.json between repos.
Plan baseline: D13=A (BE zod → openapi.json → FE generated types), mechanism unspecified
Comparison grid:

| Choice | Current | A | B | C |
|---|---|---|---|---|
| R15 transport | unspecified | BE commits openapi.json on main; FE `npm run gen:api` fetches it from the BE repo with a read-only token; FE CI regenerates and fails on diff | postpone D13 to after the pilot; hand-sync + BE response tests | manual copy of openapi.json into FE when the API changes |

Header: D20 Contract sync
Options:
A) FE CI fetches it (recommended)
BE commits openapi.json (CI fails if stale). FE adds `npm run gen:api`, which downloads it from the BE repo's main branch with a read-only GitHub token and regenerates src/types/api.ts; FE CI fails if the result differs from what's committed. Effort: human ~2h / CC ~10 min.
B) Postpone to after the pilot
Drop D13 for now: BE response tests only, FE types hand-written.
C) Manual copy
Copy openapi.json into the FE by hand whenever the API changes.
State: approved
Actual answer: A) FE CI fetches it (recommended) — D20 answer, 2026-11-18
Accepted scope: BE commits openapi.json (CI fails if stale). FE `npm run gen:api` downloads it from BE main with a read-only token and regenerates src/types/api.ts; FE CI fails on diff. Plan section 6 amended.
History: D13=A approved 2026-11-18; reopened for its missing transport (O9).

### R16: Build in-app checkout now, or Payment Links (reopens payment scope)
Finding: O10, Medium, outside voice. Prices, currency, tax, refunds and upgrades are all open (founder questions 1–4); much of the checkout design depends on them.
Plan baseline: in-app Stripe Checkout (section 5) with D6, D7, D14, D15, D17
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R16 payment build | in-app Checkout, build step 3 | keep in-app Checkout; build step 3 starts only after founders answer questions 1, 2 and 5 | Stripe Payment Links per product; admin matches payments to accounts and grants with POST /admin/enrollments; no checkout endpoint or seat hold |

Header: D21 Payments
Options:
A) In-app Checkout, gated (recommended)
Keep the designed checkout. Build steps 0–2 and 4 go ahead; step 3 (payments) starts only after founders answer prices/currency/tax, refunds and invite-only vs open sign-up.
B) Payment Links + admin grants
Each product is a Stripe Payment Link. An admin checks the Stripe dashboard, matches the payer's email to an account and grants access by hand. No checkout endpoint, seat hold or webhook transaction.
State: approved
Actual answer: A) In-app Checkout, gated (recommended) — D21 answer, 2026-11-18
Accepted scope: Keep the designed checkout. Steps 0–2 and 4 go ahead; step 3 starts only after founders answer prices/currency/tax, refunds and invite-only vs open sign-up. Plan section 9 amended.
History: none

### R17: Record who granted access
Finding: O12, Low, outside voice. enrollments and credit_ledger have no granted_by; audit_log is optional.
Plan baseline: original proposal
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R17 grant attribution | none | `granted_by` (admin user id, null for Stripe) on enrollments and credit_ledger, set by access.service | none |

Header: D22 Granted by
Options:
A) Add granted_by (recommended)
access.service sets granted_by = the admin's id on manual grants and credits; null for Stripe purchases. Effort: two columns, ~15 min.
B) Skip
No record of which admin made a grant.
State: approved
Actual answer: A) Add granted_by (recommended) — D22 answer, 2026-11-18
Accepted scope: access.service sets granted_by = admin id on manual grants and credits; null for Stripe purchases. Plan section 4 amended.
History: none

### R18: Role at invite time
Finding: O14, Low, outside voice. Trigger always inserts role student; the invite updates it afterwards; a failed update leaves a mentor with a student account.
Plan baseline: original proposal
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R18 invite role | trigger = student, then update | `invites(email, role, invited_by)` row written by the API before inviteUserByEmail; trigger takes the role from a matching invite, else student | keep update-after-invite; check the role in the same request and retry |

Header: D23 Invite role
Options:
A) Invites table (recommended)
The API inserts invites(email, role, invited_by) then calls auth.admin.inviteUserByEmail. The profiles trigger reads the role from a matching invite (server-written, users can't touch it), defaulting to student. Effort: human ~1h / CC ~5 min.
B) Update after invite
Keep the current flow; the invite endpoint checks the role was updated and retries on failure.
State: approved
Actual answer: A) Invites table (recommended) — D23 answer, 2026-11-18
Accepted scope: API inserts invites(email, role, invited_by), then calls auth.admin.inviteUserByEmail; profiles trigger takes the role from a matching invite, else student. Plan section 4 amended.
History: none

Approval readiness: PASS. Checked R1 (D6), R2 (D7), R3 (D8), R4 (D9), R5 (D10), R6 (D11), R7 (D12), R8 (D13), R9 (D14), R10 (D15), R11 (D16), R12 (D17), R13 (D18), R14 (D19), R15 (D20), R16 (D21), R17 (D22), R18 (D23); scope D2–D5. Every accepted remedy cites its own answer. Corrections applied without a question: F1, A4, A5, O2, O7, O11, O13 (factual or required for an approved contract).

## Review body

### Reality rows

| Premise | Claim | Receipt | Verdict |
|---|---|---|---|
| P1 | Express 5 is installed | d4ybe/package.json:22 `"express": "^5.3.0"` | true |
| P2 | FE types are the API contract | d4yfe/src/types/index.ts:2 | true |
| P3 | demo.ts lists what the API must return | d4yfe/src/data/demo.ts:2 | true |
| P4 | Pilot capacity is 25 | d4yfe/src/data/demo.ts:155 | true |
| P5 | Escalation is already computed in the FE | d4yfe/src/features/admin/reviewAge.ts:6 | true |
| P6 | Shared pooler is IPv4; direct host IPv6 | Supabase connect docs (web search 2026-11-18) | true |
| P7 | Free projects pause after a week; Pro has 7-day backups | Supabase FAQ + pricing (web search 2026-11-18) | true |
| P8 | Node 22 EOL 2027-04-30, Node 24 LTS to 2028-04-30 | in-distribution knowledge | unverified |

premise-table unverified=1

- REALITY: premise-table finding 8 premises, unverified=1 (Node EOL dates; verify at nodejs.org) docs/architecture.md (R5)
- REALITY: already-done pass `git log origin/main` shows only "setup init express be" and "Initial commit"; nothing in the plan is built d4ybe/index.js:1
- REALITY: surface-check finding `supabase` and `stripe` CLIs not installed, so `supabase gen types typescript`, `supabase db push`, `supabase start`, `stripe listen --forward-to` are unverified (task T2); `gcloud` 528.0.0 present docs/architecture.md section 9
- REALITY: binding-decisions pass plan `## Binding decisions` + ledger D2–D23; no overruled default reintroduced (booking, hardship, jobs absent from sections 1–9) docs/architecture.md:15
- REALITY: numbers pass 25 seats [measured: demo.ts:155]; $25/month [measured: Supabase pricing page]; effort estimates [estimated] docs/architecture.md section 11
- REALITY: deferred-asks pass no linked issue docs/architecture.md:1
- REALITY: pr-count finding no ship policy, so default one PR per wave; build order has 6 steps (0–5), i.e. 6 PRs, each a review gate docs/architecture.md section 9

### 1. Architecture review

- `[CRITICAL] (confidence: 8/10) docs/architecture.md section 7` — prod Supabase plan unspecified; Free pauses and lacks backups. Dispositions: accepted, D11.
- `[INFORMATIONAL] (confidence: 7/10) section 4` — enrollments/credit_ledger written by three modules. Accepted, D12.
- `[INFORMATIONAL] (confidence: 7/10) d4yfe/src/types/index.ts:2` — contract hand-synced across repos. Accepted, D13 + D20.
- `[INFORMATIONAL] (confidence: 8/10) section 4 profiles row` — no way to create the first admin. Applied as a runbook step (required for the approved admin role).
- `[INFORMATIONAL] (confidence: 7/10) section 2 token check` — JWKS returns no keys until asymmetric signing keys are turned on. Applied as a setup step.

**Two shapes.** Shape 1 (chosen): FE → Express API → Postgres; authorization, seat rules and status computation live in services behind ~30 endpoints. Shape 2: FE → Supabase REST API with RLS policies per table, plus an Edge Function for the Stripe webhook. Shape 1 hides more behind less: one service owns each rule (seats, credits, mentor isolation), whereas Shape 2 spreads them over SQL policies and FE queries and pushes status computation into the FE. The founders also fixed Express. Pick: Shape 1.

**Red flags screened:** shallow module: none. Information leakage: module list (fixed D8/D19), API shapes (fixed D13/D20). Temporal decomposition: none (modules split by area). Pass-through: watch `*.routes.ts → *.service.ts` for one-line forwards; routes must parse/validate, services decide. Split ownership: grants (fixed D12). Two ways to do one task: grants (fixed D12). Importable internals: a module's repository must not be imported by other modules; enforce with an ESLint `no-restricted-imports` rule (task T1). Hand-synced list: chapters (fixed D19).

**Failure per integration:** JWKS rotation: jose refetches on unknown `kid`. Pooler outage: 503 from the error handler, `/health` stays up because it doesn't touch the DB. Stripe webhook failure: 500 → Stripe retries for up to 3 days (D6). Webhook secret misconfigured: every event 400; covered by a Cloud Logging alert on non-2xx webhook responses (T10). Storage: orphan uploads if a student never confirms, harmless at pilot size.

### 2. Code quality review

- `[INFORMATIONAL] (confidence: 8/10) section 5 step 4` — webhook must return 400 on a bad signature, 200 on ignored event types, and guard `req.body` being undefined in Express 5 when the content type doesn't match. Required for D6/D17; added to tests.
- `[INFORMATIONAL] (confidence: 7/10) section 3 error-handler.ts` — map Postgres unique/foreign-key violations to 409/400 instead of 500. Required for the approved one-error-shape contract; task T1.

Shared-code: only the grants extraction (D12). No other candidates with two proven callers.

Dispositions: both applied as required work.

### 3. Test review

Framework: none in the repo (package.json test script is a stub). The plan's Vitest + supertest against local Supabase is the original proposal; no new framework choice was raised.

```
CODE PATHS (planned)                                  USER FLOWS
[+] middleware/auth.ts                                [+] Sign up → onboarding
  ├── [GAP] no / expired / forged token → 401           ├── [GAP] [→E2E] new student sets track
  └── [GAP] wrong role → 403                            └── [GAP] metadata role ignored
[+] modules/payments                                  [+] Buy a package
  ├── checkout                                          ├── [GAP] [→E2E] pay with test card → access
  │   ├── [GAP] reuse open session (D15)                ├── [GAP] double-click Buy
  │   ├── [GAP] seat cap incl. members (D7/D14)         └── [GAP] cancel on Stripe → seat freed after 30 min
  │   └── [GAP] Stripe call fails → order expired     [+] Submit work
  └── webhook                                           ├── [GAP] [→E2E] submit → mentor review → feedback
      ├── [GAP] bad signature 400 / ignored type 200    └── [GAP] 0 rounds → clear message
      ├── [GAP] payment_status ≠ paid ignored (D17)   [+] Mentor
      ├── [GAP] duplicate event, one grant (D6)         └── [GAP] cannot open another mentor's review
      ├── [GAP] mid-transaction failure rolls back    [+] Admin
      └── [GAP] missing order rebuilt (O2)              ├── [GAP] grant when full → refused
[+] modules/access                                      └── [GAP] invite mentor → mentor role
  ├── [GAP] grantProduct idempotent, sets cohort
  └── [GAP] useCredit never below zero under race
[+] modules/student submissions
  ├── [GAP] path not issued by upload-url → 400
  └── [GAP] unknown chapter slug → 400
[+] modules/mentor reviews
  └── [GAP] bad rubric criterion/score → 400
[+] supabase/migrations
  ├── [GAP] trigger roles (invite / default student)
  └── [GAP] RLS: publishable key reads nothing

COVERAGE: 0/27 paths tested (no code yet)  |  GAPS: 27 (4 E2E)
Legend: [GAP] no test yet  |  [→E2E] needs an integration test through the API
```

All gaps are required proof for approved behavior; none needed a new decision. Test Plan artifact: `~/.gstack/projects/ManasKohli-d4ybe/manaskohli-main-eng-review-test-plan-20261118-195919.md`. Tests made obsolete: none.

### 4. Performance review

- `[INFORMATIONAL] (confidence: 8/10) section 4` — Postgres doesn't index foreign keys; filters on `reviews.mentor_id`, `submissions.student_id`, `orders.cohort_id` need indexes. Scale: pilot rows in the hundreds, so it's habit rather than urgent. Applied in section 11.
- `[INFORMATIONAL] (confidence: 7/10) section 6` — page endpoints must load in one request with no per-row queries. Applied in section 11.
- `[INFORMATIONAL] (confidence: 8/10) section 7` — cost guards (budget alert, max instances, registry cleanup, log volume) at the user's request. Applied in section 11.
- `[INFORMATIONAL] (confidence: 6/10) section 7` — min instances 0 means a 1–3 s cold start after idle (medium confidence, verify after first deploy). No change; revisit if students notice.

### NOT in scope

- In-app booking and availability (D2): scheduling links cover 25 students.
- In-app hardship applications and blind review (D3): a handful of applications go through a form and an admin grant.
- Scheduled jobs and reminder emails (D4): escalation shows on the admin page.
- Delayed payment methods (D17): cards only.
- Package upgrades and extra review-round purchases: waiting on founder answers.
- Redis/Memorystore caching: in-memory caches cover the pilot (section 11).

### What already exists

- FE contract: `d4yfe/src/types/index.ts` and `d4yfe/src/data/demo.ts` (reused as the API spec; migrated to generated types by D13/D20).
- FE escalation rule: `d4yfe/src/features/admin/reviewAge.ts` (reused; D4).
- FE program content and rubrics: `d4yfe/src/data/modules.ts`, `portal.ts` (seed source for `program_modules`, D8/D19).
- BE: only `index.js` hello world and Express 5.3.0 in `package.json`; replaced by step 0.
- Built-ins reused: Supabase Auth, Storage signed URLs, Stripe Checkout and its retries, Postgres row locks and unique constraints, jose JWKS caching.

### Failure modes

| Path | Realistic failure | Handling | Test | User sees |
|---|---|---|---|---|
| Checkout | Stripe API down | order → expired, 502 | yes (planned) | clear error, retry |
| Webhook | handler crashes mid-grant | rollback, 500, Stripe retries | yes | access appears on retry |
| Webhook | wrong webhook secret in prod | 400 + log + alert (T10) | config, not testable | delayed access until fixed; alert fires |
| Submit | 0 rounds left | 409 | yes | "no review rounds left" |
| Upload | file over bucket limit | Storage rejects upload | manual check | upload error in FE |
| Auth | JWKS fetch fails | 401/503 | partial | sign-in error |
| DB | pooler outage | 503 from error handler | yes | error page |

Critical gaps (no test, no handling, silent): 0.

### Worktree parallelization strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Step 0 scaffold | d4ybe root, src/ | — |
| Supabase + GCP setup | Supabase dashboard, GCP | — |
| Foundation migration + auth | supabase/, src/middleware, modules/me | Step 0, setup |
| FE chapter slugs, scheduling links, admin grant form | d4yfe/src/data, features/ | — |
| Access + reviews | modules/access, student, mentor | Foundation |
| Payments (gated D21) | modules/payments, access | Access, founder answers |
| OpenAPI pipeline | modules/*/schemas, d4yfe scripts | Step 0 |

Lane A: Step 0 → Foundation → Access + reviews → Payments (shared src/modules). Lane B: FE changes (independent repo). Lane C: Supabase/GCP setup (no code). Execution order: launch A (step 0), B and C together; Foundation waits for A's step 0 and C. Conflict flags: `modules/access` is shared by reviews and payments, so sequence them in Lane A.

### Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code or Codex; checkbox as you ship.

- [x] **T1 (P1, human: ~1 day / CC: ~20 min)** — scaffold — Set up TypeScript, folder skeleton and CI (step 0)
  - Surfaced by: D5, D9, D10, D12; Code quality (error mapping); red flag 7 (import rule)
  - Files: package.json, tsconfig.json, eslint.config.js, vitest.config.ts, src/{server,app}.ts, src/routes/index.ts, src/config/env.ts, src/lib/{logger,http-logger}.ts, src/middleware/*, src/errors/app-error.ts, src/modules/health/ (feature module folders are created by the step that first needs them; conventions in src/modules/README.md), Dockerfile, .github/workflows/ci.yml, .nvmrc
  - Shipped 2026-11-26 on branch feat/t1-scaffold
  - Verify: `npm run typecheck && npm run lint && npm test && docker build .`; `GET /health` returns 200
- [ ] **T2 (P1, human: ~30 min / CC: ~5 min)** — tooling — Install the Supabase and Stripe CLIs and confirm the commands the plan names
  - Surfaced by: reality row surface-check
  - Files: README.md (setup section)
  - Verify: `supabase --help`, `supabase gen types --help`, `stripe listen --help`
- [ ] **T3 (P1, human: ~2h / CC: n/a)** — infra — Create Supabase dev (Free) and prod (Pro) in ca-central-1; asymmetric keys on; custom SMTP; first-admin runbook
  - Surfaced by: D11, A4, A5
  - Files: docs/runbook.md
  - Verify: JWKS endpoint returns a key; first admin can sign in to /admin
- [x] **T4 (P1, human: ~1 day / CC: ~30 min)** — db — Foundation migration: program_modules (+chapter slugs), profiles/invites/student_profiles trigger, RLS on every table, FK indexes
  - Surfaced by: D8, D18, D19, D23, section 11
  - Files: supabase/migrations/, supabase/seed.sql
  - Verify: trigger and RLS tests in the Test Plan
  - Shipped 2026-11-27 on branch feat/t2-database, with the rest of section 4 except content (T10), plus the auth middleware and `GET /me` from step 1. Choices made while building: the invite role applies only when `auth.users.invited_at` is set (a self-sign-up with an invited address stays a student); invited mentors also get a `mentor_profiles` row; `orders.checkout_url` (for D15 reuse); `schools.latitude/longitude` (FE `School.coordinates`); `credit_ledger` and `audit_log` are append-only and the ledger refuses a negative balance. Local test accounts in `seed.sql`; hosted setup in `docs/runbook.md` (T3)
- [ ] **T5 (P1, human: ~1 day / CC: ~30 min)** — access + reviews — access module with granted_by; submission → credit → review lifecycle
  - Surfaced by: D12, D16, D22, O7
  - Files: src/modules/access/, student/, mentor/
  - Verify: credit race and mentor isolation tests
- [ ] **T6 (P1, human: ~2 days / CC: ~45 min)** — payments — Checkout (lock, reuse, card-only, order-first) and webhook transaction. Gated on founder answers (D21)
  - Surfaced by: D6, D7, D14, D15, D17, D21, O2
  - Files: src/modules/payments/
  - Verify: webhook tests + Stripe CLI end-to-end
- [ ] **T7 (P2, human: ~1 day / CC: ~30 min)** — contract — zod-to-openapi in BE; `gen:api` + CI diff check in FE
  - Surfaced by: D13, D20
  - Files: src/modules/*/*.schemas.ts, openapi.json, d4yfe/package.json, d4yfe/.github/workflows/ci.yml
  - Verify: renaming a response field fails FE CI
- [ ] **T8 (P2, human: ~1 day / CC: ~30 min)** — frontend — Chapter slugs, mentor scheduling links, admin manual grant form
  - Surfaced by: D2, D3, D19, O11
  - Files: d4yfe/src/data/modules.ts, d4yfe/src/features/student, d4yfe/src/features/admin
  - Verify: `npm run check` in d4yfe
- [ ] **T9 (P2, human: ~2h / CC: ~10 min)** — ops — Cost guards and rate limits from section 11, plus an alert on non-2xx webhook responses
  - Surfaced by: section 11 (user request), Failure modes (webhook secret)
  - Files: src/app.ts, GCP console, Artifact Registry policy
  - Verify: budget alert exists; 6th checkout in a minute returns 429

### Unresolved decisions

None.

### Completion summary

- Step 0: Scope Challenge — scope reduced per recommendation (D2, D3, D4)
- Reality rows: 7/7 tier-1 rows emitted, 1 unverified premise
- Architecture Review: 5 issues found
- Code Quality Review: 2 issues found
- Test Review: diagram produced, 27 gaps identified
- Performance Review: 4 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item (FE Node bump, approved under D10)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: Codex not installed; native Claude Plan subagent completed (in-host), 14 findings, outside coverage unavailable
- Parallelization: 3 lanes, 3 parallel / 4 sequential steps in Lane A
- Lake Score: 13/18

## Review: /plan-eng-review, content uploads (2026-11-18)

Target: D25–D40 and their edits in sections 1, 3, 4, 6, 8, 9, 10, 11 of this file. Branch `feat/content-uploads`. Report file: this file. Earlier decisions D2–D23 not relitigated.

### Scope record

feature answers: none proposed (every piece maps to a founder requirement in the brief); structure: D33=A (content module); accepted scope: D25–D31 as proposed plus D33–D40; pending remedies: none.

Scope Challenge result: scope accepted as-is.

### Decisions this run

| Question | Answer | Recorded as |
|---|---|---|
| D32 run /office-hours first? | B, skip | setup only |
| D33 who owns lessons/materials | A, content module | D33 |
| D34 library visibility | A, enrolled + Start here | D34 (revised by D39) |
| D35 reorder | A, one call per chapter | D35 |
| D36 multi-answer submissions | A, submission_items | D36 |
| D37 lesson codes | A, derived on read | D37 |
| D38 workshop recordings | A, material kind video | D38 |
| D39 Start here visibility | A, seat holders only | D39 |
| D40 keep D35 (outside challenge) | A, keep | D40 |

Approval readiness: PASS. D33–D40 each cite their own answer. Corrections applied without a question: C1, C4, O2, O4, O6, O8, O10, O11, O12, O14 (required for approved decisions or factual). Rejected: O13 (rename the feedback-file route), because the founder brief names `GET /student/reviews/:id/feedback-file`.

### Reality rows

- REALITY: premise-table pass 4 premises with receipts (FE derives codes, StudentModule.tsx `chapterCode`; CASPer assignment is multi-answer, modules.ts "2 video and 3 typed responses"; chapter.materials mixes assignments, modules.ts "Build your timeline"; mentor form already has a commented-document field, MentorReview.tsx), unverified=1 (Vimeo plan pricing) docs/architecture.md section 11
- REALITY: already-done pass no backend code exists; FE already has videos, materials and a commented-document field (reused) d4yfe/src/features/mentor/pages/MentorReview.tsx
- REALITY: surface-check finding Supabase `createSignedUploadUrl`, bucket `file_size_limit`/`allowed_mime_types` and Vimeo domain privacy are named but unverified locally (CLIs not installed, T2 from the first review) docs/architecture.md section 8
- REALITY: binding-decisions pass D2–D4 not reintroduced; prototype features that conflict are listed as open questions only (section 10, question 13) docs/architecture.md section 10
- REALITY: numbers finding video size 50–150 MB per minute and Vimeo $12–25/month are [estimated]; 25 students [measured: demo.ts:155] docs/architecture.md sections 8, 11
- REALITY: deferred-asks pass every brief item is placed: videos D25, content in DB D26, tables section 4, uploads D28, video answers D29, buckets D30, access D31, founder questions 8–13 docs/architecture.md
- REALITY: pr-count pass one PR per repo (BE plan, FE mock flow) on feat/content-uploads docs/architecture.md

### 1. Architecture review

- `[INFORMATIONAL] (confidence: 8/10) section 4 seed` — C1: FE `modules.ts` would keep a second copy of videos/materials. Applied, refined by O2: split `Chapter.materials` first.
- `[INFORMATIONAL] (confidence: 7/10) D27` — C2: the library had no visibility rule. Decided D34, revised D39.
- Two shapes: content module (chosen, D33) vs admin-owned tables. The content module hides the publish, enrollment and seat rules behind one service used by three readers (module page, library, downloads) and one writer (admin).
- Red flags: hand-synced list (C1, fixed), split ownership (D33, fixed), two ways to reorder (D40, fixed).
- Failure per integration: video host down → player shows its own error and the written summary still renders; Storage confirm finds no object → 400, the FE offers retry; replacement half-done → the old file stays live until the row updates.

Dispositions: C1 applied; C2 → D34/D39.

### 2. Code quality review

- `[INFORMATIONAL] (confidence: 7/10) section 6 reorder` — C3: per-item `sort_order` can half-apply. Decided D35/D40.
- `[INFORMATIONAL] (confidence: 7/10) section 8 feedback bucket` — C4: `{review_id}/{file}` collides on re-upload. Applied: per-upload id segment.
- `[INFORMATIONAL] (confidence: 5/10) lessons.duration_min` — C5: length is typed by the admin and can drift from the real video (medium confidence, verify this is actually an issue). No change; the admin form shows the provider's length when the link is pasted, if the host's oEmbed returns it.

### 3. Test review

```
CODE PATHS (planned)                                   USER FLOWS
[+] content.service                                    [+] Admin manages content
  ├── [GAP] enrollment + published gate (D31)            ├── [GAP] [→E2E] paste video link → publish → student sees
  ├── [GAP] start-here needs a seat (D39)                ├── [GAP] [→E2E] upload → confirm → publish → download
  ├── [GAP] chapter_slug in chapter_slugs                ├── [GAP] replace file; old object logged
  ├── [GAP] code derivation N.0 / N.C / N.Ca (D37)       └── [GAP] reorder → codes follow (D35/D37)
  ├── [GAP] publish requires video_ref                 [+] Mentor
  ├── [GAP] reorder ids == chapter items (D35)           └── [GAP] [→E2E] attach commented doc → student opens it
  └── video-link parser                                [+] Student
      ├── [GAP] Vimeo h= hash kept (O10)                 ├── [GAP] [→E2E] CASPer: 2 links + 3 typed, one round
      └── [GAP] host suffix forms (O11)                  └── [GAP] unenrolled module → 403
[+] upload confirm (O4)
  ├── [GAP] wrong shape / foreign prefix / missing object → 400
  └── [GAP] mentor upload URL: own review, not completed
[+] submissions
  └── [GAP] items match answer_spec (D36)
[+] routes
  └── [GAP] /admin/content* admin-only

COVERAGE: 0/19 paths tested (no code yet)  |  GAPS: 19 (4 E2E)
Legend: [GAP] no test yet  |  [→E2E] needs an integration test through the API
```

Test Plan artifact: `~/.gstack/projects/ManasKohli-d4ybe/manaskohli-feat-content-uploads-eng-review-test-plan-20261118-203903.md`.

### 4. Performance review

- `[INFORMATIONAL] (confidence: 7/10) GET /student/modules/:slug` — two indexed queries (lessons, materials) per page plus the enrollment check; no cache needed at pilot scale, since content edits must show immediately. The FE player iframes load lazily (`loading="lazy"`), so a module page with ~10 videos doesn't load 10 players up front.

### Outside voice (Claude Plan subagent, native fallback; Codex not installed)

Completed in 104 s, under the 5-minute limit. VERDICT: FINDINGS (14). Decided: O1→D36, O3→D37, O5→D38, O7→D39, O9→D40. Applied: O2, O4, O6, O8, O10, O11, O12, O14. Rejected: O13 (route named in the founder brief).

### NOT in scope

Student video uploads (D29), quiz/practice scoring, helpfulness ratings, follow-up messaging, in-app booking, blind hardship review, auto-escalation (all section 10 question 13), orphan cleanup automation (O12).

### Implementation Tasks
- [ ] **T10 (P1, human: ~2 days / CC: ~45 min)** — content — lessons/materials migrations, `materials` bucket, seed from FE modules.ts, content module, student and admin content endpoints, upload confirm. Gated on founder questions 8, 9, 12
  - Surfaced by: D25–D27, D30, D31, D33–D35, D37, D38, O4, O8
  - Files: supabase/migrations/, src/modules/content/, src/modules/student/, src/modules/admin/
  - Verify: content edge cases in the Test Plan
- [ ] **T11 (P1, human: ~1 day / CC: ~30 min)** — submissions — `submission_items`, `answer_spec`, video-link answers, `feedback` bucket and commented documents
  - Surfaced by: D28, D29, D36, C4, O11
  - Files: supabase/migrations/, src/modules/student/, src/modules/mentor/
  - Verify: multi-answer and feedback-file tests
- [ ] **T12 (P2, human: ~1 day / CC: ~30 min)** — frontend — split `Chapter.materials`, embedded player, CSP, wire the Content page to the API (after T10)
  - Surfaced by: C1, O2, O8
  - Files: d4yfe/src/types, d4yfe/src/data/modules.ts, d4yfe/vercel.json
  - Verify: `npm run check` in d4yfe

### Completion summary

- Step 0: Scope Challenge — scope accepted as-is
- Reality rows: 7/7 tier-1 rows emitted, 1 unverified premise
- Architecture Review: 2 issues found
- Code Quality Review: 2 issues found
- Test Review: diagram produced, 19 gaps identified
- Performance Review: 1 issue found
- NOT in scope: written
- What already exists: FE videos, materials, MaterialList, mentor commented-document field (reused)
- TODOS.md updates: 0 items proposed
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: Codex not installed; native Claude Plan subagent completed (in-host), 14 findings, outside coverage unavailable
- Parallelization: Sequential implementation, no parallelization opportunity (T11 and T12 depend on T10)
- Lake Score: 6/6

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | Codex not installed; native Claude Plan subagent fallback | Independent 2nd opinion | 2 | unavailable (in-host fallback completed) | latest: 14 findings, all resolved (5 decided D36–D40, 8 applied, 1 rejected) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | ISSUES OPEN | latest: 24 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review phase, unavailable (CLI not installed) in both runs; native Claude Plan subagent completed both times. Native results don't count as outside coverage.
- **VERDICT:** No review CLEAR. All findings decided or applied; open issues are build tasks (T1–T12) and untested planned paths. eng review required

NO UNRESOLVED DECISIONS
