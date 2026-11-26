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

## 10. Public Website Deployment, Preview Builds, CDN Caching & Rollback

### Environments & Previews
- **Pull Request Previews (`.github/workflows/website-preview.yml`)**: Every PR touching `apps/website` runs lint, typecheck, build, `perf:budget`, `security:scan`, and deploys an isolated preview (`SITE_IS_STAGING=true`, `X-Robots-Tag: noindex, nofollow`).
- **Staging (`.github/workflows/deploy-staging.yml`)**: Merging to `develop` builds and deploys `ghcr.io/<repo>/website:staging-<sha>` using `staging` GitHub Environment secrets (`SITE_IS_STAGING=true`, `noindex` enforced).
- **Production (`.github/workflows/deploy-production.yml`)**: Manual `workflow_dispatch` with protected `production` GitHub Environment approval gate, `NEXT_PUBLIC_APP_ENV=production`, `SITE_IS_STAGING=false`, and automated Legal Gate check (`LEGAL_APPROVED=true` + `reviewedOn`).

### CDN Caching & Revalidation Windows
- **Pricing (`/pricing`, `/bn/pricing`, `/api/v1/public/plans`)**: `revalidate = 10`, HTTP `Cache-Control: public, max-age=10, s-maxage=10, stale-while-revalidate=30`, `CDN-Cache-Control: public, s-maxage=10, stale-while-revalidate=30`. Platform price changes become visible within **10 seconds** (or immediately via `POST /api/revalidate`).
- **Countries (`/solutions/countries`, `/solutions/countries/[slug]`, `/api/v1/public/countries`)**: `revalidate = 10`, HTTP `s-maxage=10, stale-while-revalidate=30` so country activation/retirement updates appear within **10 seconds**.
- **Help Center (`/help`, `/help/categories/[slug]`, `/help/articles/[slug]`, `/api/v1/public/kb/*`)**: `revalidate = 10` for catalog/category/article pages (`s-maxage=10, stale-while-revalidate=30`); live search queries (`/help?q=...`) force `Cache-Control: private, no-store`.
- **On-Demand Purge**: `POST /api/revalidate` authenticated via `x-revalidate-secret` (`REVALIDATE_SECRET` from secrets manager) invalidates cache tags (`public-plans`, `public-currencies`, `public-countries`, `public-kb`) and localized paths (`en`, `bn`) immediately.

### Secrets Manager Contract (Website)
- Store all secrets in GitHub Environment Secrets / hosting Secrets Manager (never in git or images):
  - `REVALIDATE_SECRET` (`STAGING_REVALIDATE_SECRET` / `PRODUCTION_REVALIDATE_SECRET`)
  - `STAGING_WEBSITE_DEPLOY_WEBHOOK_URL` / `STAGING_WEBSITE_DEPLOY_WEBHOOK_TOKEN`
  - `PRODUCTION_WEBSITE_DEPLOY_WEBHOOK_URL` / `PRODUCTION_WEBSITE_DEPLOY_WEBHOOK_TOKEN`
  - `WEBSITE_ROLLBACK_WEBHOOK_URL` / `WEBSITE_ROLLBACK_WEBHOOK_TOKEN`
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_WEBSITE_PROJECT_ID` (when Vercel hosting is enabled)

### One-Step Rollback Procedure
- Trigger `.github/workflows/rollback.yml` via GitHub Actions `workflow_dispatch`:
  1. Choose `target` (`website`, `api`, or `both`), `environment` (`staging` or `production`), `target_tag` (the previous known-good immutable tag, e.g. `prod-<sha>`), and `reason`.
  2. The workflow promotes `ghcr.io/<repo>/<service>:<target_tag>` back to `:<environment>`, triggers the environment rollback webhook, and calls `POST /api/revalidate` (`{"scopes":["all"]}`) so CDN/ISR caches flush immediately.
