# TODOS

## Infrastructure

### Bump the frontend repo off Node 20

**What:** Change `d4yfe/.nvmrc` from `20.19` to `24`, and update its CI, the Firebase Hosting deploy workflow (once it exists, plan D41) and the Vercel Node setting for previews to match.

**Why:** Node 20 reached end of life on 2026-04-30 and gets no security fixes. The backend runs Node 24 (D10), so the two repos should match.

**Context:** Approved as part of D10 in `docs/architecture.md` (plan-eng-review, 2026-11-18). FE `README.md` says "Requires Node 20.19 or later"; update that line too. Run `npm run check` after the bump.

**Effort:** S
**Priority:** P2
**Depends on:** None
