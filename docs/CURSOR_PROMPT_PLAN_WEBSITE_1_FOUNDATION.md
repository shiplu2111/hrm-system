# CURSOR_PROMPT_PLAN_WEBSITE_1_FOUNDATION.md

Public website, part 1 of 3: **app setup, design, and the core marketing pages.** Start after the Super Admin panel is done (your order: Admin, Employee, Platform, **Website**, Mobile). Track pages in `WEBSITE_PAGE_INDEX.md`.

Same rules as before: one prompt at a time, check it in the browser (desktop and phone width), commit after each success.

**Three ground rules for every prompt in all 3 files:**
1. **No invented proof.** Do not write fake testimonials, customer logos, user counts, awards, or "trusted by" lines. Use clearly marked placeholders (for example `[CUSTOMER QUOTE PENDING]`) until real ones exist. Do not claim compliance certifications the product does not hold.
2. **No copied competitor content.** Use other HR products only as a reference for which sections a page needs. Write original copy and design.
3. **Facts come from the product.** Prices, plan features, supported countries and integrations are read from the platform APIs, never typed into the website.

---

## STAGE A: Setup, Design, Shell

**Prompt A.1**
```
Read /docs/PRD.md, /docs/MODULES.md and /docs/PHASES.md. Scaffold apps/website as a separate app
using a server-rendering framework suited to SEO (Next.js with TypeScript and Tailwind), in the
existing monorepo. It must not share a deployment with apps/web or apps/platform. Set up: shared
design tokens from /docs/DESIGN_SYSTEM.md (import the same Tailwind config or tokens package), ESLint,
environment config, and a typed API client generated from the platform's public endpoints.
Public pages should be statically generated or server-rendered with caching, not client-only.
```
**Verify:** `npm run dev` boots; a test page is visible with view-source showing real HTML content (not an empty div).

**Prompt A.2**
```
Read /docs/DESIGN_SYSTEM.md and /docs/UI_GUIDELINES.md section 9. The marketing site needs its own
layer on top of the product tokens: a larger type scale for headlines, a wider spacing rhythm, a
hero pattern, section containers, button variants, a feature-card, a pricing-card, an FAQ accordion,
and a CTA band. Build these as a small component set in apps/website. Keep the colours trustworthy
for a payroll product. All user-facing strings go through the i18n layer from day one, even if only
English ships first.
```
**Verify:** A component showcase page renders every component at phone, tablet and desktop width.

**Prompt A.3**
```
Build the site shell: sticky header with logo, main nav (Product, Solutions, Pricing, Resources,
Company), a "Log in" link and a "Start free trial" button; mega-menu or dropdown for Product and
Solutions; mobile menu; footer with link columns, language switcher, and legal links. Add 404 and
500 pages with a helpful link back. Add a skip-to-content link and visible focus states.
```
**Verify:** Keyboard-only navigation reaches every menu item; mobile menu opens and closes correctly.

---

## STAGE B: Home and Features

**Prompt B.1**
```
Read /docs/PRD.md section 3 (differentiators) and /docs/MODULES.md. Build the Home page: hero with
one clear promise and two buttons (Start free trial, Book a demo), a short product visual (use a
real screenshot of the Admin Panel once available, otherwise an honest placeholder), a section for
each differentiator (country-configurable payroll, offline-first mobile attendance, dynamic payroll
rules, full audit trail), a modules overview grid, a "how it works in 3 steps" row, an FAQ, and a
closing CTA band. Write the copy for a buyer such as an HR manager, payroll officer or business
owner. No fake social proof (see ground rule 1).
```
**Verify:** Every claim on the page can be traced to a feature in /docs/MODULES.md. List any claim that cannot and remove it.

**Prompt B.2**
```
Build the Features overview and a reusable Feature Detail page template, then create pages for:
Payroll (including tax, payslips, simulation, audit trail), Attendance and Roster (including
geofencing and offline clock-in), Leave and Holidays, Recruitment and Onboarding, Employee
Self-Service and Mobile App, Reports and Dashboards, Workflows and Approvals. Each page: headline,
3-6 feature blocks with an image slot, a short "who it is for", related features, and a CTA.
Mark clearly which features are Phase 2 or Phase 3 per /docs/PHASES.md as "Coming soon" instead
of presenting them as available.
```
**Verify:** A feature that is still in Phase 2 or 3 is labelled "Coming soon", not sold as live.

---

## STAGE C: Solutions, Trust, Company

**Prompt C.1**
```
Build a Solutions by Country page template driven by data from the platform's country API (Super
Admin Stage I). For each active country show: currency, pay frequencies, statutory items the
product supports (tax, social security or superannuation, statutory leave, public holidays),
and a CTA. Only list countries whose status is active. Add a country selector on the index page.
Do not state specific tax rates or legal rules on the marketing page; link to the Help Center
instead, since those numbers change.
```
**Verify:** Switching a test country to retired in the platform removes it from the website after the cache window; no tax rates are printed on these pages.

**Prompt C.2 (P2)**
```
Build Solutions by Company Size and Industry (small business, growing teams, multi-branch,
shift-based and field workforces), reusing the template. Keep claims to what the product does.
```
**Verify:** Each page links to relevant feature pages and a CTA.

**Prompt C.3**
```
Read /docs/SECURITY.md fully. Build the How It Works and Security and Trust page: multi-tenant
isolation, encryption, role-based access, audit log, backups, data retention and deletion,
two-factor authentication, support-access approval (a staff member can only enter a tenant account
with the owner's consent, time-boxed, and logged). Describe only controls that are actually
implemented. Add a "last reviewed" date and a link to the Privacy Policy. Do not add compliance
badges unless a real certificate exists.
```
**Verify:** Every sentence maps to a section of /docs/SECURITY.md or a built feature; remove any that do not.

**Prompt C.4**
```
Build About (mission, story, team placeholder) and Careers (P2, list from a simple data file or
the platform later). Use placeholders for team photos and bios, clearly marked, rather than
invented people.
```
**Verify:** No fabricated names or photos remain.

**Prompt C.5 (P2)**
```
Build the Customers and Case Studies index and article template. Ship it hidden (noindex, not in
navigation) until at least one real, approved case study exists.
```
**Verify:** The page is not linked or indexed while empty.

---

## After this file

Pages 1-6, 14-16 and 26 of `WEBSITE_PAGE_INDEX.md` should be done. Continue with `CURSOR_PROMPT_PLAN_WEBSITE_2_SIGNUP_PRICING.md`.
