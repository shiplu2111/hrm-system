# GLOSSARY.md

| Term | Meaning |
|---|---|
| Tenant | A single company/customer using the SaaS platform; data is isolated per tenant. |
| Company | Within a tenant, the legal entity employees belong to (a tenant may have one or more companies). |
| Rule Resolver | The mechanism that resolves country → state → company → contract override chain to determine the effective rule at calculation time. |
| Effective-dating | Attaching `effective_from`/`effective_to` to a rule/policy so historical calculations remain correct after the rule changes. |
| Payroll Run | A single employee's calculated payroll for one payroll period. |
| Payroll Period | The date range (e.g. 1–31 August) a payroll run covers, with its own payment date and status. |
| Gross Pay | Total earnings before deductions. |
| Net Pay | Gross Pay minus total deductions — the amount actually paid. |
| Finalize (Payroll) | Lock a payroll run so it can no longer be directly edited; corrections require a new adjustment. |
| Payroll Simulation | A "what-if" calculation that doesn't create or alter any real payroll data. |
| Accrual | The process by which leave balance is earned over time (e.g. monthly accrual). |
| Carry-Forward | Unused leave balance rolled into the next year, subject to a cap and optional expiry. |
| Encashment | Converting unused leave balance into a payroll earning (cash payout). |
| Geofence | A defined radius around a location used to validate that attendance was captured from an approved place. |
| Local ID | A UUID generated on the mobile device at the moment of an offline action, used to prevent duplicate records on sync. |
| Idempotent | An operation that produces the same result no matter how many times it's repeated with the same input (critical for safe sync retries). |
| RBAC | Role-Based Access Control — permissions granted via roles rather than per-user. |
| ESS | Employee Self-Service — the set of features an employee uses to manage their own HR data. |
| ATS | Applicant Tracking System — the recruitment/hiring pipeline module. |
| GL | General Ledger — the accounting record payroll can export into. |
| Storage Driver | The abstraction that lets file storage switch between S3-compatible and local disk without code changes. |
| Audit Log | The append-only record of who changed what, when — required for all payroll/sensitive-data changes. |
| Formula Engine | The admin-configurable system for defining earning/deduction calculation rules without code changes. |

Add new terms here as they enter the codebase/conversation, so the whole team (and Cursor) stays aligned on vocabulary.
