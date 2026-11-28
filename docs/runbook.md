# Runbook: Supabase projects (task T3)

One-time setup for each hosted Supabase project (dev/staging on Free, prod on Pro, both `ca-central-1`; D11). Migrations set up the schema and the lockdown. The settings below live in the dashboard, so a migration can't set them.

## 1. Point the CLI at the right account

The CLI keeps one login per machine. If it's signed in to another Supabase account:

```sh
supabase logout
supabase login                  # opens the browser: sign in to the D4Y account
supabase projects list          # the D4Y project(s) should be listed, region ca-central-1
supabase link --project-ref <ref>
```

`supabase link` writes the ref to `supabase/.temp/` (git-ignored). Run it again when you switch between the dev and prod projects.

## 2. Dashboard settings (both projects)

| Where | Setting | Why |
|---|---|---|
| Project Settings → JWT Keys | Migrate to **asymmetric signing keys** (ES256), then revoke the legacy HS256 secret once nothing uses it | The API only accepts ES256/RS256 tokens verified against JWKS (section 2). Until this is done the JWKS endpoint returns no keys and every request is a 401 |
| Project Settings → API keys | Use the new `sb_publishable_…` / `sb_secret_…` keys; disable the legacy `anon` / `service_role` JWT keys | The secret key is held only by the API (Secret Manager) |
| Project Settings → Data API | Turn off **automatically expose new tables** (or turn the Data API off). The browser uses supabase-js for Auth only | Defense in depth on top of RLS with no policies and no grants |
| Authentication → Providers → Email | Confirm email **on**, secure password change **on** | The invite role rule and account safety depend on confirmed addresses |
| Authentication → Policies | Minimum password length **10**, letters and digits required | Matches `supabase/config.toml` |
| Authentication → Sign In / Up | Anonymous sign-ins **off**. Turn sign-ups off if the founders pick invite-only (section 10, question 5) | |
| Authentication → URL Configuration | Site URL = the pilot domain; redirect URLs = pilot domain (+ Firebase default domains if used), and in dev the Vercel preview and `http://localhost:5173` | Stops redirect-based token theft |
| Authentication → SMTP | Custom SMTP (sender domain: question 6) | The built-in sender is rate-limited and not for production |
| Database → SSL | Enforce SSL; download the root CA into Secret Manager as `DATABASE_CA_CERT` | The API verifies the pooler certificate when the CA is set |
| Database → Network restrictions (prod) | Optional: allow only the Cloud Run egress range once it's static | |
| Billing (prod) | Pro plan, spend cap on | D11, section 11 |

## 3. Apply the migrations

```sh
supabase db push --dry-run      # read the list of migrations it will apply
supabase db push                # migrations only; seed.sql is never pushed
```

`supabase/seed.sql` (the local test accounts) is **never** run on a hosted project. Don't paste it into the SQL editor.

Check the result in the SQL editor:

```sql
-- every table has RLS on (expect no rows)
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- the browser roles hold nothing (expect no rows)
select table_name, grantee from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');
```

## 4. First admin

There's no admin to invite the first admin (section 7):

1. Authentication → Users → **Invite user** with the coordinator's email.
2. They accept the invite and set a password. The trigger creates a `student` profile, because there's no `invites` row.
3. In the SQL editor, promote them and drop the student row:

   ```sql
   begin;
   update public.profiles set role = 'admin' where email = lower('coordinator@example.org');
   delete from public.student_profiles
    where user_id = (select id from public.profiles where email = lower('coordinator@example.org'));
   commit;
   ```

4. They sign in again. `GET /me` returns `"role": "admin"`.

Later mentors and admins are invited from the app (`POST /admin/mentors/invite`), which writes the `invites` row first, so the role is set automatically (D23).

## 5. API secrets (Cloud Run)

`DATABASE_URL` (the **shared pooler** string from Connect → Transaction pooler, port 6543), `SUPABASE_URL` (`https://<ref>.supabase.co`, no trailing slash) and `DATABASE_CA_CERT` go in Secret Manager. The API refuses to start if `DATABASE_URL` or `SUPABASE_URL` is missing or malformed, or, in production, if `DATABASE_CA_CERT` is missing for a remote database.

## 6. Invites and squatted addresses

An invite is honoured only for an account Supabase creates through the invite (no password yet). If someone already signed up with that address themselves, the invite stays pending and the account stays a student, on purpose: whoever set that password would otherwise get staff access. Check with `select email, accepted_at from public.invites where accepted_at is null;`, delete the unconfirmed account in Authentication → Users, and invite again.

Banning a user in Authentication → Users cuts off API access on their next request (the API checks `banned_until`); their open sessions don't need to expire first.
