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

## 4. Billing Cycle & Proration Rules

- **Billing Cycle**: Monthly or annual billing cycle per tenant, anchored to the tenant's initial subscription date or billing anchor date.
- **Proration Rule**: **Full month charged on the billing date, with no mid-cycle proration.**
  - The monthly billing job runs on the scheduled billing date (`next_billing_at`), counts active employee seats holding an active profile (`active`, `on_leave`, `suspended`), and generates the invoice for the cycle.
  - Adding or removing employees mid-cycle does not issue mid-period credit notes or immediate supplemental invoices; the new seat count is captured and charged in full on the subsequent cycle billing date.
  - Plan upgrades executed mid-cycle adjust the plan entitlement immediately; the new plan's base fee and seat pricing take effect on the next renewal date. Downgrades take effect at the end of the current billing cycle (`cancel_at_period_end` or next renewal).

## 5. Payment Processing

- Integrate with a payment provider (Stripe or regional equivalent) for subscription billing — separate from the platform's own payroll/salary payment integrations (MODULES.md §19), which pay tenant employees, not the SaaS vendor.

## 6. Trial & Sandbox

- New tenants can start on a trial period before requiring payment details.
- Sandbox/staging tenant (MODULES.md §01) is not billed and is clearly flagged as non-production.

## 7. Downgrade, Suspension & Dunning Handling

- **Downgrading a plan**:
  - Downgrading a plan that removes access to a feature currently in use (e.g. tenant on Business using Roster, downgrades to Starter) must be handled explicitly: either block the downgrade, or clearly warn what data/access will become read-only/hidden.
  - API keys after a downgrade from Enterprise: existing keys stop authenticating, no new keys can be generated, and the API Keys screen still lists them as paused so the tenant can revoke them (MODULES.md §43).
- **Dunning Lifecycle & Automated Retries**:
  - When an automated subscription charge fails, the system enters an automated dunning sequence:
    1. **Initial Failure (Day 0)**: Invoice remains open. Dunning step set to `1`. Retry scheduled for **Day 1** (+24h). Email sent to Company Owner / Billing Admin notifying payment failure and next retry.
    2. **Retry 1 (Day 1)**: Second charge attempt. If failed, subscription status transitions to `past_due`. Dunning step set to `2`. Retry scheduled for **Day 3** (+48h). Past-due notice email sent.
    3. **Retry 2 (Day 3)**: Third charge attempt. If failed, dunning step set to `3`. Final retry scheduled for **Day 7** (+96h). Urgent final notice email sent notifying impending suspension.
    4. **Final Retry (Day 7)**: Final automated charge attempt. If failed, dunning step set to `4`, and 3-day grace period commences.
    5. **Read-Only Suspension (Day 10)**: Upon grace period expiry with unpaid invoice, the tenant transitions to `suspended` with `suspension_mode = 'read_only'`. Staff/employees can view records and export data, but cannot clock in, run payroll, or modify records.
    6. **Absolute No Data Deletion Rule**: Non-payment or suspension NEVER triggers automated data deletion (SECURITY.md §9). Data remains securely preserved in read-only mode until manual reactivation or explicit owner deletion request.
  - At any point in the dunning sequence, if a charge or manual payment succeeds, the subscription is immediately restored to `active`, dunning step is reset to `0`, and any billing-related suspension is lifted.

## 8. Super Admin Visibility

- Super Admin panel shows subscription status, usage vs. plan limits, and billing history per tenant (see MODULES.md §01, §38).
