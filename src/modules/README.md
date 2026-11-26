# Feature modules

One folder per feature (D5). Each module owns its routes, rules and SQL:

```
modules/<name>/
  <name>.routes.ts       HTTP only: validate input, call the service, send the response
  <name>.service.ts      business rules: who may do what, status computation, transactions
  <name>.repository.ts   SQL only (postgres.js tagged templates), no decisions
  <name>.schemas.ts      zod request/response shapes: the API contract (openapi.json)
  <name>.test.ts         unit tests for the service
```

Dependencies point one way: `routes → service → repository → db`. ESLint enforces it:

- a `*.routes.ts` file can't import a repository or `db/`
- a module can't import another module's repository: call its service instead (one owner per table, D12)

Routers are mounted in `src/routes/index.ts`, nowhere else.

Planned modules: `me`, `student`, `mentor`, `admin`, `payments`, `access` (no routes; the only writer of
enrollments and credit_ledger), `content` (no routes; owns lessons and materials). They're added one build
step at a time (docs/architecture.md section 9).
