# BILLING_SUBSCRIPTION.md

## 1. Plan Tiers

```
Free       -- limited employees, core HR only
Starter    -- Attendance, Leave, Basic Payroll
Business   -- + Roster, Timesheet, Advanced Reports
Enterprise -- + API access, SSO, Advanced Workflow, Custom Payroll Rules
```

## 2. Pricing Models

- Per-employee/month, or
- Base fee + per-employee-above-threshold

Final pricing numbers are a business decision outside this document's scope — this file defines the **mechanism**, not the price list.

## 3. Feature Gating

- Each `tenants.plan_id` maps to a feature-flag set (see ARCHITECTURE.md — Tenant Mgmt / Feature management).
- Feature checks happen server-side (an Enterprise-only endpoint returns `403 FORBIDDEN` for a Starter tenant even if the client UI is somehow bypassed) — never client-side-only gating.
- Employee count limits enforced at employee-creation time; approaching/exceeding a plan's employee limit triggers an upgrade prompt, not a hard silent block that confuses the admin.

### 3a. Employee limits (implementation)

- **Who holds a seat:** every employee who is not terminated and not soft-deleted (active, on leave, inactive/suspended).
- **Default caps** (`apps/api/src/billing/plan-features.constants.ts` — placeholder values, a business decision like pricing): Free 10, Starter 50, Business 250, Enterprise unlimited. A tenant with no `plan_id` is treated as Starter.
- **Enforced server-side** wherever an employee starts taking a seat: employee create, status change out of `terminated` (single and bulk), and the lifecycle `rehire` event. Over the cap the API returns `403 PLAN_EMPLOYEE_LIMIT_REACHED` with an actionable message.
- **Upgrade prompt:** shown at 80% of the cap (`approaching`) and at/over the cap (`reached`/`exceeded`) on the admin Plan & Usage page and the Employees directory. At the cap, "Add Employee" opens the upgrade request instead of the form. Requests are raised as support tickets until payment-provider checkout (§5) exists.
- `GET /api/v1/tenant/subscription` (`settings:view`) returns the plan, its features, usage vs. limits, and the plan catalogue for comparison.
- **Not yet runtime-configurable:** the catalogue lives in code. Moving it to `platform_settings` with a Super Admin editor (SYSTEM_SETTINGS.md §2, ENV_SETUP.md §0) is outstanding. Only Enterprise features (`api_access`, `sso`, `advanced_workflow`, `custom_payroll_rules`) are gated server-side today; module-level tiers (e.g. Roster on Business) are displayed but not yet enforced.

## 4. Billing Cycle

- Monthly or annual billing cycle per tenant.
- Employee-count-based plans recalculate the bill based on active employee count at the billing date (define whether proration applies mid-cycle — confirm business rule before implementation).

## 5. Payment Processing

- Integrate with a payment provider (Stripe or regional equivalent) for subscription billing — separate from the platform's own payroll/salary payment integrations (MODULES.md §19), which pay tenant employees, not the SaaS vendor.

## 6. Trial & Sandbox

- New tenants can start on a trial period before requiring payment details.
- Sandbox/staging tenant (MODULES.md §01) is not billed and is clearly flagged as non-production.

## 7. Downgrade/Suspension Handling

- Downgrading a plan that removes access to a feature currently in use (e.g. tenant on Business using Roster, downgrades to Starter) must be handled explicitly: either block the downgrade, or clearly warn what data/access will become read-only/hidden.
- Non-payment leads to a grace period, then read-only/suspended access (never immediate data deletion) — see SECURITY.md §9 for data retention during suspension.

## 8. Super Admin Visibility

- Super Admin panel shows subscription status, usage vs. plan limits, and billing history per tenant (see MODULES.md §01, §38).
