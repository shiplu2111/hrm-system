# CMSN-HR Public Website — Pre-Launch & Go-Live Checklist

**Target Environment**: Production (`NEXT_PUBLIC_APP_ENV=production`, `SITE_IS_STAGING=false`)
**Staging Verification Baseline**: Verified pre-launch on `2026-11-26` (all 24 Playwright E2E desktop/phone × EN/BN journeys passing, Content Truth Audit complete, security/SEO/perf budgets green).
**Launch Gate Rule**: **No production launch** until every `[ ]` item below is completed, signed off by its listed **Owner**, and dated (`YYYY-MM-DD`) in the **Done Date** column.

---

## 1. Legal Pages Approved with Dates

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[ ]` | Review and approve Terms of Service ([terms.md](src/content/legal/terms.md)): replace draft notice, set `LEGAL_APPROVED: true`, set valid `reviewedOn: YYYY-MM-DD`, `version`, and `effectiveDate`. | Legal Counsel | `____-__-__` |
| `[ ]` | Review and approve Privacy Policy ([privacy.md](src/content/legal/privacy.md)): verify lead, trial signup, cookie, and erasure disclosures match jurisdiction; set `LEGAL_APPROVED: true` & `reviewedOn`. | Legal Counsel | `____-__-__` |
| `[ ]` | Review and approve Cookie Policy ([cookies.md](src/content/legal/cookies.md)): confirm Necessary, Analytics, and Marketing category descriptions match live script gating; set `LEGAL_APPROVED: true` & `reviewedOn`. | Legal Counsel | `____-__-__` |
| `[ ]` | Review and approve Data Processing Agreement ([dpa.md](src/content/legal/dpa.md)): set `LEGAL_APPROVED: true` & `reviewedOn`, export signed PDF, upload to production object storage (`StorageModule`), and verify live PDF download on `/dpa`. | Legal Counsel & Platform Ops | `____-__-__` |
| `[ ]` | Confirm `/subprocessors` API feed (`GET /api/v1/public/legal/subprocessors`) lists **only** active production subprocessors (hosting, SMTP/email, push/FCM, Stripe, optional error tracking) with an accurate `lastUpdated` date and live change-subscription email dispatch. | Security & Privacy Lead | `____-__-__` |
| `[ ]` | Run production build legal gate (`NEXT_PUBLIC_APP_ENV=production npm run build -w @hrm/website` via [next.config.ts](next.config.ts)) and confirm `assertLegalDocsApprovedForProductionBuild()` passes cleanly with exit code `0`. | Release Engineering | `____-__-__` |

---

## 2. Domain, DNS & TLS

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[ ]` | Provision apex (`<prod-domain>`) and `www.<prod-domain>` DNS records pointing to production ingress/CDN; enforce `http://` -> `https://` permanent redirect. | Infra / DevOps Lead | `____-__-__` |
| `[ ]` | Verify valid TLS 1.2/1.3 certificate chain on `<prod-domain>`, `www.<prod-domain>`, API (`NEXT_PUBLIC_API_URL`), Portal (`NEXT_PUBLIC_PORTAL_URL`), and Platform Console (`NEXT_PUBLIC_PLATFORM_URL`) with auto-renewal active. | Infra / DevOps Lead | `____-__-__` |
| `[ ]` | Confirm HTTP security headers active at edge/app ([next.config.ts](next.config.ts)): `Strict-Transport-Security` (`max-age=63072000; includeSubDomains; preload`), `Content-Security-Policy` (`upgrade-insecure-requests`), `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`. | Security Engineering | `____-__-__` |
| `[ ]` | Confirm production environment variables injected via Secrets Manager ([deploy-production.yml](../../.github/workflows/deploy-production.yml)): `NEXT_PUBLIC_APP_ENV=production`, `SITE_IS_STAGING=false`, `PRODUCTION_REVALIDATE_SECRET`, and valid public origins; confirm `X-Robots-Tag: noindex` is absent on public indexable pages. | Release Engineering | `____-__-__` |
| `[ ]` | Verify Staging stays isolated (`SITE_IS_STAGING=true`, `X-Robots-Tag: noindex, nofollow`, `robots.txt` `Disallow: /`) and API CORS restricts `/api/v1/public/*` strictly to the production website origin. | Security Engineering | `____-__-__` |

---

## 3. Redirects from Any Old Domain & Renamed URLs

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[ ]` | Configure edge/DNS permanent (`301`/`308`) redirects from any legacy brand domain(s) and `www` <-> apex canonical host to `https://<prod-domain>` while preserving path and UTM query strings. | Infra / DevOps Lead | `____-__-__` |
| `[x]` | Verify all 12 renamed path permanent redirects (`308`) in [next.config.ts](next.config.ts) (`/updates` -> `/changelog`, `/countries` -> `/solutions/countries`, `/help-center` -> `/help`, `/contact-sales` -> `/contact?topic=sales`, `/start-trial` -> `/signup`, `/book-demo` -> `/demo`, `/privacy-policy` -> `/privacy`, `/terms-of-service` -> `/terms`, `/cookie-policy` -> `/cookies`, RSS feeds) + `/en/*` -> `/*` locale canonicalization ([middleware.ts](src/middleware.ts)). | Website Engineering | `2026-11-26` |
| `[ ]` | Re-run live redirect smoke test against the production domain covering old domains, `http://`, `www`, and renamed paths prior to opening public traffic. | QA / Release Lead | `____-__-__` |

---

## 4. Sales Inbox & Email Deliverability (SPF, DKIM, DMARC)

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[ ]` | Configure production transactional SMTP (`PlatformSetting`: `category=email`, `key=default`) encrypted with production `FIELD_ENCRYPTION_KEY`, and verify zero fallback simulation logs in API startup. | Infra / DevOps Lead | `____-__-__` |
| `[ ]` | Configure `PlatformSetting` (`category=email`, `key=sales_inbox`) with the monitored Sales team inbox and verify live Demo/Contact/Enterprise submissions deliver alerts without `[SALES_INBOX_UNCONFIGURED]` warnings. | Sales Operations | `____-__-__` |
| `[ ]` | Publish and validate DNS **SPF** record (`v=spf1 include:<smtp-provider> ~all` or `-all`) on sending domain with <10 DNS lookups. | Infra / DevOps Lead | `____-__-__` |
| `[ ]` | Publish and enable **DKIM** (2048-bit selector TXT records) in DNS and confirm DKIM `pass` alignment in test email headers. | Infra / DevOps Lead | `____-__-__` |
| `[ ]` | Publish DNS **DMARC** record (`v=DMARC1; p=quarantine` minimum, `rua=` aggregate reporting inbox configured) and verify end-to-end inbox placement across Gmail and Microsoft 365 for signup verification, forgot-workspace, demo/contact confirmations, and changelog/subprocessor updates. | Sales Operations & Infra | `____-__-__` |

---

## 5. Analytics & Consent Verified

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[x]` | Verify consent gating pre-launch ([CookieConsentProvider.tsx](src/components/legal/CookieConsentProvider.tsx), [ConsentGatedScripts.tsx](src/components/legal/ConsentGatedScripts.tsx)): declining cookies across EN/BN desktop & phone records `0` `/api/analytics/collect` calls, `0` analytics/marketing script tags, and `null` persisted UTM attribution. | Website Engineering | `2026-11-26` |
| `[ ]` | Set production analytics environment settings (`NEXT_PUBLIC_ANALYTICS_MODE`, `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_ANALYTICS_COOKIELESS`, and CSP-allowed analytics script host if external) and verify no PII (`email`, `ownerName`, passwords, tokens) is emitted in analytics payloads. | Growth & Privacy Lead | `____-__-__` |
| `[ ]` | Run a post-deploy production opt-in sanity check verifying full funnel tracking (`visit` -> `pricing_view` -> `signup_start` -> `email_verified` -> `tenant_created`, plus `demo` / `contact` + UTM attribution) and persistent footer **Cookie Settings** updates in English & Bengali. | Growth & QA Lead | `____-__-__` |

---

## 6. Sitemap, Robots & Metadata Verified & Submitted

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[ ]` | Verify `https://<prod-domain>/robots.txt` ([robots.ts](src/app/robots.ts)) permits indexing (`Allow: /`, `Disallow: /api/`, `/admin/`, `/platform/`) and declares `Sitemap: https://<prod-domain>/sitemap.xml`. | SEO / Growth Lead | `____-__-__` |
| `[ ]` | Verify `https://<prod-domain>/sitemap.xml` ([sitemap.ts](src/app/sitemap.ts)) outputs absolute production HTTPS URLs with English/Bengali `hreflang` alternates, active countries, and Help Center categories/articles; exclude unapproved `/customers` & empty `/blog`. | SEO / Growth Lead | `____-__-__` |
| `[ ]` | Submit `https://<prod-domain>/sitemap.xml` to Google Search Console and Bing Webmaster Tools and verify property ownership + zero sitemap parse errors. | SEO / Growth Lead | `____-__-__` |
| `[ ]` | Spot-check social preview cards (`https://<prod-domain>/api/og`, Open Graph, Twitter Card) in rich-link inspectors for `/` and `/bn`. | SEO / Growth Lead | `____-__-__` |

---

## 7. Status Page Live & Uptime Monitoring

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[ ]` | Confirm `https://<prod-domain>/status` and `/bn/status` load dynamically (`force-dynamic`) with live health data from `GET /api/v1/health` (`status`, `uptimeSeconds`, `apiLatencyMs`, `errorRatePercentage`, `database`, `redis`, `mobileSyncSuccessRate`). | SRE / On-Call Lead | `____-__-__` |
| `[ ]` | Configure external synthetic uptime checks (1-minute interval) on `https://<prod-domain>/status`, `https://<prod-domain>/pricing`, and `https://<api-domain>/api/v1/health` wired to on-call Pager/Slack/Email alerts. | SRE / On-Call Lead | `____-__-__` |
| `[ ]` | Verify Platform Console Maintenance & Incident publishing updates `/status` cleanly without exposing tenant data. | SRE / Platform Ops | `____-__-__` |

---

## 8. Support Contact Monitored & Lead Pipeline Operational

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[ ]` | Configure production CAPTCHA provider keys (if Cloudflare Turnstile enabled via `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) and confirm automatic math-challenge fallback works cleanly during provider outage. | Security & Website Engineering | `____-__-__` |
| `[ ]` | Confirm support email channel, `/contact` routed inquiries (Sales, Support, Partnership, Other), `/demo` walkthrough requests, and newsletter/subprocessor subscription channels route to monitored queues with defined first-response SLAs. | Support Lead & Sales Ops | `____-__-__` |
| `[ ]` | Confirm Sales & Support staff have tested active Platform Console logins (`Leads` & `Demo Requests` under **Sales & Growth**) and review queue alerts daily. | Sales & Support Lead | `____-__-__` |
| `[ ]` | Verify rate-limit alerting (`429` spikes on `/public/*` POST routes & `/api/analytics/collect`) and honeypot spam drops are observable in API logs. | Security Engineering | `____-__-__` |

---

## 9. Backup of Content, Database & Rollback Readiness

| Status | Checklist Item & Verification Detail | Owner | Done Date |
| --- | --- | --- | --- |
| `[x]` | Source-controlled website copy, dictionaries ([en.ts](src/i18n/dictionaries/en.ts), [bn.ts](src/i18n/dictionaries/bn.ts), etc.), legal markdown (`src/content/legal/*.md`), blog content ([content/blog](content/blog)), and SVG/static media (`public/images`) backed up in protected `main` branch + immutable container tags (`ghcr.io/<repo>/website:prod-<sha>`). | Release Engineering | `2026-11-26` |
| `[ ]` | Verify automated encrypted daily backups are enabled and restore-tested for PostgreSQL tables storing dynamic website content (Knowledge Base articles/categories, Countries, SaaS Plans, Exchange Rates, Platform Settings, Leads, Subscriptions) and `StorageModule` object storage (DPA PDF & assets). | Infra / DevOps Lead | `____-__-__` |
| `[ ]` | Rehearse one-step rollback in Staging via [.github/workflows/rollback.yml](../../.github/workflows/rollback.yml) (`target=website` / `both`, immutable tag promotion + `POST /api/revalidate` `{"scopes":["all"]}`) per [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md). | Release & SRE Lead | `____-__-__` |
| `[x]` | Verify pre-launch `perf:budget`, `security:scan`, Content Truth Audit (`CONTENT_TRUTH`), and 24-journey EN/BN desktop/phone Playwright verification pass with zero regressions before final tag cut. | QA / Release Lead | `2026-11-26` |

---

## Final Go-Live Sign-Off

| Role | Name | Sign-Off Status | Date |
| --- | --- | --- | --- |
| Legal Counsel | `Pending assignment` | `[ ]` Pending | `____-__-__` |
| Infra / DevOps & SRE Lead | `Pending assignment` | `[ ]` Pending | `____-__-__` |
| Security & Privacy Lead | `Pending assignment` | `[ ]` Pending | `____-__-__` |
| Sales & Support Lead | `Pending assignment` | `[ ]` Pending | `____-__-__` |
| SEO / Growth Lead | `Pending assignment` | `[ ]` Pending | `____-__-__` |
| Release / Engineering Owner | `Pending assignment` | `[ ]` Pending | `____-__-__` |
