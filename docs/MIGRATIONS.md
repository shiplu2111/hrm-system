# MIGRATIONS.md

## 1. Tooling

Database migrations managed via TypeORM/Prisma migration tooling (confirm final ORM choice and record here once decided) — never manual/ad-hoc schema changes against any shared environment.

## 2. Rules

- Every schema change ships as a migration file committed alongside the code that depends on it (see RULES.md §8) — no schema change without a corresponding DATABASE_SCHEMA.md update in the same change.
- Migrations must be reversible (`up`/`down`) wherever feasible. If a migration is genuinely irreversible (e.g. destructive data transform), that must be called out explicitly in the PR description.
- Never edit a migration that has already run in staging/production — write a new migration to correct it.

## 3. Naming Convention

```
{timestamp}_{verb}_{description}.ts
e.g. 20260901120000_add_effective_dating_to_leave_policies.ts
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
