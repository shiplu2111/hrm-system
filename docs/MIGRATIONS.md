# MIGRATIONS.md — Database Migration Policy

Applies to `apps/backend`. Every schema change goes through a migration file — **never** edit the database manually in staging/production, and never edit an already-applied migration file (per `RULES.md` §4).

---

## 1. Tooling

- **ORM/Migration tool:** Prisma Migrate (per `ARCHITECTURE.md` §4 — confirm before Phase 0 scaffolding if this changes)
- Migrations live in `apps/backend/prisma/migrations/`
- Schema source of truth: `apps/backend/prisma/schema.prisma`, which must always match `DATABASE_SCHEMA.md` — if they diverge, `DATABASE_SCHEMA.md` is updated as part of the same PR that changes the schema.

---

## 2. Creating a Migration

```bash
# After editing schema.prisma
pnpm --filter backend exec prisma migrate dev --name <descriptive_name>
```

- `<descriptive_name>`: snake_case, describes the change, not the ticket number — e.g., `add_loan_advances_table`, not `fix_jira_123`.
- This generates a new timestamped migration folder + SQL file, and applies it to your local dev DB.
- Always review the generated SQL before committing — Prisma's inferred migration isn't always the most efficient or safe path (see §5 for destructive changes).

---

## 3. Applying Migrations

| Environment | Command | Notes |
|---|---|---|
| Local dev | `prisma migrate dev` | Also regenerates Prisma Client |
| CI (test DB) | `prisma migrate deploy` | Applies pending migrations, no interactive prompts |
| Staging | `prisma migrate deploy` | Run as part of deploy pipeline, before app restart |
| Production | `prisma migrate deploy` | Run as part of deploy pipeline, before app restart — **always take a DB backup immediately before** (see §7) |

- `migrate deploy` never generates new migrations or prompts — it only applies what's already committed. This is the only command that should ever touch staging/production.
- `migrate dev` is a local-only workflow command — never run it against staging/production databases.

---

## 4. Migration Review Checklist (PR level)

- [ ] Migration file is committed alongside the `schema.prisma` change (never hand-edit generated SQL unless documented why in the PR)
- [ ] `DATABASE_SCHEMA.md` updated to match, in the same PR
- [ ] No destructive operation (see §5) without an explicit rollback/backfill plan described in the PR
- [ ] New tables follow conventions from `RULES.md` §4 (`id` uuid PK, `created_at`/`updated_at`, `deleted_at` where compliance-relevant)
- [ ] New foreign keys have explicit `ON DELETE` behavior (never left as default)
- [ ] Money fields use `Decimal`, never `Float` (`RULES.md` §3)
- [ ] Migration tested against a copy of realistic data volume where feasible, not just an empty test DB, if the change affects a large existing table

---

## 5. Destructive / High-Risk Changes

These require extra care — flag explicitly in the PR description, and get a second reviewer's sign-off before merging:

- **Dropping a column or table:** confirm nothing in `backend`, `admin`, or `mobile` still reads it (search across the monorepo, not just the immediate module). Prefer a two-step process: (1) stop writing/reading in application code, deploy, confirm stable, (2) drop the column/table in a follow-up migration.
- **Renaming a column or table:** Prisma treats this as drop + create by default unless done carefully — use `@map`/explicit rename SQL to preserve data instead of losing it.
- **Changing a column's type:** e.g., widening/narrowing a `varchar`, changing `Int` to `Decimal` — verify existing data is compatible; write a data migration/backfill step if not.
- **Adding a `NOT NULL` column to a table with existing rows:** must include a default value or a backfill step in the same migration — a bare `NOT NULL` addition will fail against existing data.
- **Changing an enum's values:** removing a value that's in use will fail; plan a backfill to a replacement value first if removing/renaming an enum member.

For any of the above touching `payroll_runs`, `payslips`, `salary_structures`, `attendance_records`, or `bank_accounts` — treat as highest risk given financial/compliance sensitivity (`SECURITY.md` §5, §8) and require explicit review sign-off beyond the normal PR process.

---

## 6. Seed Data

- `apps/backend/prisma/seed.ts` — used for local dev and CI test DB setup only, **never** run against staging/production with real-looking data that could be mistaken for actual records.
- Seed data must be obviously synthetic (per `TESTING.md` §7) — e.g., `Test Employee 1`, fake email domains — never real employee names or plausible bank details.
- Seed script should be idempotent (safe to re-run) — upsert, not blind insert.

```bash
pnpm --filter backend exec prisma db seed
```

### 6.1 Production Seeding (distinct from dev seed data above)

Two things **must** be seeded even in production/staging, and are not "test data" — they're required for the system to be usable at all on first boot:

1. **The four default roles + full permission catalog** (`DATABASE_SCHEMA.md` §1) — `roles`, `permissions`, and the default `role_permissions` mapping per `ROLES_PERMISSIONS.md`'s matrix. Without this, no `@RequirePermission()` guard can resolve to anything and the app is unusable.
2. **The first `super_admin` user** — since there's no one yet to create the first account through the normal admin UI. Per `ENV_SETUP.md` §6, this uses a one-time bootstrap mechanism (e.g., `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` Tier 0 env vars, consumed once and ignored thereafter) rather than the regular dev seed script, and rather than an email-invite flow that would depend on SMTP being configured (which it isn't yet at this point — `ENV_SETUP.md` §6).

This production seed step runs as part of first deployment/first migration, separately from `seed.ts` (§6 above) — keep the two scripts distinct so dev-only synthetic data can never accidentally run against a real environment, per this section's opening rule.

---

## 7. Production Migration Safety

- **Always back up the production database immediately before running `migrate deploy`** in a production deploy — automated as part of the deploy pipeline, not a manual "remember to do it" step.
- Migrations run **before** the new application code is live (so the new code's expectations match the schema by the time it starts serving traffic) — but should be written to be backward-compatible with the *previous* app version for the brief window during a rolling deploy, where feasible (i.e., avoid a migration that would break the old code still running during deploy).
- For any migration flagged under §5 as high-risk, prefer running it during a low-traffic maintenance window, not as a silent part of a routine deploy.
- Failed migrations in production halt the deploy — never proceed with deploying new application code if its corresponding migration failed to apply.

---

## 8. Rollback Strategy

- Prisma Migrate does not auto-generate "down" migrations. For any migration classified as high-risk (§5), write and test a manual rollback SQL script alongside it, stored in the same PR (e.g., `migrations/<timestamp>_<name>/rollback.sql`) for reference — even if not automatically run, it should be ready to execute manually if the migration causes production issues.
- The safest rollback for most cases is a forward-fix migration (a new migration that reverses the problematic change), not reverting the DB to a prior migration state — reverting can conflict with any data written after the problematic migration was applied.

---

## 9. Multi-Developer Coordination

- Pull latest `main`/`develop` and re-run `prisma migrate dev` before starting new schema work, to avoid migration history conflicts (two developers generating migrations from divergent schema states).
- If a migration conflict occurs (two people added migrations in parallel), resolve by regenerating: reset local migration history to match `main`, then re-generate your migration on top — do not manually merge two migration folders' SQL by hand.

---

## 10. Open Items

- [ ] Confirm Prisma vs TypeORM final decision (`ARCHITECTURE.md` §12) — this document assumes Prisma; update if the decision changes
- [ ] Set up automated pre-migration backup step in the production deploy pipeline (§7)
- [ ] Define who provides the "second reviewer sign-off" for high-risk migrations (§5) — role/person TBD
