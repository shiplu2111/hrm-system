# DOCUMENTATION_INDEX.md — Master Documentation Index

A single lookup table for every doc in `/docs`, what it covers, and — critically — **which doc wins when two seem to overlap**. Read by `.cursorrules` as the mandatory first step for any task; also useful for humans onboarding.

---

## 1. Full Document List

| File | Covers | Primary Audience |
|---|---|---|
| `README.md` | Project overview, setup, run commands, first-run checklist | Everyone (start here) |
| `PRD.md` | What we're building, why, personas, scope, open product questions | Product/human, high-level for AI |
| `ARCHITECTURE.md` | Tech stack, monorepo layout, system diagram, key decisions + rationale | Everyone |
| `RULES.md` | Coding conventions, folder structure, layering, what NOT to do | AI agents + developers |
| `PHASES.md` | Build order, MVP definition, phase exit criteria | Planning |
| `SECURITY.md` | Security policy — auth, data classification, RBAC, retention, incident response | Everyone, especially backend |
| `DATABASE_SCHEMA.md` | Every table, column, relationship, ERD | Backend |
| `ENV_SETUP.md` | Tier 0 bootstrap env vars only (most config moved to `SYSTEM_SETTINGS.md`) | Backend/DevOps |
| `SYSTEM_SETTINGS.md` | Admin-configurable settings (secrets + business config), tiering model | Backend, Admin/Super Admin |
| `ROLES_PERMISSIONS.md` | Dynamic role/permission model, default matrix, custom role workflow | Backend + Web App |
| `MODULES.md` | One-page summary of every business module + dependency graph | Everyone, orientation |
| `GLOSSARY.md` | Domain vocabulary, exact terms/enum values to use everywhere | Everyone |
| `API_GUIDELINES.md` | REST conventions, response envelope, pagination, error codes | Backend + any API consumer |
| `ERROR_HANDLING.md` | How exceptions are implemented internally (backend-specific) | Backend |
| `AUTH_FLOW.md` | Password/PIN/Biometric flows, web-vs-mobile split, tokens | Backend + both clients |
| `PAYROLL_LOGIC.md` | Salary/tax/PF/overtime calculation — Bangladesh jurisdiction | Backend (payroll module) |
| `ATTENDANCE_LOGIC.md` | Geofencing, check-in/out, status determination, offline sync contract | Backend (attendance module) |
| `TESTING.md` | Testing strategy per app, mandatory coverage areas | Everyone |
| `MIGRATIONS.md` | DB migration policy, seed data (dev vs. production) | Backend |
| `UI_GUIDELINES.md` | Web App folder structure, component/data-fetching/forms conventions | Web App (`apps/admin`) |
| `DESIGN_SYSTEM.md` | Colors, typography, spacing tokens for the Web App | Web App |
| `MOBILE_PERMISSIONS.md` | OS permission handling (location, biometric, notifications) | Mobile |
| `OFFLINE_SYNC.md` | Mobile offline queue implementation for attendance | Mobile |
| `NAVIGATION.md` | Screen/route structure for both mobile and web self-service | Mobile + Web App |
| `SHARED_TYPES.md` | `packages/shared` conventions — what belongs there, naming | Everyone (cross-app) |
| `DOCUMENTATION_INDEX.md` | This file | Everyone |

---

## 2. Which Doc Wins (overlap resolution)

Several docs touch the same topic from different angles. When they seem to conflict, this is the priority order:

| Topic | Business rule / "what" lives in | Implementation / "how" lives in | If they conflict... |
|---|---|---|---|
| Payroll calculation | `PAYROLL_LOGIC.md` | Backend `payroll` module code | `PAYROLL_LOGIC.md` wins — it's the source of truth per `RULES.md` §10 |
| Attendance/geofence rules | `ATTENDANCE_LOGIC.md` | Backend `attendance` module + `OFFLINE_SYNC.md` (mobile-side) | `ATTENDANCE_LOGIC.md` wins for business rules; `OFFLINE_SYNC.md` wins for mobile queue mechanics specifically |
| Roles & permissions | `ROLES_PERMISSIONS.md` | `DATABASE_SCHEMA.md` §1 (`roles`/`permissions` tables) | They must always match — `ROLES_PERMISSIONS.md` is the human-readable matrix, `DATABASE_SCHEMA.md` is the enforced structure. If they diverge, that's a bug in one of the docs, fix both together |
| Error responses | `API_GUIDELINES.md` §6 (shape/codes) | `ERROR_HANDLING.md` (how it's implemented in NestJS) | `API_GUIDELINES.md` defines the contract; `ERROR_HANDLING.md` must always produce exactly that shape |
| Config values | `ENV_SETUP.md` (Tier 0 only) vs. `SYSTEM_SETTINGS.md` (Tier 1/2) | — | If a variable isn't clearly Tier 0 (needed to reach the DB), it belongs in `SYSTEM_SETTINGS.md`, not `.env` — see `SYSTEM_SETTINGS.md` §1 for the test |
| Auth flow | `AUTH_FLOW.md` (flow/sequence) | `SECURITY.md` §2 (why, what's protected) | Not really in conflict — `SECURITY.md` sets the *requirement* (e.g., "biometric data never leaves device"), `AUTH_FLOW.md` shows the *sequence* that satisfies it |
| Web app structure | `ARCHITECTURE.md` §6 (high-level) | `UI_GUIDELINES.md` (detailed conventions) + `NAVIGATION.md` (routes) | `ARCHITECTURE.md` is the summary; the other two are authoritative for their specific detail |
| Naming/terminology | `GLOSSARY.md` | Any other doc using a term | `GLOSSARY.md` always wins — if another doc uses a different word for the same concept, that other doc has a typo/drift to fix |

**General principle:** the most specific document wins for its specific topic. `ARCHITECTURE.md` and `PRD.md` are intentionally high-level summaries — when they say something in passing that a specialized doc (`PAYROLL_LOGIC.md`, `SECURITY.md`, etc.) covers in depth, the specialized doc is authoritative.

---

## 3. Task → Doc Quick Reference

*(Mirrors `.cursorrules` §3 — duplicated here so this file is a complete standalone reference, not just a Cursor-specific artifact.)*

| Task | Read |
|---|---|
| Building any API endpoint | `API_GUIDELINES.md`, `ERROR_HANDLING.md` |
| Login / PIN / biometric / sessions | `AUTH_FLOW.md`, `SECURITY.md` §2 |
| Adding/checking a permission | `ROLES_PERMISSIONS.md` |
| Adding a new admin-configurable setting | `SYSTEM_SETTINGS.md` |
| Any payroll calculation | `PAYROLL_LOGIC.md` |
| Any attendance/geofence logic | `ATTENDANCE_LOGIC.md` |
| Mobile offline behavior | `OFFLINE_SYNC.md` |
| Mobile OS permissions | `MOBILE_PERMISSIONS.md` |
| DB schema change | `DATABASE_SCHEMA.md`, `MIGRATIONS.md` |
| New Web App screen/component | `UI_GUIDELINES.md`, `DESIGN_SYSTEM.md`, `NAVIGATION.md` §9 |
| New mobile screen | `NAVIGATION.md` §1–8 |
| New shared type | `SHARED_TYPES.md` |
| Writing a test | `TESTING.md` |
| Unsure what to call something | `GLOSSARY.md` |
| Unsure which phase this belongs in | `PHASES.md` |
| Onboarding to the whole project | `README.md` → `PRD.md` → `ARCHITECTURE.md` → `MODULES.md` |

---

## 4. Cross-Reference Map (which docs reference which)

Useful for understanding blast radius before changing a doc — if you edit one of these, check what points to it:

```
DATABASE_SCHEMA.md          ← referenced by nearly everything (source of truth for data shape)
ROLES_PERMISSIONS.md        ← referenced by: SECURITY.md, RULES.md, UI_GUIDELINES.md,
                               NAVIGATION.md, SHARED_TYPES.md, AUTH_FLOW.md
SYSTEM_SETTINGS.md          ← referenced by: ENV_SETUP.md, SECURITY.md, RULES.md,
                               DATABASE_SCHEMA.md, PRD.md, README.md
PAYROLL_LOGIC.md            ← referenced by: DATABASE_SCHEMA.md, TESTING.md, MODULES.md,
                               ROLES_PERMISSIONS.md, ERROR_HANDLING.md
ATTENDANCE_LOGIC.md         ← referenced by: OFFLINE_SYNC.md, MOBILE_PERMISSIONS.md,
                               PAYROLL_LOGIC.md, TESTING.md, MODULES.md
AUTH_FLOW.md                ← referenced by: NAVIGATION.md, MOBILE_PERMISSIONS.md,
                               UI_GUIDELINES.md, ARCHITECTURE.md
GLOSSARY.md                 ← referenced by: everything (terminology source)
API_GUIDELINES.md           ← referenced by: ERROR_HANDLING.md, OFFLINE_SYNC.md,
                               ATTENDANCE_LOGIC.md, UI_GUIDELINES.md
```

If you rename a section or change a rule in one of the left-hand docs, search for its filename across `/docs` before considering the change complete — a stale cross-reference is worse than no reference at all, since it actively misleads.

---

## 5. Document Status

All documents in this index are current as of the jurisdiction/architecture decisions made through this project's planning phase (Bangladesh payroll jurisdiction, dynamic RBAC, Web App serving both admin + employee self-service). Documents containing 🔶 markers have explicitly flagged open decisions — check those before building the affected feature, per `.cursorrules` §6.

## 6. Keeping This Index Current

When adding a new doc to `/docs`:
1. Add it to the table in §1
2. Add it to §3 if it's task-relevant
3. Add its cross-references to §4 if it references or is referenced by 2+ other docs
4. If it overlaps an existing doc's topic, add a row to §2 clarifying which wins
