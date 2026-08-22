# HRM System — Monorepo

A full-featured Human Resource Management (HRM) system with GPS-based attendance tracking, multi-mode authentication (Password / PIN / Biometric), complete payroll management, dynamic role-based access control, and admin-configurable system settings.

## 📦 Project Structure

This is a monorepo containing three applications and a shared package:

```
hrm-system/
├── apps/
│   ├── backend/          # NestJS REST API
│   ├── admin/             # React (Vite) Web App — Admin + Employee Self-Service
│   └── mobile/             # React Native (Expo) Employee App
├── packages/
│   └── shared/             # Shared TypeScript types, constants, utils
├── docs/                    # All project documentation (this file's neighbors)
├── docker-compose.yml
├── package.json              # Root workspace config (pnpm/turborepo)
└── README.md
```

> Note: `apps/admin` is referred to as the **Web App** throughout `/docs` — it serves both admin-facing tooling (HR/Manager/Super Admin) and employee self-service (attendance history, leave, payslips), role-scoped from one codebase. Employees can log in from either the mobile app or a browser. See `docs/ARCHITECTURE.md` §6.

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Backend API | NestJS + TypeScript |
| Database | PostgreSQL |
| Cache / Realtime | Redis + Socket.io |
| Web App | React + Vite + TypeScript + Ant Design |
| Mobile App | React Native (Expo) + TypeScript |
| Auth | JWT + Password (all clients) / PIN / Biometric (mobile only, Public Key Signing) |
| ORM | Prisma / TypeORM (decide in ARCHITECTURE.md) |
| Package Manager | pnpm (workspaces) |
| Monorepo Tooling | Turborepo |

## 🚀 Core Features

- Employee Management (profiles, documents, org chart)
- Attendance with GPS Location Tracking & Geofencing (mobile check-in/out; web view-only)
- Multi-mode Login: Password (all clients) → PIN / Biometric (mobile only, optional setup later)
- Leave Management
- Full Payroll (salary structure, tax/PF deductions, loans/advances, payslips, disbursement) — Bangladesh jurisdiction (NBR tax slabs, Labour Act 2006)
- Recruitment & Onboarding
- Performance Management
- **Dynamic Role-Based Access Control** — Super Admin, HR, Manager, Employee are seeded defaults; custom roles and permission sets are fully admin-configurable, no code deploy required
- **Admin-Configurable System Settings** — SMTP, SMS, storage, PF rate, overtime rules, branding, and more, managed from the admin panel instead of `.env` (see `docs/SYSTEM_SETTINGS.md`)
- Reports & Analytics
- Employee Self-Service (mobile + web)

## 📄 Documentation Index

All docs live in `/docs`. Read in this order when onboarding (human or AI agent):

1. `PRD.md` — What we're building and why
2. `ARCHITECTURE.md` — How the system is structured
3. `DATABASE_SCHEMA.md` — Data model / ERD
4. `RULES.md` — Coding conventions (for Cursor/AI agents too)
5. `ROLES_PERMISSIONS.md` — Dynamic role/permission model
6. `SYSTEM_SETTINGS.md` — Admin-configurable settings (secrets + business config)
7. `AUTH_FLOW.md` — Password/PIN/Biometric login flow (and mobile-vs-web split)
8. `API_GUIDELINES.md` — REST conventions
9. `PAYROLL_LOGIC.md` — Salary/tax calculation rules (Bangladesh)
10. `ATTENDANCE_LOGIC.md` — Geofencing & check-in/out rules
11. `SECURITY.md` — Security policies
12. `PHASES.md` — Roadmap / build order

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 15
- Redis >= 7
- Docker (optional, recommended for local DB/Redis)

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd hrm-system

# Install all workspace dependencies
pnpm install

# Copy env files
cp apps/backend/.env.example apps/backend/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env
```

### Running Locally

```bash
# Start Postgres + Redis via Docker
docker-compose up -d

# Run DB migrations
pnpm --filter backend run migration:run

# Start all apps in dev mode (via Turborepo)
pnpm dev

# Or run individually:
pnpm --filter backend dev      # API on http://localhost:3000
pnpm --filter admin dev        # Web App on http://localhost:5173
pnpm --filter mobile dev       # Expo dev server
```

## 🔐 Environment Variables

See `ENV_SETUP.md` for the (now short) Tier 0 bootstrap list. Almost everything else — SMTP, SMS, storage, PF rate, overtime rules, branding — is configured from the Admin Panel after first login, not `.env`. See `SYSTEM_SETTINGS.md`. Never commit `.env` files.

### ⚠️ First-Run Checklist

A fresh install has no email/SMS sending, no file storage, and default payroll rules until a Super Admin configures them:
1. Log in with the seeded bootstrap Super Admin account (`ENV_SETUP.md` §6)
2. Go to Settings → Integrations and configure SMTP/SMS/storage
3. Go to Settings → Payroll Configuration and confirm/adjust PF rate, overtime-eligible roles, insurance policy
4. Go to Settings → Roles & Permissions if any custom roles are needed beyond the seeded four

## 🧪 Testing

```bash
pnpm --filter backend test          # Unit tests
pnpm --filter backend test:e2e      # E2E tests
```

Payroll and attendance calculation logic must have unit test coverage before merging — see `TESTING.md`.

## 📱 Mobile Permissions Required

- Location (foreground, and background if continuous tracking is enabled)
- Biometric / Face ID / Touch ID
- Notifications

See `MOBILE_PERMISSIONS.md` for platform-specific setup (Android/iOS).

## 👥 Roles (seeded defaults — dynamic, admin-configurable)

| Role | Access | Login |
|---|---|---|
| Super Admin | Full system access, module config, roles & permissions, system settings | Web |
| HR | Employee, payroll, leave, recruitment management | Web |
| Manager | Team attendance, leave approval, performance review | Web + Mobile |
| Employee | Self-service: attendance check-in, leave request, payslip view | Mobile (check-in) + Web (self-service) |

`super_admin` can edit any role's permissions or create new custom roles from Settings → Roles & Permissions — this table reflects the seeded starting point, not a hard limit. See `ROLES_PERMISSIONS.md`.

## 📌 Status

🚧 In active development — see `PHASES.md` for current phase.

## 📃 License

Proprietary — internal use only (update as needed).
