# MIGRATIONS.md

## 1. Tooling

**ORM choice: Prisma** (PostgreSQL, `@prisma/client` in `apps/api`).

- Schema source of truth: `apps/api/prisma/schema.prisma` — keep in sync with `DATABASE_SCHEMA.md` (see RULES.md §8).
- Migration files: `apps/api/prisma/migrations/` — generated via `prisma migrate dev`; never hand-edit SQL that has already run in staging/production.
- Prisma uses **forward-only** migrations. There is no built-in `down` step. To revert a change, write a new forward migration that undoes it (or restore from backup in production). Call out genuinely irreversible migrations explicitly in the PR description (see §2).
- Run migrations locally with `npm run migrate` from the repo root (loads `.env` via `dotenv-cli`).

## 2. Rules

- Every schema change ships as a migration file committed alongside the code that depends on it (see RULES.md §8) — no schema change without a corresponding DATABASE_SCHEMA.md update in the same change.
- Migrations must be reversible (`up`/`down`) wherever feasible. With Prisma, reversibility is achieved by adding a compensating forward migration; document rollback steps in the PR when a change cannot be safely undone.
- Never edit a migration that has already run in staging/production — write a new migration to correct it.

## 3. Naming Convention

Prisma migration **folder** names (auto-prefixed with a timestamp by the CLI):

```
{timestamp}_{verb}_{description}/
  migration.sql
e.g. 20260901120000_create_multi_tenancy_and_country_framework/migration.sql
```

Create with an explicit name:

```bash
npm run migrate -- --name create_organization_structure
```

## 4. Payroll/Financial Table Migrations

- Extra caution: migrations touching `payroll_runs`, `salary_structures`, `tax_brackets`, or `audit_logs` require a second reviewer and a dry-run against a staging copy of production-shaped data before merging.
- Never a migration that silently drops or truncates payroll history.

## 5. Multi-Tenant Considerations

- Migrations run once against the shared schema (all tenants share the same tables, scoped by `tenant_id` — see ARCHITECTURE.md §2), not per-tenant. Any migration that could disrupt many tenants at once must be scheduled during a low-traffic window and communicated per DEPLOYMENT.md.

## 6. Seed vs. Migration

- Migrations change schema structure.
- Seeds insert reference data (default roles, default document types) — kept as a separate seed script, not baked into migrations, so environments can be seeded independently of schema version.

## 7. Rollout Process

```
1. Write migration + update DATABASE_SCHEMA.md in the same commit
2. Run against local → CI test DB → staging
3. Verify on staging with production-like data volume
4. Apply to production during deployment (see DEPLOYMENT.md)
5. Monitor for errors immediately after
```

## 8. Commands

| Command | Purpose |
|---------|---------|
| `npm run migrate` | Create/apply migration in dev (`prisma migrate dev`) |
| `npm run migrate:deploy` | Apply pending migrations (CI/production) |
| `npm run prisma:generate` | Regenerate Prisma Client after schema changes |
