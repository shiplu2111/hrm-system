# DEPLOYMENT.md

## 1. Environments

```
development  -- local machine
staging      -- mirrors production, used for QA and pre-release validation
production   -- live tenants
```

## 2. Deployment Pipeline (CI/CD)

```
Push/PR merge → CI (lint, test, build) → Deploy to staging (auto)
  → Manual QA sign-off → Deploy to production (manual approval gate)
```

- Payroll-calculation-affecting changes require an explicit sign-off step referencing PAYROLL_LOGIC.md test coverage before production deploy (see TESTING.md).

## 3. Backend Deployment

- Containerized (Docker) NestJS app; deployed behind a load balancer.
- Zero-downtime deploys (rolling/blue-green) — payroll processing jobs must not be interrupted mid-run; use graceful shutdown to let in-flight jobs (BullMQ) complete or safely requeue.

## 4. Database Migrations in Deployment

- Migrations run as a distinct pipeline step before the new app version receives traffic (see MIGRATIONS.md §7).
- Backward-compatible migrations preferred (additive first, cleanup in a follow-up deploy) to avoid downtime during rollout.

## 5. Mobile App Releases

- Staged rollout (e.g. 10% → 50% → 100%) via app store phased release where available.
- Given the offline-sync dependency, a mobile release that changes the sync payload/contract must remain backward-compatible with at least one prior app version still in the field (employees may not update immediately, and may have queued offline data from the old version).

## 6. Rollback Strategy

- Backend: redeploy previous container image; migrations designed to be additive so rollback doesn't require a down-migration in the common case.
- If a down-migration is required, it must have been tested (see MIGRATIONS.md §2).

## 7. Environment Configuration

- Secrets injected via the deployment platform's secrets manager, never baked into images (see ENV_SETUP.md, SECURITY.md §11).

## 8. Monitoring Post-Deploy

- Error rate, API latency, queue depth (BullMQ), and payroll job success/failure rate monitored immediately after each production deploy.
- Alerting on: failed payroll runs, spike in sync errors, spike in auth failures.

## 9. Multi-Tenant Deploy Considerations

- Since all tenants share infrastructure (see ARCHITECTURE.md §2), a bad deploy affects everyone — staging validation and gradual rollout are not optional steps to skip under time pressure.
